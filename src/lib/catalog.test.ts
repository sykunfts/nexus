import { describe, expect, it } from 'vitest'
import { facets, query, similar } from './catalog'
import { gear, products } from './data'

const setup = gear.filter((g) => g.defaultOn).map((g) => ({ id: g.id, name: g.name, facts: g.facts }))
const ids = (ps: { id: string }[]) => ps.map((p) => p.id)

describe('query', () => {
  it('filters by category and text with all tokens required', () => {
    const banks = ids(query(products, { category: ['Power'], text: 'power bank' }, 'trending', setup))
    expect(banks).toContain('anker-maggo-10k')
    expect(banks).not.toContain('anker-prime-100w')
    expect(ids(query(products, { category: ['Accessories'], text: 'adapter' }, 'trending', setup))).toEqual(['sansai-au-travel-adapter'])
  })
  it('matches text by word prefix, not substring', () => {
    const rings = ids(query(products, { category: ['Wearables'], text: 'ring' }, 'trending', setup))
    expect(rings).toEqual(expect.arrayContaining(['ringconn-gen-3', 'oura-ring-5', 'ultrahuman-ring-air', 'samsung-galaxy-ring']))
    expect(rings).not.toContain('rayban-meta-gen-3')   // "charging" must not match "ring"
  })
  it('filters by platform through app, home and hubs facts', () => {
    const thread = query(products, { platform: ['thread'] }, 'trending', setup)
    expect(ids(thread)).toEqual(expect.arrayContaining(['nanoleaf-matter-strip-5m', 'aqara-hub-m3']))
    expect(thread.every((p) => p.facts.home?.includes('thread') || p.facts.hubs?.includes('thread'))).toBe(true)
    expect(ids(thread).indexOf('nanoleaf-matter-strip-5m')).toBeLessThan(ids(thread).indexOf('aqara-hub-m3'))   // trend order 74 before 66
    expect(query(products, { platform: ['alexa'] }, 'trending', setup).every((p) => p.facts.home?.includes('alexa') || p.facts.hubs?.includes('alexa'))).toBe(true)
    expect(query(products, { platform: ['ios'] }, 'trending', setup).every((p) => p.facts.app?.includes('ios'))).toBe(true)
  })
  it('sorts by price, rating and newest', () => {
    const asc = query(products, {}, 'price-asc', setup)
    expect(asc[0].id).toBe('sansai-au-travel-adapter')
    expect(asc[asc.length - 1].price).toBe(Math.max(...products.map((p) => p.price)))
    const rated = query(products, {}, 'rating', setup)
    expect(rated[0].id).toBe('segway-e3-pro')
    const ratedCount = products.filter((p) => p.rating).length
    expect(rated.slice(0, ratedCount).every((p) => p.rating)).toBe(true)
    expect(rated.slice(ratedCount).every((p) => !p.rating)).toBe(true)
    expect(query(products, {}, 'newest', setup)[0].id).toBe('rayban-meta-gen-3')
  })
  it('keeps only products that pass against the setup', () => {
    const ok = query(products, { worksWithSetup: true }, 'trending', setup)
    expect(ok.some((p) => p.id === 'eufy-x10-pro-omni')).toBe(false)
    expect(ok.some((p) => p.id === 'xgimi-mogo-4-laser')).toBe(true)
  })
  it('price bands and badges', () => {
    expect(ids(query(products, { price: [0, 30] }, 'price-asc', setup))).toEqual(['sansai-au-travel-adapter', 'esr-halolock-ring'])
    expect(ids(query(products, { badge: ['Viral'] }, 'trending', setup))).toEqual(['omnilux-contour-face', 'plaud-notepin-s', 'ringconn-gen-3'])
  })
  it('setupItem resolves a default gear id', () => {
    const android = query(products, { setupItem: 'g-pixel' }, 'trending', setup)
    expect(android.some((p) => p.id === 'anker-maggo-10k')).toBe(false)
    expect(android.some((p) => p.id === 'bose-ultra-open-2')).toBe(true)
  })
})

describe('facets', () => {
  it('counts a facet with its own filter removed', () => {
    const f = facets(products, { route: 'supplier' }, setup)
    const supplier = products.filter((p) => p.fulfil.route === 'supplier')
    expect(f.route.find((r) => r.value === 'warehouse')?.count).toBe(products.length - supplier.length)
    expect(f.route.find((r) => r.value === 'supplier')?.count).toBe(supplier.length)
    expect(f.price.find((b) => b.label === 'Under $100')?.count).toBe(supplier.filter((p) => p.price < 100).length)
  })
  it('keeps a checked brand or badge in the rail even when its count drops to zero', () => {
    // a brand checked, then a price band that excludes all of it: the tick must stay visible so it can be unticked
    const brand = products[0].brand
    const f = facets(products, { brand: [brand], price: [1e9, Infinity] }, setup)
    expect(f.brand.find((b) => b.value === brand)?.count).toBe(0)
    expect(f.brand.filter((b) => b.count === 0).map((b) => b.value)).toEqual([brand])
    const g = facets(products, { badge: ['Viral'], price: [1e9, Infinity] }, setup)
    expect(g.badge.find((b) => b.value === 'Viral')?.count).toBe(0)
  })
  it('counts in-stock products within the current result set', () => {
    const out = { ...products[0], stock: 'out' as const }
    const all = [out, ...products.slice(1)]
    const f = facets(all, { brand: [out.brand] }, setup)
    expect(f.inStock).toBe(all.filter((p) => p.brand === out.brand && p.stock !== 'out').length)
    expect(f.inStock).toBeLessThan(all.length)
  })
})

describe('similar', () => {
  it('suggests by token overlap', () => {
    expect(ids(similar(products, 'laser projector', 3))[0]).toBe('xgimi-mogo-4-laser')
  })
})
