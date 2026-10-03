// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, fireEvent } from '@testing-library/react'

// three.js and the canvas are not needed for these renders; the product page lazy-loads the canvas
vi.mock('./components/ProductCanvas', () => ({ ProductCanvas: () => null, PARTS: [] }))

window.scrollTo = () => {}   // jsdom does not implement it; the store calls it on navigation

async function mount(hash: string, seed?: object) {
  vi.resetModules()
  window.localStorage.clear()
  if (seed) window.localStorage.setItem('nexus.v1', JSON.stringify({ state: seed, version: 1 }))
  window.location.hash = hash
  const { default: App } = await import('./App')
  let r: ReturnType<typeof render>
  await act(async () => { r = render(<App />) })
  return r!
}

/* The page wrapper waits for the previous page's exit animation, so a deep link's page appears a beat after mount. */
describe('app resilience', () => {
  afterEach(cleanup)
  it('an unknown product id shows the 404, not a blank page', async () => {
    await mount('#/p/not-a-product')
    expect(await screen.findByText(/That link did not match/)).toBeTruthy()
  })
  it('a stale persisted cart and compare id are dropped instead of crashing', async () => {
    await mount('#/', { cart: [{ key: 'gone:x:', productId: 'gone-product', variantId: 'x', selection: {}, qty: 1, unitPrice: 10 }], compare: ['gone-product', 'oura-ring-5'] })
    expect(screen.getByText(/The new thing/)).toBeTruthy()
    const { useStore } = await import('./lib/store')
    expect(useStore.getState().cart).toEqual([])
    expect(useStore.getState().compare).toEqual(['oura-ring-5'])
  })
  it('a malformed percent-encoding in the hash shows the 404', async () => {
    await mount('#/p/%E0')
    expect(await screen.findByText(/That link did not match/)).toBeTruthy()
  })
  it('ticking a filter keeps the collection page mounted', async () => {
    await mount('#/c/cinema')
    const heading = await screen.findByRole('heading', { level: 1, name: 'Cinema' })
    const box = screen.getByLabelText(/Sydney stock/)
    await act(async () => { fireEvent.click(box) })
    await act(async () => { await new Promise((r) => setTimeout(r, 400)) })   // longer than any exit animation
    expect(heading.isConnected).toBe(true)                                     // same DOM node: no remount
    expect(screen.getByRole('heading', { level: 1, name: 'Cinema' })).toBe(heading)
    expect(window.location.hash).toContain('route%3Awarehouse')
  })
  it('a deep link renders its page on first paint, not the home page', async () => {
    await mount('#/guides')
    expect(screen.queryByText(/The new thing/)).toBeNull()
    expect(screen.getByRole('heading', { level: 1, name: /Guides/ })).toBeTruthy()
  })
  it('moving to another page adds a history entry so Back works; a filter change does not', async () => {
    await mount('#/')
    const { useStore } = await import('./lib/store')
    const before = window.history.length
    await act(async () => { useStore.getState().go({ name: 'collection', slug: 'cinema', filters: {} }) })
    expect(window.history.length).toBe(before + 1)
    await act(async () => { useStore.getState().go({ name: 'collection', slug: 'cinema', filters: { route: 'warehouse' } }) })
    expect(window.history.length).toBe(before + 1)
    expect(window.location.hash).toContain('route%3Awarehouse')
  })
  it('says so on the account page when the browser is not keeping data', async () => {
    const real = window.localStorage
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') }, removeItem: () => { throw new Error('blocked') } })
    try {
      vi.resetModules()
      window.location.hash = '#/account'
      const { default: App } = await import('./App')
      await act(async () => { render(<App />) })
      expect(await screen.findByText(/This browser is not keeping/)).toBeTruthy()
    } finally { vi.stubGlobal('localStorage', real) }
  })
  it('the search panel shows no recent searches until there are some', async () => {
    await mount('#/')
    const box = screen.getByLabelText('Search products')
    await act(async () => { fireEvent.focus(box) })
    expect(screen.queryByText('magnetic power bank')).toBeNull()
    expect(screen.getByText(/Try a search/)).toBeTruthy()
  })
  it('the home page delivery times follow the setup region', async () => {
    await mount('#/')
    const { useStore } = await import('./lib/store')
    const { etaText } = await import('./lib/shipping')
    await act(async () => { useStore.getState().setRegion('UK') })
    expect(screen.getAllByText(etaText('AU', 'UK')).length).toBeGreaterThan(0)
    expect(screen.getAllByText(etaText('CN', 'UK')).length).toBeGreaterThan(0)
    expect(etaText('AU', 'UK')).not.toBe(etaText('AU', 'AU'))
  })
  it('a custom phone from My setup appears in the guide demo picker', async () => {
    await mount('#/guides/works-with-my-phone', { gear: [{ id: 'c-abc', kind: 'phone', name: 'Galaxy A56', detail: 'Added by you', facts: { phone: { os: 'android', magnets: false, trackerNet: 'find-hub' } }, defaultOn: true }], gearOn: { 'c-abc': true } })
    const picker = await screen.findByLabelText(/^Phone/)
    expect(Array.from((picker as HTMLSelectElement).options).map((o) => o.textContent)).toContain('Galaxy A56')
  })
  it('the confirmation page names a line whose product has left the catalogue instead of showing another product', async () => {
    const order = { id: 'NX-000001', placedAt: new Date().toISOString(), email: 'n@x.com', address: { id: 'a', name: 'N', line1: '1 St', city: 'Sydney', region: 'NSW', postcode: '2000', country: 'AU', isDefault: true },
      lines: [{ key: 'gone:v:', productId: 'gone-product', variantId: 'v', selection: {}, qty: 1, unitPrice: 10, name: 'Vanished gadget', brand: 'Acme', variantLabel: 'Black', visual: 'device', hue: 0, swatch: '#000', origin: 'AU', route: 'warehouse' }],
      shipments: [{ origin: 'AU', zone: 'AU', method: 'standard', cost: 0, etaDays: [2, 4], lineKeys: ['gone:v:'] }],
      totals: { subtotal: 10, shipping: 0, tax: 1, taxIncluded: true, taxLabel: 'Includes GST 10 %', total: 10, currency: 'AUD' }, compat: { status: 'ok', issues: [] } }
    await mount('#/orders/NX-000001/confirmed', { orders: [order] })
    expect(await screen.findByText(/Vanished gadget/)).toBeTruthy()
    expect(document.querySelector('[data-name="Acme Vanished gadget"]')).toBeTruthy()   // the picture is drawn from the order's own snapshot
    expect(document.querySelector('[data-name*="MoGo"]')).toBeNull()
  })
  it('the header shows the refresh date when trends are real', async () => {
    vi.doMock('./lib/trends.generated', () => ({ TRENDS: { 'oura-ring-5': { label: 'Viral', delta: 212, series: [1, 2, 3, 4, 5, 6, 7, 8], source: 'Wikipedia' } }, TRENDS_GENERATED_AT: '2026-10-04T20:05:10.000Z', TRENDS_SOURCES: ['Wikipedia'] }))
    try {
      await mount('#/')
      expect(screen.getByText(/Trends: refreshed 5 Oct/)).toBeTruthy()
    } finally { vi.doUnmock('./lib/trends.generated') }
  })
})

