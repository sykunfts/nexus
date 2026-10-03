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
