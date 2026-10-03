import { describe, expect, it } from 'vitest'
import { products } from './data'
import { CURRENCIES } from './currency'

describe('catalogue', () => {
  it('holds the expanded worldwide catalogue', () => {
    expect(products.length).toBeGreaterThanOrEqual(60)
    expect(new Set(products.map((p) => p.id)).size).toBe(products.length)
  })
  it('every product is complete', () => {
    for (const p of products) {
      expect(p.price, p.id).toBeGreaterThan(0)
      expect(p.variants.length, p.id).toBeGreaterThan(0)
      expect(p.sources.length, p.id).toBeGreaterThan(0)
      expect(p.specs.flatMap((g) => g.rows).length, p.id).toBeGreaterThanOrEqual(3)
      expect(p.listedAt, p.id).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(['global', 'AU', 'US', 'EU', 'UK'], p.id).toContain(p.market)
      expect(['AU', 'CN', 'US', 'EU', 'UK'], p.id).toContain(p.fulfil.origin)
      if (p.rating) expect(p.rating.count, p.id).toBeGreaterThan(0)
    }
  })
  it('converts overseas prices at the snapshot rate', () => {
    for (const p of products.filter((x) => x.priceSource)) {
      const rate = CURRENCIES[p.priceSource!.currency].rate
      expect(p.price, p.id).toBeCloseTo(p.priceSource!.amount / rate, 1)
    }
    expect(products.find((p) => p.id === 'anker-nebula-capsule-3-laser')?.priceSource?.currency).toBe('USD')
  })
})