/* With the office configured, only Radar listings (the ones with a supplier) can be bought; everything else offers a stock alert. */
const LISTING = { id: 'cj-P-A1', name: 'Mini Laser Projector', brand: 'Nexus Select', category: 'Home cinema', tagline: 'Home cinema find from the Trend Radar.', price: 95.95, priceCheckedAt: '2026-10-04', listedAt: '2026-10-04', market: 'global', sources: ['Trend Radar'], supplier: { url: 'https://cjdropshipping.com/p/P-A1', pid: 'P-A1', vid: 'V-AU', costUsd: 62.4, termId: 'laser-projector' }, rating: null, stock: 'in', fulfil: { route: 'supplier', origin: 'CN' }, visual: 'device', hue: 200, photos: [], variants: [{ id: 'cj-V-AU', label: 'AU Plug', swatch: '#2b2b30', hue: 200 }], badges: ['From the Radar'], trend: { label: 'Steady', delta: 0, series: [0, 0, 0, 0, 0, 0, 0, 0], source: 'No trend data yet' }, specs: [{ group: 'Supplier', rows: [{ label: 'Weight', value: '500 g' }] }], facts: { plug: 'AU' } }

describe('office gating', () => {
  afterEach(() => { cleanup(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.doUnmock('./lib/data.listings') })
  it('a branded product shows "Not yet stocked, tell me when" and no Add to cart when the office is enabled', async () => {
    vi.stubEnv('VITE_OFFICE_URL', 'https://office.test')
    await mount('#/p/oura-ring-5')
    expect(await screen.findByRole('button', { name: 'Not yet stocked, tell me when' })).toBeTruthy()
    expect(screen.queryByText(/Add to cart/)).toBeNull()
    expect(screen.queryByText(/Buy now/)).toBeNull()
  })
  it('a CJ listing shows Add to cart', async () => {
    vi.stubEnv('VITE_OFFICE_URL', 'https://office.test')
    vi.doMock('./lib/data.listings', () => ({ LISTINGS: [LISTING] }))
    await mount('#/p/cj-P-A1')
    expect((await screen.findAllByText(/Add to cart/)).length).toBeGreaterThan(0)
    expect(screen.queryByText(/Not yet stocked/)).toBeNull()
  })
  it('notify posts the product id and email', async () => {
    vi.stubEnv('VITE_OFFICE_URL', 'https://office.test')
    const calls: { url: string; body: unknown }[] = []
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => { calls.push({ url, body: JSON.parse(String(init?.body)) }); return new Response('{"ok":true}', { status: 200, headers: { 'content-type': 'application/json' } }) })
    await mount('#/p/oura-ring-5')
    const button = await screen.findByRole('button', { name: 'Not yet stocked, tell me when' })
    fireEvent.change(screen.getByLabelText('Email for a stock alert'), { target: { value: 'Nick@example.com ' } })
    await act(async () => { fireEvent.click(button) })
    expect(calls).toEqual([{ url: 'https://office.test/notify', body: { productId: 'oura-ring-5', email: 'nick@example.com' } }])
    expect(await screen.findByText(/We'll email you when it's stocked/)).toBeTruthy()
  })
  it('without VITE_OFFICE_URL every product is addable', async () => {
    await mount('#/p/oura-ring-5')
    expect((await screen.findAllByText(/Add to cart/)).length).toBeGreaterThan(0)
    expect(screen.queryByText(/Not yet stocked/)).toBeNull()
  })
})

