// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import sample from './fixtures/radar.sample.json'

const base = { email: 'nick@example.com', address: { name: 'Nick M', line1: '1 Test St', city: 'Sydney', region: 'NSW', postcode: '2000', country: 'AU' }, lines: [{ productId: 'cj-P-A1', variantId: 'cj-V-AU', name: 'Mini Laser Projector', qty: 1, unitPrice: 95.95, vid: 'V-AU', origin: 'CN' }], shipping: { origin: 'CN', method: 'standard', logisticName: 'CJPacket Ordinary', aud: 33.95, days: [8, 15], fellBack: false }, tax: { amount: 11.81, included: true, label: 'Includes GST 10 %' }, subtotal: 95.95, total: 129.9, currency: 'AUD', history: [] }
const ORDERS = [
  { ...base, id: 'NX-000003', createdAt: '2026-10-05T03:00:00.000Z', state: 'paid', stripe: { sessionId: 'cs_3', paymentIntentId: 'pi_3', paid: true } },
  { ...base, id: 'NX-000002', createdAt: '2026-10-05T02:00:00.000Z', state: 'needs_attention', stripe: { sessionId: 'cs_2', paymentIntentId: 'pi_2', paid: true }, attention: { reason: 'cj_pay_failed', at: '2026-10-05T02:00:10.000Z', lastError: 'insufficient balance', attempts: 1, nextRetryAt: '2026-10-06T02:00:10.000Z' }, supplier: { cjOrderId: 'CJ-2', placedAt: '2026-10-05T02:00:05.000Z' } },
  { ...base, id: 'NX-000001', createdAt: '2026-10-05T01:00:00.000Z', state: 'shipped', stripe: { sessionId: 'cs_1', paymentIntentId: 'pi_1', paid: true }, supplier: { cjOrderId: 'CJ-1', placedAt: '2026-10-05T01:00:05.000Z', trackNumber: 'LX1', logisticName: 'CJPacket Ordinary' } },
]
const HEALTH = { ok: true, kv: true, stripeMode: 'test', cjAuth: true, emailEnabled: false, dryRun: true, cronLast: { at: '2026-10-05T04:00:00.000Z', synced: 2, retried: 0, errors: [] }, catalogueSellable: 1 }

function officeFetch(over: Partial<Record<string, (init?: RequestInit) => unknown>> = {}) {
  const calls: { path: string; method: string; auth: string | null }[] = []
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    const path = url.replace('https://office.test', '').split('?')[0]
    const headers = init?.headers as Record<string, string> | undefined
    calls.push({ path, method: init?.method ?? 'GET', auth: headers?.Authorization ?? null })
    if (headers?.Authorization !== 'Bearer secret') return new Response('{"error":"unauthorised"}', { status: 401 })
    const body = over[path]?.(init) ?? (path === '/admin/health' ? HEALTH : path === '/admin/orders' ? { orders: ORDERS } : path === '/admin/notify' ? { products: [{ productId: 'oura-ring-5', count: 2, emails: ['a@b.co', 'c@d.co'] }] } : path.endsWith('/retry') ? { ...ORDERS[1], state: 'placed_with_supplier' } : path.endsWith('/refunded') ? { ...ORDERS[1], state: 'refunded' } : null)
    return body === null ? new Response('{"error":"not_found"}', { status: 404 }) : new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })
  })
  return calls
}

async function mount(hash = '#orders') {
  vi.resetModules()
  vi.doMock('../../data/radar.json', () => ({ default: sample }))
  window.history.replaceState(null, '', `/radar.html${hash}`)
  const { RadarApp } = await import('./RadarApp')
  await act(async () => { render(<RadarApp />) })
}

