/*
  From paid to delivered: place the order with CJ, pay it, then follow it. Anything that fails
  becomes a needs_attention order with the reason, an email to Nick, and a daily retry (three at most).
*/
import type { CjOffice } from './cj'
import type { Mailer } from './email'
import { getJson, type KV } from './kv'
import { OrderStore, transition, type OfficeOrder } from './orders'
import type { Draft } from './stripe'

export interface FulfilDeps { cj: CjOffice; store: OrderStore; mailer: Mailer; now: () => Date; dryRun: boolean; log: (s: string) => void; kv?: KV }
export const MAX_ATTEMPTS = 3
export const RETRY_AFTER_MS = 86_400_000
export const DRAFT_MISSING = 'draft_missing'
/* Attention reasons the cron retries by itself: the CJ order exists, only confirm or pay is outstanding. */
const RETRY_WITH_CJ_ORDER = ['cj_confirm_failed', 'cj_pay_failed']

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 200)

async function attention(o: OfficeOrder, reason: string, error: string, d: FulfilDeps): Promise<OfficeOrder> {
  const at = d.now().toISOString()
  const attempts = (o.attention?.attempts ?? 0) + 1
  const next = transition(o, 'needs_attention', at, `${reason}: ${error}`)
  /* A missing draft is usually KV catching up, so it is retried on the next cron rather than tomorrow. */
  const nextRetryAt = new Date(d.now().getTime() + (reason === DRAFT_MISSING ? 0 : RETRY_AFTER_MS)).toISOString()
  const out: OfficeOrder = { ...next, attention: { reason, at, lastError: error, attempts, nextRetryAt } }
  await d.store.save(out)
  await d.mailer.attention(out)
  d.log(`${o.id}: needs attention (${reason})`)
  return out
}

/* An order recorded without its draft (KV had not caught up, or the draft expired): fill it in from the draft once it can be read. */
export async function recoverDraft(o: OfficeOrder, d: FulfilDeps): Promise<OfficeOrder | null> {
  const draftId = o.stripe.draftId
  if (!draftId || !d.kv) return null
  const draft = await getJson<Draft>(d.kv, `draft:${draftId}`)
  if (!draft) return null
  const q = draft.quote
  const out: OfficeOrder = { ...o, email: draft.email, address: draft.address, lines: q.lines, shipping: q.shipping, tax: q.tax, subtotal: q.subtotal, total: q.total, attention: undefined }
  await d.store.save(out)
  await d.kv.delete(`draft:${draftId}`)
  d.log(`${o.id}: draft ${draftId} recovered`)
  return out
}

export async function fulfil(o: OfficeOrder, d: FulfilDeps): Promise<OfficeOrder> {
  let order = o
  if (order.attention?.reason === DRAFT_MISSING || order.lines.length === 0) {
    const recovered = await recoverDraft(order, d)
    if (!recovered) return attention(order, DRAFT_MISSING, `draft ${order.stripe.draftId ?? '(none)'} not readable yet; order details must come from the draft or Stripe`, d)
    order = recovered
  }
  let cjOrderId = order.supplier?.cjOrderId
  const at = () => d.now().toISOString()
  if (!cjOrderId) {
    try { cjOrderId = await d.cj.createOrder(order) } catch (e) { return attention(order, 'cj_create_failed', msg(e), d) }
    order = { ...order, supplier: { cjOrderId, placedAt: at() } }
    await d.store.save(order)
  }
  if (!order.supplier?.confirmedAt) {
    try { await d.cj.confirmOrder(cjOrderId) } catch (e) { return attention(order, 'cj_confirm_failed', msg(e), d) }
    order = { ...order, supplier: { ...order.supplier!, confirmedAt: at() } }
    await d.store.save(order)
  }
  if (d.dryRun) {
    order = { ...order, supplier: { ...order.supplier!, dryRun: true } }
  } else {
    try { await d.cj.payBalance(cjOrderId) } catch (e) { return attention(order, 'cj_pay_failed', msg(e), d) }
    order = { ...order, supplier: { ...order.supplier!, paidAt: at(), dryRun: false } }
  }
  const placed: OfficeOrder = { ...transition(order, 'placed_with_supplier', at(), `CJ ${cjOrderId}${d.dryRun ? ' (dry run, not paid)' : ''}`), attention: undefined }
  await d.store.save(placed)
  await d.mailer.confirmation(placed)
  return placed
}

export async function sync(o: OfficeOrder, d: FulfilDeps): Promise<OfficeOrder> {
  const cjOrderId = o.supplier?.cjOrderId
  if (!cjOrderId) return o
  const detail = await d.cj.orderDetail(cjOrderId)
  const at = d.now().toISOString()
  const supplier = { ...o.supplier!, cjStatus: detail.status, ...(detail.trackNumber ? { trackNumber: detail.trackNumber } : {}), ...(detail.logisticName ? { logisticName: detail.logisticName } : {}) }
  let out: OfficeOrder = { ...o, supplier }
  /* "Shipped" to the customer means a tracking number; CJ can flag SHIPPED a little before the carrier assigns one. */
  if (detail.status === 'SHIPPED' && detail.trackNumber && o.state !== 'shipped' && o.state !== 'delivered') {
    out = transition(out, 'shipped', at, `tracking ${detail.trackNumber}`)
    await d.store.save(out)
    await d.mailer.shipped(out)
    return out
  }
  if (detail.status === 'DELIVERED' && o.state !== 'delivered') {
    out = transition(out, 'delivered', at)
    await d.store.save(out)
    return out
  }
  if (detail.status === 'CANCELLED' && o.state !== 'needs_attention') return attention(out, 'cj_cancelled', 'CJ cancelled the order', d)
  await d.store.save(out)
  return out
}

export async function runCron(d: FulfilDeps): Promise<{ synced: number; retried: number; errors: string[] }> {
  const open = await d.store.listOpen()
  const result = { synced: 0, retried: 0, errors: [] as string[] }
  for (const o of open) {
    try {
      const a = o.attention
      const retryable = o.state === 'needs_attention' && !!a && (!o.supplier?.cjOrderId || RETRY_WITH_CJ_ORDER.includes(a.reason))
      if (retryable) {
        if (a.attempts < MAX_ATTEMPTS && d.now().getTime() >= Date.parse(a.nextRetryAt)) { await fulfil(o, d); result.retried++ }
        continue
      }
      if (o.supplier?.cjOrderId && (o.state === 'placed_with_supplier' || o.state === 'shipped' || (o.state === 'needs_attention' && o.attention?.reason !== 'cj_cancelled'))) {
        await sync(o, d); result.synced++
      }
    } catch (e) { result.errors.push(`${o.id}: ${msg(e)}`); d.log(`cron ${o.id}: ${msg(e)}`) }
  }
  return result
}