/* The real checkout: a live freight quote, Stripe for the money, the office for the order. */
const OFFICE_ORDER = { id: 'NX-654321', createdAt: '2026-10-05T00:00:00.000Z', email: 'nick@example.com', address: { name: 'Nick M', line1: '1 Test St', city: 'Sydney', region: 'NSW', postcode: '2000', country: 'AU' }, lines: [{ productId: 'cj-P-A1', variantId: 'cj-V-AU', name: 'Mini Laser Projector', qty: 1, unitPrice: 95.95, vid: 'V-AU', origin: 'CN' }], shipping: { origin: 'CN', method: 'standard', logisticName: 'CJPacket Ordinary', aud: 33.95, days: [8, 15], fellBack: false }, tax: { amount: 11.81, included: true, label: 'Includes GST 10 %' }, subtotal: 95.95, total: 129.9, currency: 'AUD', stripe: { sessionId: 'cs_test_a1', paymentIntentId: 'pi_1', paid: true }, state: 'placed_with_supplier', supplier: { cjOrderId: 'CJ-1', placedAt: '2026-10-05T00:01:00.000Z' }, history: [] }
const SEED_CART = { cart: [{ key: 'cj-P-A1:cj-V-AU:', productId: 'cj-P-A1', variantId: 'cj-V-AU', selection: {}, qty: 1, unitPrice: 95.95 }] }

async function throughDelivery() {
  fireEvent.change(await screen.findByLabelText(/Email for the order confirmation/), { target: { value: 'nick@example.com' } })
  await act(async () => { fireEvent.click(screen.getByText('Continue to delivery')) })
  fireEvent.change(screen.getByLabelText(/Full name/), { target: { value: 'Nick M' } })
  fireEvent.change(screen.getByLabelText(/Street address/), { target: { value: '1 Test St' } })
  fireEvent.change(screen.getByLabelText(/Suburb/), { target: { value: 'Sydney' } })
  fireEvent.change(screen.getByLabelText(/Postcode/), { target: { value: '2000' } })
  fireEvent.change(screen.getByLabelText(/^State/), { target: { value: 'NSW' } })
  fireEvent.change(screen.getByLabelText(/^Phone/), { target: { value: '0400 000 000' } })
  await act(async () => { fireEvent.click(screen.getByText('Continue to shipping')) })
}

