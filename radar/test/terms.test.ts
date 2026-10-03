import { describe, expect, it } from 'vitest'
import terms from '../terms.json'
import { products } from '../../src/lib/data'

describe('watch terms', () => {
  it('terms are unique, complete and point at real products', () => {
    const ids = terms.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.length).toBe(31)
    const cats = new Set(products.map((p) => p.category))
    for (const t of terms) {
      expect(cats.has(t.section), t.id).toBe(true)
      expect(t.phrases.length).toBeGreaterThan(0)
      expect(t.cj.keyword.length).toBeGreaterThan(0)
      expect(t.wikipedia.length).toBeGreaterThan(0)
      for (const id of t.products) expect(products.some((p) => p.id === id), `${t.id} → ${id}`).toBe(true)
    }
    const mapped = new Set(terms.flatMap((t) => t.products))
    expect(products.filter((p) => !mapped.has(p.id) && !p.id.startsWith('cj-')).map((p) => p.id)).toEqual([])   // every catalogue product has a term; Radar listings are keyed by termId instead
  })
})
