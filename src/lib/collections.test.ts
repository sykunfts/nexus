import { describe, expect, it } from 'vitest'
import { COLLECTIONS, FOOTER, navTarget } from './collections'
import { POLICIES } from '../content/policies'
import { query } from './catalog'
import { DEFAULT_GEAR, nav, products, TREND_NOTE } from './data'

const setup = DEFAULT_GEAR.filter((g) => g.defaultOn).map((g) => ({ id: g.id, name: g.name, facts: g.facts }))

describe('collections', () => {
  it('every nav section, item and footer link resolves', () => {
    for (const s of nav) {
      expect(navTarget(s.label).name).not.toBe('not-found')
      for (const c of s.columns) for (const item of c.items) expect(navTarget(item).name, item).not.toBe('not-found')
    }
    for (const g of FOOTER) for (const i of g.items) expect(i.route.name, i.label).not.toBe('not-found')
  })
  it('no collection is empty', () => {
    for (const c of COLLECTIONS) expect(query(products, c.filters, c.sort ?? 'trending', setup).length, c.slug).toBeGreaterThan(0)
  })
  it('smart rings returns the rings and nothing else', () => {
    const c = COLLECTIONS.find((x) => x.slug === 'smart-rings')!
    const ids = query(products, c.filters, 'trending', setup).map((p) => p.id)
    expect(ids).toEqual(expect.arrayContaining(['ringconn-gen-3', 'oura-ring-5', 'ultrahuman-ring-air', 'samsung-galaxy-ring']))
    expect(ids.every((id) => /ring/.test(id))).toBe(true)
  })
  it('an unknown label throws', () => {
    expect(() => navTarget('Flux capacitors')).toThrow(/No target/)
  })
  it('collections ranked on trend figures say where the figures come from', () => {
    const ranked = COLLECTIONS.filter((c) => c.slug === 'trending' || c.filters.badge?.some((b) => b === 'Viral' || b === 'Trending' || b === 'Rising'))
    expect(ranked.length).toBeGreaterThanOrEqual(3)
    for (const c of ranked) expect(c.blurb).toContain(TREND_NOTE)
  })
  it('every FOOTER policy link resolves to a policy page', () => {
    const group = FOOTER.find((g) => g.title === 'Policies')!
    expect(group.items.map((i) => i.label)).toEqual(['Terms', 'Privacy', 'Shipping & Returns', 'Contact'])
    for (const i of group.items) {
      expect(i.route.name).toBe('policy')
      expect(POLICIES.some((p) => i.route.name === 'policy' && p.slug === i.route.slug), i.label).toBe(true)
    }
    expect(POLICIES.map((p) => p.slug)).toEqual(['terms', 'privacy', 'shipping-returns', 'contact'])
  })
})
