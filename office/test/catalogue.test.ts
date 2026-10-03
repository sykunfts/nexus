import { describe, expect, it } from 'vitest'
import { CATALOGUE, CATALOGUE_GENERATED_AT } from '../src/catalogue.generated'
import { products } from '../../src/lib/data'

describe('generated catalogue', () => {
  it('marks only products with a supplier as sellable and carries every product', () => {
    expect(CATALOGUE.length).toBe(products.length)
    expect(CATALOGUE_GENERATED_AT).toMatch(/^\d{4}-\d{2}-\d{2}/)
    for (const c of CATALOGUE) {
      const p = products.find((x) => x.id === c.id)!
      expect(c.sellable).toBe(!!p.supplier)
      expect(c.sellable).toBe(c.id.startsWith('cj-'))
      expect(c.price).toBe(p.price)
      expect(c.variants.length).toBe(p.variants.length)
      expect(c.variants.every((v) => typeof v.delta === 'number')).toBe(true)
      if (c.supplier) expect(c.supplier.vid.length).toBeGreaterThan(0)
    }
  })
})
