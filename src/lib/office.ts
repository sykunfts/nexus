/*
  The shop's view of the back office (the Cloudflare Worker in office/). Enabled only when the build
  carries VITE_OFFICE_URL; without it the shop stays the prototype that fakes orders locally.
*/
import type { OfficeOrder, OrderState } from '../../office/src/orders'
import type { CartLine } from '../../office/src/pricing'
import { productById, sellable, type Origin, type Product } from './data'

const ORIGINS: Origin[] = ['AU', 'CN', 'US', 'EU', 'UK']
import type { Order, OrderLine } from './orders'
import { zoneOf, type Country } from './shipping'
import type { AddressInput } from './validate'

const raw = (import.meta.env.VITE_OFFICE_URL ?? '').trim().replace(/\/+$/, '')
export const office = { enabled: raw.length > 0, url: raw }
export const TIMEOUT_MS = 10_000
/* The prototype sells everything; the real shop sells only what the office can order. */
export const canBuy = (p: Product) => !office.enabled || sellable(p)
export const TOKEN_KEY = 'nexus.office.token'

/* Leaving the shop for Stripe's page; indirected so tests can watch it without a real navigation. */
export const redirect = { to: (url: string) => { window.location.assign(url) } }

export class OfficeClientError extends Error {
  constructor(public code: string, public status: number, public field?: string, message?: string) {
    super(message ?? code)
    this.name = 'OfficeClientError'
  }
}

export interface CheckoutBody { lines: CartLine[]; email: string; address: AddressInput & { country: Country }; method: 'standard' | 'express' }
export interface FreightBody { lines: CartLine[]; address: { country: Country; postcode: string }; method: 'standard' | 'express' }
export interface FreightReply { shipping: OfficeOrder['shipping']; fellBack: boolean; tax: OfficeOrder['tax']; total: number }

async function call<T>(path: string, init: RequestInit = {}, okStatuses: number[] = [200]): Promise<{ status: number; body: T }> {
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS)
  let res: Response
  try {
    res = await fetch(`${office.url}${path}`, { ...init, headers: { 'content-type': 'application/json', ...(init.headers as Record<string, string> | undefined) }, signal: ctl.signal })
  } catch (e) {
    throw new OfficeClientError('offline', 0, undefined, e instanceof Error && e.name === 'AbortError' ? 'The office did not answer in time.' : 'Could not reach the office.')
  } finally { clearTimeout(timer) }
  let body: unknown = null
  try { body = await res.json() } catch { body = null }
  if (!okStatuses.includes(res.status)) {
    const b = (body ?? {}) as { error?: string; field?: string; message?: string }
    throw new OfficeClientError(b.error ?? `http_${res.status}`, res.status, b.field, b.message)
  }
  return { status: res.status, body: body as T }
}

const post = <T,>(path: string, body: unknown, headers?: Record<string, string>) => call<T>(path, { method: 'POST', body: JSON.stringify(body), headers })

export const quoteFreight = (body: FreightBody) => post<FreightReply>('/freight', body).then((r) => r.body)
export const startCheckout = (body: CheckoutBody) => post<{ url: string }>('/checkout', body).then((r) => r.body)

export async function fetchOrder(id: string, email: string): Promise<OfficeOrder | null> {
  try { return (await call<OfficeOrder>(`/orders/${encodeURIComponent(id)}?email=${encodeURIComponent(email.trim().toLowerCase())}`)).body }
  catch (e) { if (e instanceof OfficeClientError && e.status === 404) return null; throw e }
}

/* null while Stripe's webhook has not landed yet; the caller polls. */
export async function fetchOrderBySession(sessionId: string): Promise<OfficeOrder | null> {
  const r = await call<OfficeOrder | { pending: true }>(`/orders/by-session/${encodeURIComponent(sessionId)}`, {}, [200, 202])
  return r.status === 202 ? null : (r.body as OfficeOrder)
}

export const notifyMe = (productId: string, email: string) => post<{ ok: true }>('/notify', { productId, email: email.trim().toLowerCase() }).then(() => undefined)

const storage = () => { try { return globalThis.localStorage } catch { return null } }
export const admin = {
  token(): string | null { try { return storage()?.getItem(TOKEN_KEY) ?? null } catch { return null } },
  setToken(t: string) { try { if (t) storage()?.setItem(TOKEN_KEY, t); else storage()?.removeItem(TOKEN_KEY) } catch { /* private mode */ } },
  auth(): Record<string, string> { return { Authorization: `Bearer ${admin.token() ?? ''}` } },
  get: <T,>(path: string) => call<T>(path, { headers: admin.auth() }).then((r) => r.body),
  post: <T,>(path: string, body: unknown = {}) => post<T>(path, body, admin.auth()).then((r) => r.body),
}

/* An office order on the shop's order shape, so the confirmation and order pages render it as they render a local one. */
export function toShopOrder(o: OfficeOrder): Order {
  const lines: OrderLine[] = o.lines.map((l) => {
    const p = productById(l.productId)
    const v = p?.variants.find((x) => x.id === l.variantId) ?? p?.variants[0]
    return { key: `${l.productId}:${l.variantId}:`, productId: l.productId, name: l.name, brand: p?.brand ?? 'Nexus Select', variantLabel: v?.label ?? '', qty: l.qty, unitPrice: l.unitPrice, visual: p?.visual ?? 'device', hue: v?.hue ?? p?.hue ?? 200, swatch: v?.swatch ?? '#2b2b30', origin: ORIGINS.includes(l.origin as Origin) ? (l.origin as Origin) : 'CN' }
  })
  const country = o.address.country
  return {
    id: o.id,
    placedAt: o.createdAt,
    email: o.email,
    address: { id: `office-${o.id}`, isDefault: false, ...o.address },
    lines,
    shipments: [{ origin: o.shipping.origin, zone: zoneOf(country), method: o.shipping.method, lineKeys: lines.map((l) => l.key), etaDays: o.shipping.days, cost: o.shipping.aud }],
    totals: { subtotal: o.subtotal, shipping: o.shipping.aud, tax: o.tax.amount, taxIncluded: o.tax.included, taxLabel: o.tax.label, total: o.total, currency: 'AUD' },
    compat: { status: 'ok', issues: [] },
    office: { state: o.state, sessionId: o.stripe.sessionId, ...(o.supplier?.cjOrderId ? { cjOrderId: o.supplier.cjOrderId } : {}), ...(o.supplier?.trackNumber ? { trackNumber: o.supplier.trackNumber } : {}), ...(o.supplier?.logisticName ? { logisticName: o.supplier.logisticName } : {}), ...(o.attention ? { attention: o.attention.reason } : {}) },
  }
}

export type { OfficeOrder, OrderState }
