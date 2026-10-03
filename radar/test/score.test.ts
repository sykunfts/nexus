import { describe, expect, it } from 'vitest'
import { FLOORS, growth, labelFor, productTrends, scoreTerms, WEIGHTS } from '../src/score'
import { seriesFrom, windowEnding } from '../src/window'
import type { DailySeries, SourceId, Term } from '../src/types'

const w = windowEnding(new Date('2026-10-04T03:00:00Z'))
const mk = (id: string, products: string[] = []): Term => ({ id, label: id, section: 'Wearables', wikipedia: id, phrases: [id], cj: { category: id, keyword: id }, products })
/* a series whose first week sums to prior and second week to last, spread evenly */
const series = (source: SourceId, prior: number, last: number): DailySeries => {
  const days = [...Array(7).fill(prior / 7), ...Array(7).fill(last / 7)]
  const dates = seriesFrom(source, w, new Map()).days.map((d) => d.date)
  return { source, days: dates.map((date, i) => ({ date, value: days[i] })) }
}

describe('scoring', () => {
  it('growth uses the floor', () => {
    const s = growth(series('hackernews', 1, 4), FLOORS.hackernews)
    expect(s.last7).toBeCloseTo(4)
    expect(s.prior7).toBeCloseTo(1)
    expect(s.growth).toBeCloseTo(0.6)   // (4 − 1) / max(1, 5)
  })
  it('labels at the thresholds', () => {
    expect(labelFor(49)).toBe('Steady'); expect(labelFor(50)).toBe('Rising'); expect(labelFor(100)).toBe('Trending'); expect(labelFor(200)).toBe('Viral')
  })
  it('weights renormalise when a source is missing', () => {
    const out = scoreTerms([
      { term: mk('a'), series: [series('wikipedia', 1000, 2000)] },
      { term: mk('b'), series: [series('wikipedia', 1000, 1000)] },
    ])
    const a = out.find((t) => t.id === 'a')!
    expect(a.delta).toBe(100)            // growth 1.0 with weight renormalised to 1
    expect(a.trendLabel).toBe('Trending')
    expect(a.sources.hackernews).toBeNull()
    expect(a.confidence).toBe('low')
  })
  it('delta clamps at 999 and −90', () => {
    const out = scoreTerms([
      { term: mk('up'), series: [series('wikipedia', 100, 100_000)] },
      { term: mk('down'), series: [series('wikipedia', 100_000, 0)] },
    ])
    expect(out.find((t) => t.id === 'up')!.delta).toBe(999)
    expect(out.find((t) => t.id === 'down')!.delta).toBe(-90)
  })
  it('series scales to 100 and all-zero stays zero', () => {
    const out = scoreTerms([
      { term: mk('a'), series: [series('wikipedia', 700, 1400)] },
      { term: mk('z'), series: [series('wikipedia', 0, 0)] },
    ])
    expect(out.find((t) => t.id === 'a')!.series.length).toBe(8)
    expect(Math.max(...out.find((t) => t.id === 'a')!.series)).toBe(100)
    expect(out.find((t) => t.id === 'z')!.series).toEqual([0, 0, 0, 0, 0, 0, 0, 0])
  })
  it('confidence counts sources', () => {
    const three = scoreTerms([{ term: mk('a'), series: [series('wikipedia', 1, 1), series('hackernews', 1, 1), series('reddit', 1, 1)] }])[0]
    const none = scoreTerms([{ term: mk('b'), series: [] }])[0]
    expect(three.confidence).toBe('high')
    expect(none.confidence).toBe('none')
    expect(none.delta).toBe(0)
    expect(none.trendLabel).toBe('Steady')
    expect(WEIGHTS.wikipedia + WEIGHTS.hackernews + WEIGHTS.reddit + WEIGHTS.tiwib).toBeCloseTo(1)
  })
  it('productTrends maps every product of a term to the term trend', () => {
    const terms = [mk('a', ['p1', 'p2']), mk('b', ['p3'])]
    const scores = scoreTerms(terms.map((term) => ({ term, series: [series('wikipedia', 100, 300)] })))
    const pt = productTrends(scores, terms)
    expect(Object.keys(pt).sort()).toEqual(['p1', 'p2', 'p3'])
    expect(pt.p1.delta).toBe(scores.find((s) => s.id === 'a')!.delta)
    expect(pt.p1.series.length).toBe(8)
  })
})