describe('Radar orders tab', () => {
  afterEach(() => { cleanup(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); window.localStorage.clear() })
  it('asks for the token, then lists orders newest first with needs-attention first', async () => {
    vi.stubEnv('VITE_OFFICE_URL', 'https://office.test')
    const calls = officeFetch()
    await mount()
    const input = await screen.findByLabelText(/Admin token/)
    fireEvent.change(input, { target: { value: 'secret' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Open' })) })
    const rows = await screen.findAllByRole('row', { name: /NX-/ })
    expect(rows.map((r) => within(r).getByText(/NX-\d+/).textContent)).toEqual(['NX-000002', 'NX-000003', 'NX-000001'])
    expect(within(rows[0]).getByText(/insufficient balance/)).toBeTruthy()
    expect(within(rows[2]).getByRole('link', { name: /LX1/ }).getAttribute('href')).toContain('17track')
    expect(window.localStorage.getItem('nexus.office.token')).toBe('secret')
    expect(calls.every((c) => c.auth === 'Bearer secret')).toBe(true)
    expect(screen.getByText('oura-ring-5')).toBeTruthy()
    expect(screen.getByText(/a@b.co/)).toBeTruthy()
  })
  it('Retry posts to the retry endpoint and refreshes', async () => {
    vi.stubEnv('VITE_OFFICE_URL', 'https://office.test')
    window.localStorage.setItem('nexus.office.token', 'secret')
    const calls = officeFetch()
    await mount()
    const row = (await screen.findAllByRole('row', { name: /NX-000002/ }))[0]
    await act(async () => { fireEvent.click(within(row).getByRole('button', { name: 'Retry' })) })
    expect(calls.some((c) => c.path === '/admin/orders/NX-000002/retry' && c.method === 'POST')).toBe(true)
    expect(calls.filter((c) => c.path === '/admin/orders').length).toBe(2)
    expect(await screen.findByText(/Retried NX-000002/)).toBeTruthy()
  })
  it('Mark refunded asks for a note and posts it', async () => {
    vi.stubEnv('VITE_OFFICE_URL', 'https://office.test')
    window.localStorage.setItem('nexus.office.token', 'secret')
    const posted: unknown[] = []
    const calls = officeFetch({ '/admin/orders/NX-000002/refunded': (init) => { posted.push(JSON.parse(String(init?.body))); return { ...ORDERS[1], state: 'refunded' } } })
    await mount()
    const row = (await screen.findAllByRole('row', { name: /NX-000002/ }))[0]
    await act(async () => { fireEvent.click(within(row).getByRole('button', { name: 'Mark refunded' })) })
    fireEvent.change(screen.getByLabelText(/Refund note/), { target: { value: 'Refunded in Stripe, re_1' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Confirm refund' })) })
    expect(posted).toEqual([{ note: 'Refunded in Stripe, re_1' }])
    expect(calls.filter((c) => c.path === '/admin/orders').length).toBe(2)
  })
  it('the health strip shows test mode and the last cron', async () => {
    vi.stubEnv('VITE_OFFICE_URL', 'https://office.test')
    window.localStorage.setItem('nexus.office.token', 'secret')
    officeFetch()
    await mount()
    expect(await screen.findByText(/Stripe test mode/)).toBeTruthy()
    expect(screen.getByText(/CJ signed in/)).toBeTruthy()
    expect(screen.getByText(/dry run/i)).toBeTruthy()
    expect(screen.getByText(/Email off/)).toBeTruthy()
    expect(screen.getByText(/Last cron/)).toBeTruthy()
  })
  it('a refused token is asked for again', async () => {
    vi.stubEnv('VITE_OFFICE_URL', 'https://office.test')
    window.localStorage.setItem('nexus.office.token', 'wrong')
    officeFetch()
    await mount()
    expect(await screen.findByText(/refused/)).toBeTruthy()
    expect(screen.getByLabelText(/Admin token/)).toBeTruthy()
    expect(window.localStorage.getItem('nexus.office.token')).toBeNull()
  })
  it('without the office configured the tab explains', async () => {
    await mount()
    expect(await screen.findByText(/office is not configured/i)).toBeTruthy()
    expect(screen.getByRole('link', { name: /README/ }).getAttribute('href')).toContain('#back-office')
    expect(screen.queryByLabelText(/Admin token/)).toBeNull()
  })
  it('the Radar tab still renders and the header links switch tabs', async () => {
    await mount('')
    expect(screen.getByText(/7 candidates/)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Orders' }).getAttribute('href')).toBe('#orders')
  })
})
