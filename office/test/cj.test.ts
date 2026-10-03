import { describe, expect, it } from 'vitest'
import { createCjOffice, type OrderForCj } from '../src/cj'
import { getRate } from '../src/rate'
import { MemoryKV } from '../src/kv'
import create from './fixtures/cj-create.json'
import detail from './fixtures/cj-detail.json'
import freight from '../../radar/test/fixtures/cj-freight.json'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
const order: OrderForCj = { id: 'NX-123456', email: 'nick@example.com', address: { name: 'Nick M', line1: '1 Test St', line2: 'Unit 2', city: 'Sydney', region: 'NSW', postcode: '2000', country: 'AU', phone: '+61400000000' }, lines: [{ vid: 'V-AU', qty: 2 }], shipping: { logisticName: 'CJPacket Ordinary' } }

function cjWith(handler: (url: string, init?: RequestInit) => Response) {
  const calls: { url: string; init?: RequestInit }[] = []
  const cj = createCjOffice({ apiKey: 'k', fetch: (async (url: string, init?: RequestInit) => { calls.push({ url, init }); return url.includes('getAccessToken') ? json({ result: true, data: { accessToken: 't' } }) : handler(url, init) }) as typeof fetch, sleep: async () => {} })
  return { cj, calls, body: (i: number) => JSON.parse(String(calls[i].init?.body)) }
}

