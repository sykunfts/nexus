/* CJdropshipping for the office: freight at checkout, then create → confirm → pay, and status later. */
import { createCjClient, CjError, CJ_HOST, isAuthError, type CjClient } from '../../radar/src/cj/client'
import { parseFreight } from '../../radar/src/cj/parse'
import { createHttp } from '../../radar/src/fetch'
import type { FreightQuote } from '../../radar/src/types'
import { countryInfo, type Country } from '../../src/lib/shipping'

export interface OrderForCj {
  id: string
  email: string
  address: { name: string; line1: string; line2?: string; city: string; region?: string; postcode: string; country: Country; phone?: string }
  lines: { vid: string; qty: number }[]
  shipping: { logisticName: string }
}

export interface CjOffice {
  /* True when the key signs in; never throws. */
  auth(): Promise<boolean>
  freight(vid: string, qty: number, country: Country, zip: string): Promise<FreightQuote | null>
  createOrder(o: OrderForCj): Promise<string>
  confirmOrder(cjOrderId: string): Promise<void>
  payBalance(cjOrderId: string): Promise<void>
  orderDetail(cjOrderId: string): Promise<{ status: string; trackNumber?: string; logisticName?: string }>
}

const str = (x: unknown) => (typeof x === 'string' ? x : '')

/* Where a signed-in token lives between requests (KV in the Worker); CJ allows getAccessToken only every few minutes. */
export interface TokenStore { get(): Promise<string | null>; put(token: string): Promise<void>; clear(): Promise<void> }

export function createCjOffice(o: { apiKey: string; fetch: typeof fetch; sleep?: (ms: number) => Promise<void>; tokenStore?: TokenStore }): CjOffice {
  const http = createHttp({ fetch: (url, init) => o.fetch(url, init), sleep: o.sleep, spacingMs: { [CJ_HOST]: 1100 }, retryDelays: [2000] })
  let client: CjClient | null = null
  const cj = async () => {
    if (client) return client
    const cached = (await o.tokenStore?.get()) ?? null
    const c = createCjClient({ apiKey: o.apiKey, http, token: cached })
    if (!cached) { await c.auth(); await o.tokenStore?.put(c.token()!) }   // kept only once signed in
    client = c
    return client
  }
  /* One call; a stale cached token is dropped and the call repeated once with a fresh sign-in. */
  const withAuth = async <T,>(fn: (c: CjClient) => Promise<T>): Promise<T> => {
    try { return await fn(await cj()) }
    catch (e) {
      if (!isAuthError(e) || !client) throw e
      client = null
      await o.tokenStore?.clear()
      return fn(await cj())
    }
  }

  return {
    async auth() {
      try { await withAuth(async () => undefined); return true } catch { return false }
    },
    freight(vid, qty, country, zip) {
      return withAuth(async (c) => parseFreight(await c.post('/logistic/freightCalculate', { startCountryCode: 'CN', endCountryCode: country, zip, products: [{ quantity: qty, vid }] })))
    },
    createOrder(order) {
      return withAuth(async (c) => {
      const a = order.address
      const body = {
        orderNumber: order.id,
        shippingCustomerName: a.name,
        shippingPhone: a.phone ?? '',
        shippingAddress: a.line1,
        shippingAddress2: a.line2 ?? '',
        shippingCity: a.city,
        shippingProvince: a.region?.trim() || a.city,     // CJ requires a province; countries without one get the city
        shippingZip: a.postcode,
        shippingCountryCode: a.country,
        shippingCountry: countryInfo(a.country).name,
        email: order.email,
        fromCountryCode: 'CN',
        logisticName: order.shipping.logisticName,
        remark: 'NEXUS',
        products: order.lines.map((l) => ({ vid: l.vid, quantity: l.qty })),
      }
      const res = await c.post<{ data?: unknown }>('/shopping/order/createOrderV2', body)
      const id = typeof res.data === 'string' ? res.data : str((res.data as { orderId?: unknown } | undefined)?.orderId)
      if (!id) throw new CjError('create', 'no order id in the reply')
      return id
      })
    },
    confirmOrder(cjOrderId) {
      return withAuth(async (c) => { await c.patch('/shopping/order/confirmOrder', { orderId: cjOrderId }) })
    },
    payBalance(cjOrderId) {
      return withAuth(async (c) => {
        try { await c.post('/shopping/pay/payBalance', { orderId: cjOrderId }) }
        catch (e) { if (e instanceof CjError && String(e.code) === '404') await c.post('/shopping/payment/payBalance', { orderId: cjOrderId }); else throw e }
      })
    },
    orderDetail(cjOrderId) {
      return withAuth(async (c) => {
        const res = await c.get<{ data?: { orderStatus?: unknown; trackNumber?: unknown; logisticName?: unknown } }>('/shopping/order/getOrderDetail', { orderId: cjOrderId })
        const d = res.data ?? {}
        return { status: str(d.orderStatus) || 'UNKNOWN', ...(str(d.trackNumber) ? { trackNumber: str(d.trackNumber) } : {}), ...(str(d.logisticName) ? { logisticName: str(d.logisticName) } : {}) }
      })
    },
  }
}
