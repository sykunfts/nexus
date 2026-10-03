import { describe, expect, it } from 'vitest'
import { COLLECTIONS, FOOTER, navTarget } from './collections'
import { query } from './catalog'
import { DEFAULT_GEAR, nav, products } from './data'

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
})
