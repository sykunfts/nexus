import { describe, expect, it } from 'vitest'
import { MemoryKV } from '../src/kv'
import { createOffice, type OfficeDeps } from '../src/office'
import { sign } from '../src/stripe'
import type { CjOffice } from '../src/cj'
import type { Mailer } from '../src/email'
import type { CatalogueProduct } from '../src/catalogue.generated'
import freightFixture from '../../radar/test/fixtures/cj-freight.json'
import { parseFreight } from '../../radar/src/cj/parse'

const SITE = 'https://sykunfts.github.io/nexus/'
const ENV = { SITE_URL: SITE, FROM_EMAIL: 'orders@example.com', EMAIL_ENABLED: '0', ADMIN_EMAIL: 'nick@example.com', CJ_DRY_RUN: '1', STRIPE_SECRET_KEY: 'sk_test_1', STRIPE_WEBHOOK_SECRET: 'whsec_1', CJ_API_KEY: 'cj', RESEND_API_KEY: '', ADMIN_TOKEN: 'secret-token' }
const catalogue: CatalogueProduct[] = [
  { id: 'cj-P-A1', name: 'Mini Laser Projector', brand: 'Nexus Select', category: 'Home cinema', price: 95.95, variants: [{ id: 'cj-V-AU', label: 'AU Plug', delta: 0 }], fulfil: { route: 'supplier', origin: 'CN' }, supplier: { url: 'u', pid: 'P-A1', vid: 'V-AU', costUsd: 62.4, termId: 'laser-projector' }, sellable: true },
  { id: 'oura-ring-5', name: 'Oura Ring', brand: 'Oura', category: 'Wearables', price: 549, variants: [{ id: 'silver', label: 'Silver', delta: 0 }], fulfil: { route: 'warehouse', origin: 'AU' }, sellable: false },
]
const body = { lines: [{ productId: 'cj-P-A1', variantId: 'cj-V-AU', qty: 1 }], email: 'Nick@Example.com', address: { name: 'Nick M', line1: '1 Test St', city: 'Sydney', region: 'NSW', postcode: '2000', country: 'AU', phone: '+61 400 000 000' }, method: 'standard' }

function harness(over: Partial<OfficeDeps> & { stripeDown?: boolean; background?: boolean } = {}) {
  let t = Date.parse('2026-10-05T00:00:00Z')
  const kv = new MemoryKV({ now: () => t })
  const stripeCalls: string[] = []
  const fetchImpl = (async (url: string, init?: RequestInit) => {
    if (url.startsWith('https://api.stripe.com/')) { stripeCalls.push(String(init?.body)); return over.stripeDown ? new Response('{}', { status: 500 }) : new Response(JSON.stringify({ id: 'cs_test_1', url: 'https://checkout.stripe.com/c/pay/cs_test_1' }), { status: 200 }) }
    if (url.includes('frankfurter')) return new Response(JSON.stringify({ date: '2026-10-04', rates: { AUD: 1.515 } }), { status: 200 })
    return new Response('{}', { status: 404 })
  }) as typeof fetch
  const cjCalls: string[] = []
  const cj: CjOffice = {
    auth: async () => { cjCalls.push('auth'); return true },
    freight: async () => { cjCalls.push('freight'); return parseFreight(freightFixture) },
    createOrder: async () => { cjCalls.push('create'); return 'CJ-1' },
    confirmOrder: async () => { cjCalls.push('confirm') },
    payBalance: async () => { cjCalls.push('pay') },
    orderDetail: async () => ({ status: 'PROCESSING' }),
  }
  const mails: string[] = []
  const mailer: Mailer = { confirmation: async (o) => { mails.push(`confirmation:${o.id}`) }, shipped: async () => {}, attention: async (o) => { mails.push(`attention:${o.id}`) } }
  const office = createOffice({ kv, env: ENV, fetch: fetchImpl, now: () => new Date(t), random: () => 0.5, cj, mailer, catalogue, log: () => {}, ...over })
  const tasks: Promise<unknown>[] = []
  const waitUntil = over.background ? (p: Promise<unknown>) => { tasks.push(p) } : undefined
  const call = (path: string, init: RequestInit & { ip?: string } = {}) => office.fetch(new Request(`https://nexus-office.test${path}`, { ...init, headers: { 'content-type': 'application/json', Origin: 'https://sykunfts.github.io', 'CF-Connecting-IP': init.ip ?? '1.1.1.1', ...(init.headers as Record<string, string> | undefined) } }), waitUntil)
  const post = (path: string, json: unknown, init: RequestInit & { ip?: string } = {}) => call(path, { method: 'POST', body: JSON.stringify(json), ...init })
  const webhook = async (session: Record<string, unknown>, eventId = 'evt_1', type = 'checkout.session.completed') => {
    const raw = JSON.stringify({ id: eventId, type, data: { object: session } })
    const ts = Math.floor(t / 1000)
    return office.fetch(new Request('https://nexus-office.test/stripe/webhook', { method: 'POST', body: raw, headers: { 'Stripe-Signature': `t=${ts},v1=${await sign(raw, ENV.STRIPE_WEBHOOK_SECRET, ts)}` } }), waitUntil)
  }
  return { office, kv, cj, call, post, webhook, stripeCalls, cjCalls, mails, tasks, advance: (ms: number) => { t += ms } }
}

