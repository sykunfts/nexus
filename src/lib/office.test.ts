import { afterEach, describe, expect, it, vi } from 'vitest'

const ORDER = { id: 'NX-123456', createdAt: '2026-10-05T00:00:00.000Z', email: 'nick@example.com', address: { name: 'Nick M', line1: '1 Test St', city: 'Sydney', region: 'NSW', postcode: '2000', country: 'AU' }, lines: [{ productId: 'cj-P-A1', variantId: 'cj-V-AU', name: 'Mini Laser Projector', qty: 2, unitPrice: 95.95, vid: 'V-AU', origin: 'CN' }], shipping: { origin: 'CN', method: 'standard', logisticName: 'CJPacket Ordinary', aud: 33.95, days: [8, 15], fellBack: false }, tax: { amount: 20.53, included: true, label: 'Includes GST 10 %' }, subtotal: 191.9, total: 225.85, currency: 'AUD', stripe: { sessionId: 'cs_1', paymentIntentId: 'pi_1', paid: true }, state: 'shipped', supplier: { cjOrderId: 'CJ-1', placedAt: '2026-10-05T00:01:00.000Z', trackNumber: 'LX123', logisticName: 'CJPacket Ordinary' }, history: [] }

async function load(env?: string) {
  vi.resetModules()
  if (env !== undefined) vi.stubEnv('VITE_OFFICE_URL', env)
  return import('./office')
}
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

describe('office client', () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })
  it('is disabled without VITE_OFFICE_URL and enabled with it, trailing slash dropped', async () => {
    expect((await load()).office.enabled).toBe(false)
    const { office } = await load('https://office.test/')
    expect(office).toEqual({ enabled: true, url: 'https://office.test' })
  })
  it('startCheckout returns the url and turns a 422 into a typed error with the field', async () => {
    const calls: { url: string; init?: RequestInit }[] = []
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => { calls.push({ url, init }); return calls.length === 1 ? reply({ url: 'https://checkout.stripe.com/c/1' }) : reply({ error: 'bad_postcode', field: 'address.postcode' }, 422) })
    const { startCheckout, OfficeClientError } = await load('https://office.test')
    const body = { lines: [{ productId: 'cj-P-A1', variantId: 'cj-V-AU', qty: 1 }], email: 'n@x.com', address: { name: 'N', line1: '1 St', city: 'Sydney', region: 'NSW', postcode: '2000', country: 'AU' as const }, method: 'standard' as const }
    expect(await startCheckout(body)).toEqual({ url: 'https://checkout.stripe.com/c/1' })
    expect(calls[0].url).toBe('https://office.test/checkout')
    expect(calls[0].init?.method).toBe('POST')
    const err = await startCheckout(body).catch((e) => e)
    expect(err).toBeInstanceOf(OfficeClientError)
    expect(err).toMatchObject({ code: 'bad_postcode', field: 'address.postcode', status: 422 })
  })
  it('a network failure or a timeout is an offline error', async () => {
    vi.stubGlobal('fetch', async () => { throw new TypeError('Failed to fetch') })
    const { fetchOrder } = await load('https://office.test')
    const err = await fetchOrder('NX-1', 'n@x.com').catch((e) => e)
    expect(err).toMatchObject({ code: 'offline', status: 0 })
  })
  it('fetchOrder sends the email as a query and answers null on 404; by-session is null while pending', async () => {
    const urls: string[] = []
    vi.stubGlobal('fetch', async (url: string) => { urls.push(url); return url.includes('by-session') ? reply({ pending: true }, 202) : url.includes('NX-404') ? reply({ error: 'not_found' }, 404) : reply(ORDER) })
    const { fetchOrder, fetchOrderBySession } = await load('https://office.test')
    expect((await fetchOrder('NX-123456', 'Nick@Example.com'))?.id).toBe('NX-123456')
    expect(urls[0]).toBe('https://office.test/orders/NX-123456?email=nick%40example.com')
    expect(await fetchOrder('NX-404', 'n@x.com')).toBeNull()
    expect(await fetchOrderBySession('cs_1')).toBeNull()
    expect(urls[2]).toBe('https://office.test/orders/by-session/cs_1')
  })
  it('notifyMe posts the pair and the admin client sends the stored bearer token', async () => {
    const calls: { url: string; init?: RequestInit }[] = []
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => { calls.push({ url, init }); return reply({ ok: true, orders: [] }) })
    const store = new Map<string, string>()
    vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v) }, removeItem: (k: string) => { store.delete(k) } })
    const { notifyMe, admin } = await load('https://office.test')
    await notifyMe('oura-ring-5', 'a@b.co')
    expect(calls[0]).toMatchObject({ url: 'https://office.test/notify' })
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ productId: 'oura-ring-5', email: 'a@b.co' })
    expect(admin.token()).toBeNull()
    admin.setToken('tok')
    expect(store.get('nexus.office.token')).toBe('tok')
    await admin.get('/admin/orders')
    expect((calls[1].init?.headers as Record<string, string>).Authorization).toBe('Bearer tok')
    await admin.post('/admin/orders/NX-1/refunded', { note: 'x' })
    expect(calls[2].init?.method).toBe('POST')
  })
  it('toShopOrder maps an office order onto the shop order shape with the fulfilment state', async () => {
    const { toShopOrder } = await load('https://office.test')
    const o = toShopOrder(ORDER as never)
    expect(o).toMatchObject({ id: 'NX-123456', placedAt: ORDER.createdAt, email: 'nick@example.com', address: { name: 'Nick M', country: 'AU', isDefault: false }, totals: { subtotal: 191.9, shipping: 33.95, tax: 20.53, taxIncluded: true, taxLabel: 'Includes GST 10 %', total: 225.85, currency: 'AUD' }, compat: { status: 'ok', issues: [] }, office: { state: 'shipped', sessionId: 'cs_1', cjOrderId: 'CJ-1', trackNumber: 'LX123', logisticName: 'CJPacket Ordinary' } })
    expect(o.lines[0]).toMatchObject({ productId: 'cj-P-A1', name: 'Mini Laser Projector', qty: 2, unitPrice: 95.95, origin: 'CN', visual: 'device' })
    expect(o.shipments).toEqual([{ origin: 'CN', zone: 'AU', method: 'standard', lineKeys: [o.lines[0].key], etaDays: [8, 15], cost: 33.95 }])
  })
})