describe('cj office', () => {
  it('createOrder sends the documented fields', async () => {
    const h = cjWith(() => json(create))
    const id = await h.cj.createOrder(order)
    expect(id).toBe('CJ-ORDER-1')
    const b = h.body(1)
    expect(b).toMatchObject({ orderNumber: 'NX-123456', shippingCustomerName: 'Nick M', shippingPhone: '+61400000000', shippingAddress: '1 Test St', shippingAddress2: 'Unit 2', shippingCity: 'Sydney', shippingProvince: 'NSW', shippingZip: '2000', shippingCountryCode: 'AU', shippingCountry: 'Australia', email: 'nick@example.com', fromCountryCode: 'CN', logisticName: 'CJPacket Ordinary', remark: 'NEXUS', products: [{ vid: 'V-AU', quantity: 2 }] })
    expect(h.calls[1].url).toContain('/shopping/order/createOrderV2')
    expect(h.calls[1].init?.method).toBe('POST')
  })
  it('province falls back to the city and the id can come from data.orderId', async () => {
    const h = cjWith(() => json({ result: true, data: { orderId: 'CJ-2' } }))
    const id = await h.cj.createOrder({ ...order, address: { ...order.address, region: '', country: 'GB', city: 'London', postcode: 'SW1A 1AA' } })
    expect(id).toBe('CJ-2')
    expect(h.body(1)).toMatchObject({ shippingProvince: 'London', shippingCountry: 'United Kingdom', shippingCountryCode: 'GB' })
  })
  it('confirmOrder is a PATCH and payBalance falls back to the second path on 404', async () => {
    const h = cjWith((url) => url.includes('/shopping/pay/payBalance') ? json({ result: false, code: 404, message: 'not found' }, 404) : json({ result: true, data: true }))
    await h.cj.confirmOrder('CJ-ORDER-1')
    expect(h.calls[1].init?.method).toBe('PATCH')
    expect(h.calls[1].url).toContain('/shopping/order/confirmOrder')
    expect(h.body(1)).toEqual({ orderId: 'CJ-ORDER-1' })
    await h.cj.payBalance('CJ-ORDER-1')
    expect(h.calls[2].url).toContain('/shopping/pay/payBalance')
    expect(h.calls[3].url).toContain('/shopping/payment/payBalance')
  })
  it('orderDetail maps the fixture', async () => {
    const h = cjWith(() => json(detail))
    expect(await h.cj.orderDetail('CJ-ORDER-1')).toEqual({ status: 'SHIPPED', trackNumber: 'CJPK123456789', logisticName: 'CJPacket Ordinary' })
    expect(h.calls[1].url).toContain('/shopping/order/getOrderDetail?orderId=CJ-ORDER-1')
  })
  it('auth reports a bad key as false and signs in again on the next call', async () => {
    let ok = false
    const calls: string[] = []
    const cj = createCjOffice({ apiKey: 'k', fetch: (async (url: string) => { calls.push(url); return ok ? json({ result: true, data: { accessToken: 't' } }) : json({ result: false, message: 'bad key' }, 401) }) as typeof fetch, sleep: async () => {} })
    expect(await cj.auth()).toBe(false)
    ok = true
    expect(await cj.auth()).toBe(true)
    expect(await cj.auth()).toBe(true)
    expect(calls.filter((u) => u.includes('getAccessToken')).length).toBe(2)   // not three: the signed-in client is kept
  })
  it('the access token is shared through the store and refreshed only on an auth error', async () => {
    const mem = new Map<string, string>()
    const tokenStore = { get: async () => mem.get('t') ?? null, put: async (t: string) => { mem.set('t', t) }, clear: async () => { mem.delete('t') } }
    const calls: string[] = []
    let valid = true
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      calls.push(url)
      if (url.includes('getAccessToken')) return json({ result: true, data: { accessToken: 'tok' } })
      const token = (init?.headers as Record<string, string>)['CJ-Access-Token']
      if (!valid || token !== 'tok') return json({ result: false, code: 1600200, message: 'token expired' }, 401)
      return json(detail)
    }) as typeof fetch
    const a = createCjOffice({ apiKey: 'k', fetch: fetchImpl, sleep: async () => {}, tokenStore })
    await a.orderDetail('CJ-1')
    const b = createCjOffice({ apiKey: 'k', fetch: fetchImpl, sleep: async () => {}, tokenStore })   // a later request: fresh closure, same store
    await b.orderDetail('CJ-1')
    expect(calls.filter((u) => u.includes('getAccessToken')).length).toBe(1)
    valid = false
    const c = createCjOffice({ apiKey: 'k', fetch: fetchImpl, sleep: async () => {}, tokenStore })
    const fail = await c.orderDetail('CJ-1').catch((e) => e)
    expect(fail).toBeInstanceOf(Error)
    expect(calls.filter((u) => u.includes('getAccessToken')).length).toBe(2)   // cleared and re-authenticated once, then gave up
    expect(mem.get('t')).toBe('tok')
  })
  it('freight parses a quote and returns null on an empty list', async () => {
    const h = cjWith((url, init) => String(init?.body).includes('"endCountryCode":"AU"') ? json(freight) : json({ result: true, data: [] }))
    const q = await h.cj.freight('V-AU', 1, 'AU', '2000')
    expect(q?.cheapest.usd).toBe(22.05)
    expect(h.body(1)).toEqual({ startCountryCode: 'CN', endCountryCode: 'AU', zip: '2000', products: [{ quantity: 1, vid: 'V-AU' }] })
    expect(await h.cj.freight('V-AU', 1, 'NZ', '6011')).toBeNull()
  })
})

describe('getRate', () => {
  it('caches for 24 h and falls back in order', async () => {
    let t = Date.parse('2026-10-05T00:00:00Z')
    const kv = new MemoryKV({ now: () => t })
    let fetches = 0
    const ok = (async () => { fetches++; return json({ date: '2026-10-04', rates: { AUD: 1.515 } }) }) as typeof fetch
    expect(await getRate(kv, ok, new Date(t))).toEqual({ usdAud: 1.515, source: 'ecb', date: '2026-10-04' })
    expect(await getRate(kv, ok, new Date(t))).toEqual({ usdAud: 1.515, source: 'ecb', date: '2026-10-04' })
    expect(fetches).toBe(1)
    t += 25 * 3600 * 1000
    const down = (async () => json({}, 503)) as typeof fetch
    expect(await getRate(kv, down, new Date(t))).toMatchObject({ usdAud: 1.515, source: 'previous' })
    const empty = new MemoryKV({ now: () => t })
    expect(await getRate(empty, down, new Date(t))).toEqual({ usdAud: 1.52, source: 'fallback', date: '2026-10-06' })
  })
})
