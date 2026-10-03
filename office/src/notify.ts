/* "Tell me when it's stocked": one KV entry per product and email, keyed by the email's hash so the key itself holds no address. */
import { json, OfficeError } from './errors'
import { getJson, listAll, putJson, type KV } from './kv'
import { normaliseEmail } from './orders'
import type { Ctx } from './office'
import { validEmail } from '../../src/lib/validate'

export interface NotifyEntry { email: string; at: string }

const enc = new TextEncoder()
export async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(s))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function notifyRoute(c: Ctx, request: Request): Promise<Response> {
  let body: Record<string, unknown> = {}
  try { const b = await request.json(); if (typeof b === 'object' && b !== null) body = b as Record<string, unknown> } catch { throw new OfficeError(400, 'bad_json') }
  const productId = typeof body.productId === 'string' ? body.productId.trim() : ''
  const email = typeof body.email === 'string' ? body.email.trim() : ''
  if (!c.catalogue.some((p) => p.id === productId)) throw new OfficeError(422, 'unknown_product', 'productId')
  if (!validEmail(email)) throw new OfficeError(422, 'bad_email', 'email')
  const lc = normaliseEmail(email)
  const key = `notify:${productId}:${await sha256(lc)}`
  if (!(await c.kv.get(key))) await putJson(c.kv, key, { email: lc, at: c.now().toISOString() } satisfies NotifyEntry)
  return json({ ok: true })
}

/* Counts per product with the addresses, for the merchant view. */
export async function notifySummary(kv: KV): Promise<{ productId: string; count: number; emails: string[] }[]> {
  const keys = await listAll(kv, 'notify:')
  const byProduct = new Map<string, string[]>()
  for (const k of keys) {
    const productId = k.slice('notify:'.length, k.lastIndexOf(':'))
    const entry = await getJson<NotifyEntry>(kv, k)
    if (!entry) continue
    byProduct.set(productId, [...(byProduct.get(productId) ?? []), entry.email])
  }
  return [...byProduct.entries()].map(([productId, emails]) => ({ productId, count: emails.length, emails: emails.sort() })).sort((a, b) => b.count - a.count || a.productId.localeCompare(b.productId))
}