describe('office handlers', () => {
  it('OPTIONS and responses carry CORS for the site origin only', async () => {
    const h = harness()
    const pre = await h.call('/checkout', { method: 'OPTIONS' })
    expect(pre.status).toBe(204)
    expect(pre.headers.get('access-control-allow-origin')).toBe('https://sykunfts.github.io')
    const other = await h.office.fetch(new Request('https://nexus-office.test/health', { headers: { Origin: 'https://evil.example' } }))
    expect(other.headers.get('access-control-allow-origin')).toBeNull()
  })
  it('/checkout prices from the catalogue, writes a draft and returns the Stripe url', async () => {
    const h = harness()
    const res = await h.post('/checkout', body)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ url: 'https://checkout.stripe.com/c/pay/cs_test_1' })
    const params = new URLSearchParams(h.stripeCalls[0])
    expect(params.get('line_items[0][price_data][unit_amount]')).toBe('9595')
    expect(params.get('line_items[1][price_data][unit_amount]')).toBe('3395')   // 22.05 USD × 1.515 → 33.41 → 33.95
    const draftId = params.get('metadata[draftId]')!
    expect(JSON.parse((await h.kv.get(`draft:${draftId}`))!)).toMatchObject({ email: 'nick@example.com', quote: { total: 129.9 } })
    expect(h.cjCalls).toEqual(['freight'])
  })
  it('/freight answers the quote without writing a draft', async () => {
    const h = harness()
    const res = await h.post('/freight', { lines: body.lines, address: { country: 'AU', postcode: '2000' }, method: 'express' })
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ shipping: { logisticName: 'DHL Express', aud: 73.95, method: 'express' }, fellBack: false })
    expect((await h.kv.list({ prefix: 'draft:' })).keys.length).toBe(0)
  })
  it('/checkout refuses a bad email, a bad postcode, a not-sellable line and qty 11 with the field named', async () => {
    const h = harness()
    expect(await (await h.post('/checkout', { ...body, email: 'nope' })).json()).toMatchObject({ error: 'bad_email', field: 'email' })
    expect(await (await h.post('/checkout', { ...body, address: { ...body.address, postcode: '99' } })).json()).toMatchObject({ error: 'bad_postcode', field: 'address.postcode' })
    expect(await (await h.post('/checkout', { ...body, lines: [{ productId: 'oura-ring-5', variantId: 'silver', qty: 1 }] })).json()).toMatchObject({ error: 'not_sellable', field: 'lines[0]' })
    const r = await h.post('/checkout', { ...body, lines: [{ ...body.lines[0], qty: 11 }] })
    expect(r.status).toBe(422)
    expect(await r.json()).toMatchObject({ error: 'bad_qty', field: 'lines[0]' })
  })
  it('/checkout answers 502 stripe_unavailable when Stripe is down', async () => {
    const h = harness({ stripeDown: true })
    const r = await h.post('/checkout', body)
    expect(r.status).toBe(502)
    expect(await r.json()).toMatchObject({ error: 'stripe_unavailable' })
  })
  it('a paid webhook creates the order and fulfils it; a duplicate delivery is a no-op', async () => {
    const h = harness()
    const params = new URLSearchParams(h.stripeCalls[0] ?? (await h.post('/checkout', body), h.stripeCalls[0]))
    const draftId = params.get('metadata[draftId]')!
    const session = { id: 'cs_test_1', payment_status: 'paid', payment_intent: 'pi_1', client_reference_id: draftId, metadata: { draftId }, amount_total: 12990 }
    expect((await h.webhook(session)).status).toBe(200)
    expect((await h.webhook(session, 'evt_2')).status).toBe(200)
    const orders = (await h.kv.list({ prefix: 'order:' })).keys
    expect(orders.length).toBe(1)
    expect(h.cjCalls.filter((c) => c === 'create').length).toBe(1)
    const bySession = await (await h.call('/orders/by-session/cs_test_1')).json() as { id: string; state: string }
    expect(bySession.state).toBe('placed_with_supplier')
    expect(h.mails).toEqual([`confirmation:${bySession.id}`])
  })
  it('a webhook without its draft still records the order as needs_attention', async () => {
    const h = harness()
    const session = { id: 'cs_lost', payment_status: 'paid', payment_intent: 'pi_9', client_reference_id: 'd_gone', metadata: { draftId: 'd_gone' }, customer_email: 'lost@example.com', amount_total: 10590 }
    expect((await h.webhook(session)).status).toBe(200)
    const o = await (await h.call('/orders/by-session/cs_lost')).json() as { state: string; attention: { reason: string }; total: number; email: string }
    expect(o.state).toBe('needs_attention')
    expect(o.attention.reason).toBe('draft_missing')
    expect(o.total).toBe(105.9)
    expect(h.cjCalls).toEqual([])
    expect(h.mails[0]).toMatch(/^attention:/)
  })
  it('a tampered webhook is 400 and an unpaid session is ignored', async () => {
    const h = harness()
    const raw = JSON.stringify({ id: 'evt_x', type: 'checkout.session.completed', data: { object: { id: 'cs_x', payment_status: 'paid' } } })
    const bad = await h.office.fetch(new Request('https://nexus-office.test/stripe/webhook', { method: 'POST', body: raw, headers: { 'Stripe-Signature': 't=1,v1=deadbeef' } }))
    expect(bad.status).toBe(400)
    expect((await h.webhook({ id: 'cs_unpaid', payment_status: 'unpaid' })).status).toBe(200)
    expect((await h.kv.list({ prefix: 'order:' })).keys.length).toBe(0)
  })
  it('/orders/:id needs the right email; /orders/by-session is pending until the webhook lands', async () => {
    const h = harness()
    expect((await h.call('/orders/by-session/cs_test_1')).status).toBe(202)
    await h.post('/checkout', body)
    const draftId = new URLSearchParams(h.stripeCalls[0]).get('metadata[draftId]')!
    await h.webhook({ id: 'cs_test_1', payment_status: 'paid', payment_intent: 'pi_1', client_reference_id: draftId, metadata: { draftId }, amount_total: 12990 })
    const { id } = await (await h.call('/orders/by-session/cs_test_1')).json() as { id: string }
    expect((await h.call(`/orders/${id}?email=${encodeURIComponent('  NICK@example.com ')}`)).status).toBe(200)
    expect((await h.call(`/orders/${id}?email=someone@else.com`)).status).toBe(404)
    expect((await h.call(`/orders/${id}`)).status).toBe(404)
  })
  it('/notify stores once per email and validates', async () => {
    const h = harness()
    expect((await h.post('/notify', { productId: 'oura-ring-5', email: 'a@b.co' })).status).toBe(200)
    expect((await h.post('/notify', { productId: 'oura-ring-5', email: 'A@b.co' })).status).toBe(200)
    expect((await h.kv.list({ prefix: 'notify:' })).keys.length).toBe(1)
    expect((await h.post('/notify', { productId: 'nope', email: 'a@b.co' })).status).toBe(422)
    expect((await h.post('/notify', { productId: 'oura-ring-5', email: 'bad' })).status).toBe(422)
  })
  it('rate limit returns 429 on the 6th notify call from one address in a minute', async () => {
    const h = harness()
    for (let i = 0; i < 5; i++) expect((await h.post('/notify', { productId: 'oura-ring-5', email: `u${i}@b.co` }, { ip: '9.9.9.9' })).status).toBe(200)
    expect((await h.post('/notify', { productId: 'oura-ring-5', email: 'u6@b.co' }, { ip: '9.9.9.9' })).status).toBe(429)
    expect((await h.post('/notify', { productId: 'oura-ring-5', email: 'u7@b.co' }, { ip: '8.8.8.8' })).status).toBe(200)
    h.advance(61_000)
    expect((await h.post('/notify', { productId: 'oura-ring-5', email: 'u8@b.co' }, { ip: '9.9.9.9' })).status).toBe(200)
  })
  it('admin without the token is 401; with it lists orders, the notify list, retries a stuck one and records a refund', async () => {
    const h = harness()
    expect((await h.call('/admin/orders')).status).toBe(401)
    expect((await h.call('/admin/orders', { headers: { Authorization: 'Bearer wrong' } })).status).toBe(401)
    const auth = { headers: { Authorization: 'Bearer secret-token' } }
    h.cj.createOrder = async () => { throw new Error('insufficient balance') }
    await h.post('/checkout', body)
    const draftId = new URLSearchParams(h.stripeCalls[0]).get('metadata[draftId]')!
    await h.webhook({ id: 'cs_test_1', payment_status: 'paid', payment_intent: 'pi_1', client_reference_id: draftId, metadata: { draftId }, amount_total: 12990 })
    await h.post('/notify', { productId: 'oura-ring-5', email: 'a@b.co' })
    const list = await (await h.call('/admin/orders', auth)).json() as { orders: { id: string; state: string }[] }
    expect(list.orders.length).toBe(1)
    expect(list.orders[0].state).toBe('needs_attention')
    const id = list.orders[0].id
    expect((await (await h.call(`/admin/orders/${id}`, auth)).json() as { id: string }).id).toBe(id)
    expect((await h.call('/admin/orders/NX-000000', auth)).status).toBe(404)
    const notify = await (await h.call('/admin/notify', auth)).json() as { products: { productId: string; count: number; emails: string[] }[] }
    expect(notify.products).toEqual([{ productId: 'oura-ring-5', count: 1, emails: ['a@b.co'] }])
    h.cj.createOrder = async () => { h.cjCalls.push('create'); return 'CJ-1' }
    const retry = await h.post(`/admin/orders/${id}/retry`, {}, auth)
    expect(retry.status).toBe(200)
    expect((await retry.json() as { state: string }).state).toBe('placed_with_supplier')
    const again = await h.post(`/admin/orders/${id}/retry`, {}, auth)
    expect(again.status).toBe(409)   // already with CJ: a second fulfil could pay twice
    expect(h.cjCalls.filter((c) => c === 'create').length).toBe(1)
    const refunded = await h.post(`/admin/orders/${id}/refunded`, { note: 'refunded in Stripe' }, auth)
    expect(await refunded.json()).toMatchObject({ state: 'refunded', history: expect.arrayContaining([expect.objectContaining({ state: 'refunded', note: 'refunded in Stripe' })]) })
    expect((await h.call('/admin/orders?state=refunded', auth)).status).toBe(200)
    expect((await (await h.call('/admin/orders?state=paid', auth)).json() as { orders: unknown[] }).orders.length).toBe(0)
    expect((await h.call('/admin/orders', { ...auth, headers: { ...auth.headers, Origin: 'https://evil.example' } })).headers.get('access-control-allow-origin')).toBeNull()
    expect((await h.call('/admin/orders', { ...auth, headers: { ...auth.headers, Origin: 'https://sykunfts.github.io' } })).headers.get('access-control-allow-origin')).toBe('https://sykunfts.github.io')   // the Orders tab is cross-origin
    const pre = await h.call('/admin/orders', { method: 'OPTIONS' })
    expect(pre.headers.get('access-control-allow-origin')).toBe('https://sykunfts.github.io')
    expect(pre.headers.get('access-control-allow-headers')).toMatch(/authorization/i)
  })
  it('/checkout refuses a missing phone with the field named (CJ needs one for the carrier)', async () => {
    const h = harness()
    const r = await h.post('/checkout', { ...body, address: { ...body.address, phone: '' } })
    expect(r.status).toBe(422)
    expect(await r.json()).toMatchObject({ error: 'bad_phone', field: 'address.phone' })
  })
  it('with a waitUntil the webhook answers Stripe before fulfilment runs', async () => {
    const h = harness({ background: true })
    let release!: () => void
    const gate = new Promise<void>((r) => { release = r })                   // CJ is slow; Stripe must not wait for it
    h.cj.createOrder = async () => { await gate; h.cjCalls.push('create'); return 'CJ-1' }
    await h.post('/checkout', body)
    const draftId = new URLSearchParams(h.stripeCalls[0]).get('metadata[draftId]')!
    const res = await h.webhook({ id: 'cs_test_1', payment_status: 'paid', payment_intent: 'pi_1', client_reference_id: draftId, metadata: { draftId }, amount_total: 12990 })
    expect(res.status).toBe(200)
    expect((await (await h.call('/orders/by-session/cs_test_1')).json() as { state: string }).state).toBe('paid')   // recorded before CJ is touched
    expect(h.cjCalls).not.toContain('create')
    expect(h.tasks.length).toBe(1)
    release()
    await Promise.all(h.tasks)
    expect(h.cjCalls).toContain('create')
    expect((await (await h.call('/orders/by-session/cs_test_1')).json() as { state: string }).state).toBe('placed_with_supplier')
  })
  it('the order id is derived from the session so a duplicate in flight lands on the same record', async () => {
    const h = harness()
    await h.post('/checkout', body)
    const draftId = new URLSearchParams(h.stripeCalls[0]).get('metadata[draftId]')!
    await h.webhook({ id: 'cs_test_1', payment_status: 'paid', payment_intent: 'pi_1', client_reference_id: draftId, metadata: { draftId }, amount_total: 12990 })
    const { id } = await (await h.call('/orders/by-session/cs_test_1')).json() as { id: string }
    const { OrderStore } = await import('../src/orders')
    const other = new OrderStore(new MemoryKV(), () => new Date(), () => 0.1)
    expect(await other.newId('cs_test_1')).toBe(id)
    expect(await other.newId('cs_test_2')).not.toBe(id)
  })
  it('a draft that arrives late is picked up by the cron and the order fulfilled', async () => {
    const h = harness()
    await h.post('/checkout', body)
    const draftId = new URLSearchParams(h.stripeCalls[0]).get('metadata[draftId]')!
    const draft = (await h.kv.get(`draft:${draftId}`))!
    await h.kv.delete(`draft:${draftId}`)                                   // not yet visible at the webhook's colo
    await h.webhook({ id: 'cs_test_1', payment_status: 'paid', payment_intent: 'pi_1', client_reference_id: draftId, metadata: { draftId }, customer_email: 'nick@example.com', amount_total: 12990 })
    let o = await (await h.call('/orders/by-session/cs_test_1')).json() as { state: string; attention: { reason: string; attempts: number }; lines: unknown[] }
    expect(o.state).toBe('needs_attention'); expect(o.attention.reason).toBe('draft_missing'); expect(o.lines).toEqual([])
    await h.kv.put(`draft:${draftId}`, draft)                               // propagation caught up
    await h.office.scheduled()
    o = await (await h.call('/orders/by-session/cs_test_1')).json() as typeof o
    expect(o.state).toBe('placed_with_supplier')
    expect(o.lines.length).toBe(1)
    expect(h.cjCalls.filter((c) => c === 'create').length).toBe(1)
    expect(h.mails.filter((m) => m.startsWith('confirmation:')).length).toBe(1)
  })
  it('an async payment that succeeds later creates the order like a card payment', async () => {
    const h = harness()
    await h.post('/checkout', body)
    const draftId = new URLSearchParams(h.stripeCalls[0]).get('metadata[draftId]')!
    const session = { id: 'cs_async', payment_status: 'unpaid', payment_intent: 'pi_a', client_reference_id: draftId, metadata: { draftId }, amount_total: 12990 }
    expect((await h.webhook(session, 'evt_a1')).status).toBe(200)
    expect((await h.kv.list({ prefix: 'order:' })).keys.length).toBe(0)
    expect((await h.webhook({ ...session, payment_status: 'paid' }, 'evt_a2', 'checkout.session.async_payment_succeeded')).status).toBe(200)
    expect((await h.kv.list({ prefix: 'order:' })).keys.length).toBe(1)
  })
  it('/health reports stripe mode, email, CJ auth (cached) and the last cron', async () => {
    const h = harness()
    const health = await (await h.call('/health')).json() as Record<string, unknown>
    expect(health).toMatchObject({ ok: true, kv: true, stripeMode: 'test', emailEnabled: false, dryRun: true, cjAuth: true, cronLast: null })
    await h.office.scheduled()
    expect((await (await h.call('/health')).json() as { cronLast: unknown }).cronLast).not.toBeNull()
    expect(h.cjCalls.filter((c) => c === 'auth').length).toBe(1)
    expect((await (await h.call('/admin/health', { headers: { Authorization: 'Bearer secret-token' } })).json() as { cjAuth: boolean }).cjAuth).toBe(true)
  })
})
