import { describe, expect, it } from 'vitest'
import terms from '../terms.json'
import { products } from '../../src/lib/data'
import type { Term } from '../src/types'
import { matchTitle } from '../src/match'

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

  it('every term has match rules that accept its own search phrase', () => {
    for (const t of terms as Term[]) {
      expect(t.match.all.length, t.id).toBeGreaterThan(0)
      for (const g of t.match.all) { expect(g.length, t.id).toBeGreaterThan(0); for (const e of g) expect(e, t.id).toBe(e.toLowerCase()) }
      for (const e of t.match.not ?? []) expect(e, t.id).toBe(e.toLowerCase())
      expect(matchTitle(t.cj.keyword, t).ok, `${t.id} rejects its own keyword "${t.cj.keyword}"`).toBe(true)
      // every phrase is also a CJ search (spec 4), so a phrase its own rules reject is a wasted call and a pile of rejections
      for (const p of t.phrases) expect(matchTitle(p, t).ok, `${t.id} rejects its own search phrase "${p}"`).toBe(true)
    }
  })
})
