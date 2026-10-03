import { describe, expect, it } from 'vitest'
import { createSession, sessionParams, sign, verifyWebhook, type Draft } from '../src/stripe'
import { OfficeError } from '../src/errors'

const quote = { lines: [{ productId: 'cj-P-A1', variantId: 'cj-V-AU', name: 'Mini Laser Projector', qty: 1, unitPrice: 95.95, vid: 'V-AU', origin: 'CN' }], subtotal: 95.95,
  shipping: { origin: 'CN' as const, method: 'standard' as const, logisticName: 'CJPacket Ordinary', aud: 9.95, days: [8, 15] as [number, number], fellBack: false }, tax: { amount: 9.63, included: true, label: 'Includes GST 10 %' }, total: 105.9 }
const draft: Draft = { id: 'd_abc', email: 'nick@example.com', address: { name: 'Nick', line1: '1 St', city: 'Sydney', region: 'NSW', postcode: '2000', country: 'AU' }, quote, createdAt: '2026-10-05T00:00:00.000Z' }
const site = 'https://sykunfts.github.io/nexus/'

describe('stripe', () => {
  it('sessionParams encodes lines, shipping and tax in cents', () => {
    const p = sessionParams(draft, site, 1_800_000_000)
    expect(p.get('mode')).toBe('payment')
    expect(p.get('line_items[0][price_data][currency]')).toBe('aud')
    expect(p.get('line_items[0][price_data][unit_amount]')).toBe('9595')
    expect(p.get('line_items[0][price_data][product_data][name]')).toBe('Mini Laser Projector')
    expect(p.get('line_items[0][price_data][product_data][description]')).toBe('Includes GST 10 %')
    expect(p.get('line_items[0][quantity]')).toBe('1')
    expect(p.get('line_items[1][price_data][product_data][name]')).toBe('Shipping: CJPacket Ordinary')
    expect(p.get('line_items[1][price_data][unit_amount]')).toBe('995')
    expect(p.get('line_items[2][quantity]')).toBeNull()   // GST is included: no tax line
    const gb = sessionParams({ ...draft, address: { ...draft.address, country: 'GB' }, quote: { ...quote, tax: { amount: 21.18, included: false, label: 'VAT 20 %' }, total: 127.08 } }, site, 1_800_000_000)
    expect(gb.get('line_items[2][price_data][product_data][name]')).toBe('VAT 20 %')
    expect(gb.get('line_items[2][price_data][unit_amount]')).toBe('2118')
  })
  it('sessionParams carries the draft id and the return addresses', () => {
    const p = sessionParams(draft, site, 1_800_000_000)
    expect(p.get('client_reference_id')).toBe('d_abc')
    expect(p.get('metadata[draftId]')).toBe('d_abc')
    expect(p.get('customer_email')).toBe('nick@example.com')
    expect(p.get('success_url')).toBe('https://sykunfts.github.io/nexus/#/orders/confirmed?session={CHECKOUT_SESSION_ID}')
    expect(p.get('cancel_url')).toBe('https://sykunfts.github.io/nexus/#/checkout')
    expect(p.get('expires_at')).toBe(String(1_800_000_000 + 2100))   // 35 min: Stripe's floor is 30 and it checks on its own clock
  })
  it('createSession returns id and url, 502 on failure', async () => {
    const calls: { url: string; init?: RequestInit }[] = []
    const ok = (async (url: string, init?: RequestInit) => { calls.push({ url, init }); return new Response(JSON.stringify({ id: 'cs_test_1', url: 'https://checkout.stripe.com/c/pay/cs_test_1' }), { status: 200 }) }) as typeof fetch
    const s = await createSession(ok, 'sk_test_x', draft, site, new Date(1_800_000_000 * 1000))
    expect(s).toEqual({ id: 'cs_test_1', url: 'https://checkout.stripe.com/c/pay/cs_test_1' })
    expect(calls[0].url).toBe('https://api.stripe.com/v1/checkout/sessions')
    expect((calls[0].init?.headers as Record<string, string>).Authorization).toBe('Bearer sk_test_x')
    expect((calls[0].init?.headers as Record<string, string>)['Content-Type']).toBe('application/x-www-form-urlencoded')
    const down = (async () => new Response('{"error":{"message":"nope"}}', { status: 500 })) as typeof fetch
    await expect(createSession(down, 'sk', draft, site, new Date())).rejects.toMatchObject({ status: 502, code: 'stripe_unavailable' } satisfies Partial<OfficeError>)
  })
  it('verifyWebhook accepts a valid signature and rejects a tampered body and a stale timestamp', async () => {
    const body = JSON.stringify({ id: 'evt_1', type: 'checkout.session.completed', data: { object: { id: 'cs_1', payment_status: 'paid' } } })
    const secret = 'whsec_test'
    const now = new Date(1_800_000_000 * 1000)
    const ts = 1_800_000_000 - 10
    const sig = await sign(body, secret, ts)
    const ev = await verifyWebhook(body, `t=${ts},v1=${sig}`, secret, now)
    expect(ev.type).toBe('checkout.session.completed')
    expect(ev.data.object.id).toBe('cs_1')
    await expect(verifyWebhook(body.replace('paid', 'unpaid'), `t=${ts},v1=${sig}`, secret, now)).rejects.toMatchObject({ status: 400, code: 'bad_signature' })
    const old = 1_800_000_000 - 301
    await expect(verifyWebhook(body, `t=${old},v1=${await sign(body, secret, old)}`, secret, now)).rejects.toMatchObject({ code: 'bad_signature' })
    await expect(verifyWebhook(body, null, secret, now)).rejects.toMatchObject({ code: 'bad_signature' })
  })
})
