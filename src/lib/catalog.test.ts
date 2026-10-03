import { describe, expect, it } from 'vitest'
import { facets, query, similar } from './catalog'
import { gear, products } from './data'

const setup = gear.filter((g) => g.defaultOn).map((g) => ({ id: g.id, name: g.name, facts: g.facts }))
const ids = (ps: { id: string }[]) => ps.map((p) => p.id)

describe('query', () => {
  it('filters by category and text with all tokens required', () => {
    expect(ids(query(products, { category: ['Power'], text: 'power bank' }, 'trending', setup))).toEqual(['anker-maggo-10k'])
    expect(ids(query(products, { category: ['Accessories'], text: 'adapter' }, 'trending', setup))).toEqual(['sansai-au-travel-adapter'])
  })
  it('matches text by word prefix, not substring', () => {
    expect(ids(query(products, { category: ['Wearables'], text: 'ring' }, 'trending', setup))).toEqual(['ringconn-gen-3', 'oura-ring-5'])
  })
  it('filters by platform through app, home and hubs facts', () => {
    expect(ids(query(products, { platform: ['thread'] }, 'trending', setup))).toEqual(['nanoleaf-matter-strip-5m', 'aqara-hub-m3'])
    expect(query(products, { platform: ['alexa'] }, 'trending', setup).every((p) => p.facts.home?.includes('alexa') || p.facts.hubs?.includes('alexa'))).toBe(true)
    expect(query(products, { platform: ['ios'] }, 'trending', setup).every((p) => p.facts.app?.includes('ios'))).toBe(true)
  })
  it('sorts by price, rating and newest', () => {
    const asc = query(products, {}, 'price-asc', setup)
    expect(asc[0].id).toBe('sansai-au-travel-adapter')
    expect(asc[asc.length - 1].id).toBe('eufy-x10-pro-omni')
    const rated = query(products, {}, 'rating', setup)
    expect(rated[0].id).toBe('segway-e3-pro')
    expect(rated.filter((p) => p.rating).length).toBe(6)
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
    expect(f.route.find((r) => r.value === 'warehouse')?.count).toBe(13)
    expect(f.route.find((r) => r.value === 'supplier')?.count).toBe(8)
    expect(f.price.find((b) => b.label === 'Under $100')?.count).toBe(3)
  })
})

describe('similar', () => {
  it('suggests by token overlap', () => {
    expect(ids(similar(products, 'laser projector', 3))[0]).toBe('xgimi-mogo-4-laser')
  })
})