describe('office checkout', () => {
  afterEach(() => { cleanup(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.doUnmock('./lib/data.listings'); vi.useRealTimers() })
  function officeFetch(routes: Record<string, (init?: RequestInit) => Response>) {
    const calls: { url: string; body?: unknown }[] = []
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      const path = url.replace('https://office.test', '').split('?')[0]
      calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined })
      const hit = Object.entries(routes).find(([k]) => path === k || (k.endsWith('*') && path.startsWith(k.slice(0, -1))))
      return hit ? hit[1](init) : new Response('{"error":"not_found"}', { status: 404 })
    })
    return calls
  }
  const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
  const FREIGHT = { shipping: { origin: 'CN', method: 'standard', logisticName: 'CJPacket Ordinary', aud: 33.95, days: [8, 15], fellBack: false }, fellBack: false, tax: { amount: 11.81, included: true, label: 'Includes GST 10 %' }, total: 129.9 }

  it('checkout shows the live quote and Pay with Stripe when the office is enabled', async () => {
    vi.stubEnv('VITE_OFFICE_URL', 'https://office.test')
    vi.doMock('./lib/data.listings', () => ({ LISTINGS: [LISTING] }))
    const calls = officeFetch({ '/freight': (init) => reply(JSON.parse(String(init?.body)).method === 'express' ? { ...FREIGHT, shipping: { ...FREIGHT.shipping, method: 'express', logisticName: 'DHL Express', aud: 73.95, days: [3, 6] }, total: 169.9 } : FREIGHT) })
    await mount('#/checkout', SEED_CART)
    expect(screen.queryByText(/No payment is taken/)).toBeNull()
    await throughDelivery()
    expect((await screen.findAllByText(/CJPacket Ordinary/)).length).toBeGreaterThan(0)
    expect(screen.getByRole('radio', { name: /Express/ })).toBeTruthy()
    expect(screen.getByText(/DHL Express/)).toBeTruthy()
    expect(calls.filter((c) => c.url.endsWith('/freight')).length).toBe(2)
    expect(calls[0].body).toMatchObject({ lines: [{ productId: 'cj-P-A1', variantId: 'cj-V-AU', qty: 1 }], address: { country: 'AU', postcode: '2000' } })
    expect(screen.queryByText(/Card number/)).toBeNull()
    await act(async () => { fireEvent.click(screen.getByText('Review the order')) })
    expect(await screen.findByRole('button', { name: /Pay with Stripe/ })).toBeTruthy()
    expect(screen.getAllByText('$129.90').length).toBeGreaterThan(0)
  })
  it('Pay with Stripe posts the cart and redirects', async () => {
    vi.stubEnv('VITE_OFFICE_URL', 'https://office.test')
    vi.doMock('./lib/data.listings', () => ({ LISTINGS: [LISTING] }))
    const calls = officeFetch({ '/freight': () => reply(FREIGHT), '/checkout': () => reply({ url: 'https://checkout.stripe.com/c/pay/cs_test_a1' }) })
    await mount('#/checkout', SEED_CART)
    const { redirect } = await import('./lib/office')
    const assign = vi.fn()
    redirect.to = assign
    await throughDelivery()
    await screen.findAllByText(/CJPacket Ordinary/)
    await act(async () => { fireEvent.click(screen.getByText('Review the order')) })
    await act(async () => { fireEvent.click(await screen.findByRole('button', { name: /Pay with Stripe/ })) })
    const checkout = calls.find((c) => c.url.endsWith('/checkout'))!
    expect(checkout.body).toMatchObject({ email: 'nick@example.com', method: 'standard', lines: [{ productId: 'cj-P-A1', variantId: 'cj-V-AU', qty: 1 }], address: { name: 'Nick M', line1: '1 Test St', city: 'Sydney', region: 'NSW', postcode: '2000', country: 'AU' } })
    expect(checkout.body).not.toHaveProperty('unitPrice')
    expect(assign).toHaveBeenCalledWith('https://checkout.stripe.com/c/pay/cs_test_a1')
  })
  it('a not_sellable answer highlights the line', async () => {
    vi.stubEnv('VITE_OFFICE_URL', 'https://office.test')
    vi.doMock('./lib/data.listings', () => ({ LISTINGS: [LISTING] }))
    officeFetch({ '/freight': () => reply(FREIGHT), '/checkout': () => reply({ error: 'not_sellable', field: 'lines[0]' }, 422) })
    await mount('#/checkout', SEED_CART)
    await throughDelivery()
    await screen.findAllByText(/CJPacket Ordinary/)
    await act(async () => { fireEvent.click(screen.getByText('Review the order')) })
    await act(async () => { fireEvent.click(await screen.findByRole('button', { name: /Pay with Stripe/ })) })
    expect(await screen.findByText(/No longer available/)).toBeTruthy()
    expect((screen.getByRole('button', { name: /Pay with Stripe/ }) as HTMLButtonElement).disabled).toBe(true)
  })
  it('a cart that cannot be shipped there says so instead of a quote', async () => {
    vi.stubEnv('VITE_OFFICE_URL', 'https://office.test')
    vi.doMock('./lib/data.listings', () => ({ LISTINGS: [LISTING] }))
    officeFetch({ '/freight': () => reply({ error: 'no_freight', message: 'cannot ship Mini Laser Projector to AU yet' }, 422) })
    await mount('#/checkout', SEED_CART)
    await throughDelivery()
    expect(await screen.findByText(/cannot ship this order to Australia yet/i)).toBeTruthy()
    expect(screen.queryByText('Review the order')).toBeNull()
  })
  it('an office outage keeps the estimate and says the final freight is confirmed at payment', async () => {
    vi.stubEnv('VITE_OFFICE_URL', 'https://office.test')
    vi.doMock('./lib/data.listings', () => ({ LISTINGS: [LISTING] }))
    vi.stubGlobal('fetch', async () => { throw new TypeError('Failed to fetch') })
    await mount('#/checkout', SEED_CART)
    await throughDelivery()
    expect((await screen.findAllByText(/estimate/i)).length).toBeGreaterThan(0)
    expect(screen.getByText(/confirmed at payment/i)).toBeTruthy()
    expect(screen.getByText('Review the order')).toBeTruthy()
  })
  it('the office checkout requires a phone number for the carrier', async () => {
    vi.stubEnv('VITE_OFFICE_URL', 'https://office.test')
    vi.doMock('./lib/data.listings', () => ({ LISTINGS: [LISTING] }))
    officeFetch({ '/freight': () => reply(FREIGHT) })
    await mount('#/checkout', SEED_CART)
    fireEvent.change(await screen.findByLabelText(/Email for the order confirmation/), { target: { value: 'nick@example.com' } })
    await act(async () => { fireEvent.click(screen.getByText('Continue to delivery')) })
    expect(screen.getByLabelText(/^Phone/).closest('label')?.textContent).not.toMatch(/optional/i)
    fireEvent.change(screen.getByLabelText(/Full name/), { target: { value: 'Nick M' } })
    fireEvent.change(screen.getByLabelText(/Street address/), { target: { value: '1 Test St' } })
    fireEvent.change(screen.getByLabelText(/Suburb/), { target: { value: 'Sydney' } })
    fireEvent.change(screen.getByLabelText(/Postcode/), { target: { value: '2000' } })
    await act(async () => { fireEvent.click(screen.getByText('Continue to shipping')) })
    expect(screen.getByRole('alert').textContent).toMatch(/Phone/)
    expect(screen.queryByText(/Getting a freight quote/)).toBeNull()
  })
  it('arriving back from Stripe clears the cart at once and says so while the office catches up', async () => {
    vi.stubEnv('VITE_OFFICE_URL', 'https://office.test')
    vi.doMock('./lib/data.listings', () => ({ LISTINGS: [LISTING] }))
    officeFetch({ '/orders/by-session/*': () => reply({ pending: true }, 202) })
    await mount('#/orders/confirmed?session=cs_test_a1', SEED_CART)
    expect(await screen.findByText(/Confirming your payment/)).toBeTruthy()
    const { useStore } = await import('./lib/store')
    expect(useStore.getState().cart).toEqual([])
  })
  it('the confirmation page says the order is being checked when the office flagged it', async () => {
    vi.stubEnv('VITE_OFFICE_URL', 'https://office.test')
    vi.doMock('./lib/data.listings', () => ({ LISTINGS: [LISTING] }))
    officeFetch({ '/orders/by-session/*': () => reply({ ...OFFICE_ORDER, state: 'needs_attention', lines: [], attention: { reason: 'draft_missing', at: OFFICE_ORDER.createdAt, lastError: 'x', attempts: 1, nextRetryAt: OFFICE_ORDER.createdAt } }) })
    await mount('#/orders/confirmed?session=cs_test_a1')
    expect(await screen.findByText(/NX-654321/)).toBeTruthy()
    expect(screen.queryByText(/it is on its way/)).toBeNull()
    expect(screen.getByRole('heading', { level: 1, name: /checking the details/i })).toBeTruthy()
  })
  it('the confirmation page polls by session then shows the order', async () => {
    vi.stubEnv('VITE_OFFICE_URL', 'https://office.test')
    vi.doMock('./lib/data.listings', () => ({ LISTINGS: [LISTING] }))
    let n = 0
    officeFetch({ '/orders/by-session/*': () => (++n < 2 ? reply({ pending: true }, 202) : reply(OFFICE_ORDER)) })
    await mount('#/orders/confirmed?session=cs_test_a1')
    expect(await screen.findByText(/Confirming your payment/)).toBeTruthy()
    expect(await screen.findByText(/NX-654321/, {}, { timeout: 4000 })).toBeTruthy()
    expect(screen.getByText(/Thanks, it is on its way/)).toBeTruthy()
    expect(screen.queryByText(/Nothing was charged/)).toBeNull()
    expect(n).toBe(2)
  })
  it('the order page asks for the email when the order is remote', async () => {
    vi.stubEnv('VITE_OFFICE_URL', 'https://office.test')
    vi.doMock('./lib/data.listings', () => ({ LISTINGS: [LISTING] }))
    const calls = officeFetch({ '/orders/NX-654321': () => reply(OFFICE_ORDER) })
    await mount('#/orders/NX-654321')
    const input = await screen.findByLabelText(/email used for the order/i)
    fireEvent.change(input, { target: { value: 'nick@example.com' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Find my order/ })) })
    expect((await screen.findAllByText(/With the supplier/)).length).toBeGreaterThan(0)
    expect(calls[0].url).toBe('https://office.test/orders/NX-654321?email=nick%40example.com')
    expect(screen.queryByText(/Status moves on its own/)).toBeNull()
  })
})

