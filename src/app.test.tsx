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
})
