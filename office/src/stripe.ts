/*
  Stripe without the SDK: one form-encoded POST to create a hosted Checkout Session, and the
  webhook signature check (HMAC-SHA256 over "<timestamp>.<raw body>", 5-minute tolerance).
*/
import { OfficeError } from './errors'
import type { Quote } from './pricing'
import type { AddressInput } from '../../src/lib/validate'
import type { Country } from '../../src/lib/shipping'

export interface Draft { id: string; email: string; address: AddressInput & { country: Country }; quote: Quote; createdAt: string }
export interface StripeEvent {
  id: string
  type: string
  data: { object: { id: string; payment_status?: string; payment_intent?: string | null; client_reference_id?: string | null; customer_email?: string | null; metadata?: Record<string, string>; amount_total?: number } }
}

export const STRIPE_SESSIONS = 'https://api.stripe.com/v1/checkout/sessions'
export const SESSION_TTL_SEC = 2100   // 35 min: Stripe's floor is 30 and it checks the value on its own clock
export const SIGNATURE_TOLERANCE_SEC = 300
const cents = (aud: number) => String(Math.round(aud * 100))

export function sessionParams(draft: Draft, siteUrl: string, nowSec: number): URLSearchParams {
  const p = new URLSearchParams()
  const q = draft.quote
  p.set('mode', 'payment')
  let i = 0
  const item = (name: string, aud: number, quantity: number, description?: string) => {
    p.set(`line_items[${i}][price_data][currency]`, 'aud')
    p.set(`line_items[${i}][price_data][unit_amount]`, cents(aud))
    p.set(`line_items[${i}][price_data][product_data][name]`, name)
    if (description) p.set(`line_items[${i}][price_data][product_data][description]`, description)
    p.set(`line_items[${i}][quantity]`, String(quantity))
    i++
  }
  for (const l of q.lines) item(l.name, l.unitPrice, l.qty, q.tax.included ? q.tax.label : undefined)
  item(`Shipping: ${q.shipping.logisticName}`, q.shipping.aud, 1, `${q.shipping.days[0]}–${q.shipping.days[1]} days from China`)
  if (!q.tax.included && q.tax.amount > 0) item(q.tax.label, q.tax.amount, 1)
  p.set('customer_email', draft.email)
  p.set('client_reference_id', draft.id)
  p.set('metadata[draftId]', draft.id)
  p.set('success_url', `${siteUrl}#/orders/confirmed?session={CHECKOUT_SESSION_ID}`)
  p.set('cancel_url', `${siteUrl}#/checkout`)
  p.set('expires_at', String(nowSec + SESSION_TTL_SEC))
  return p
}

export async function createSession(fetchImpl: typeof fetch, secretKey: string, draft: Draft, siteUrl: string, now: Date): Promise<{ id: string; url: string }> {
  let res: Response
  try {
    res = await fetchImpl(STRIPE_SESSIONS, { method: 'POST', headers: { Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: sessionParams(draft, siteUrl, Math.floor(now.getTime() / 1000)).toString() })
  } catch { throw new OfficeError(502, 'stripe_unavailable') }
  if (!res.ok) throw new OfficeError(502, 'stripe_unavailable')
  const body = (await res.json()) as { id?: string; url?: string }
  if (!body.id || !body.url) throw new OfficeError(502, 'stripe_unavailable')
  return { id: body.id, url: body.url }
}

const enc = new TextEncoder()
const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')

export async function sign(rawBody: string, secret: string, ts: number): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return hex(await crypto.subtle.sign('HMAC', key, enc.encode(`${ts}.${rawBody}`)))
}

export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export async function verifyWebhook(rawBody: string, signatureHeader: string | null, secret: string, now: Date): Promise<StripeEvent> {
  const bad = () => new OfficeError(400, 'bad_signature')
  if (!signatureHeader) throw bad()
  const pairs = signatureHeader.split(',').map((kv) => { const i = kv.indexOf('='); return [kv.slice(0, i).trim(), kv.slice(i + 1).trim()] as [string, string] })
  const ts = Number(pairs.find(([k]) => k === 't')?.[1])
  const v1s = pairs.filter(([k]) => k === 'v1').map(([, v]) => v)   // two for a day after a secret rotation
  if (!Number.isFinite(ts) || v1s.length === 0) throw bad()
  if (Math.abs(Math.floor(now.getTime() / 1000) - ts) > SIGNATURE_TOLERANCE_SEC) throw bad()
  const expected = await sign(rawBody, secret, ts)
  if (!v1s.some((v1) => constantTimeEqual(expected, v1))) throw bad()
  try { return JSON.parse(rawBody) as StripeEvent } catch { throw bad() }
}