describe('policies', () => {
  afterEach(() => { cleanup(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.doUnmock('./lib/data.listings') })
  it('each policy page renders its heading and the draft notice', async () => {
    const { POLICIES } = await import('./content/policies')
    for (const p of POLICIES) {
      await mount(`#/policies/${p.slug}`)
      expect(await screen.findByRole('heading', { level: 1, name: p.title })).toBeTruthy()
      expect(screen.getByText(/Draft, pending professional review/)).toBeTruthy()
      cleanup()
    }
  })
  it('the shipping-and-returns page lists every origin’s delivery window and the returns rule', async () => {
    const { etaText } = await import('./lib/shipping')
    await mount('#/policies/shipping-returns')
    await screen.findByRole('heading', { level: 1, name: /Shipping/ })
    for (const origin of ['AU', 'CN', 'US', 'EU', 'UK'] as const) for (const zone of ['AU', 'UK', 'NA'] as const) expect(screen.getAllByText(etaText(origin, zone)).length, `${origin}→${zone}`).toBeGreaterThan(0)
    expect(screen.getAllByText(/30-day change-of-mind returns on Australian stock/).length).toBeGreaterThan(0)
    expect(screen.getByText(/Australian Consumer Law/)).toBeTruthy()
  })
  it('the footer and home page no longer say "returns on both routes"', async () => {
    await mount('#/')
    expect(screen.queryByText(/returns on both routes/i)).toBeNull()
    expect(screen.getAllByText(/consumer guarantees on everything/i).length).toBeGreaterThan(0)
    expect(document.querySelector('a[href="#/policies/privacy"]')).toBeTruthy()
  })
  it('checkout’s Pay button carries the agreement line with links', async () => {
    vi.stubEnv('VITE_OFFICE_URL', 'https://office.test')
    vi.doMock('./lib/data.listings', () => ({ LISTINGS: [LISTING] }))
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ shipping: { origin: 'CN', method: 'standard', logisticName: 'CJPacket Ordinary', aud: 33.95, days: [8, 15], fellBack: false }, fellBack: false, tax: { amount: 11.81, included: true, label: 'Includes GST 10 %' }, total: 129.9 }), { status: 200, headers: { 'content-type': 'application/json' } }))
    await mount('#/checkout', SEED_CART)
    await throughDelivery()
    await screen.findAllByText(/CJPacket Ordinary/)
    await act(async () => { fireEvent.click(screen.getByText('Review the order')) })
    await screen.findByRole('button', { name: /Pay with Stripe/ })
    expect(screen.getByText(/By paying you agree to the/)).toBeTruthy()
    expect(document.querySelector('a[href="#/policies/terms"]')).toBeTruthy()
    expect(document.querySelector('a[href="#/policies/shipping-returns"]')).toBeTruthy()
  })
})
