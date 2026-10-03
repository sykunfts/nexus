/*
  Week-over-week growth per source, normalised across terms, weighted into one score and one
  whole-number delta per term. Numbers describe interest growth, never sales.
*/
import type { Confidence, DailySeries, ProductTrend, SourceId, SourceStat, Term, TermScore, TrendLabel } from './types'

export const SOURCES: SourceId[] = ['wikipedia', 'hackernews', 'reddit', 'tiwib']
export const WEIGHTS: Record<SourceId, number> = { wikipedia: 0.40, hackernews: 0.20, reddit: 0.30, tiwib: 0.10 }
export const FLOORS: Record<SourceId, number> = { wikipedia: 50, hackernews: 5, reddit: 5, tiwib: 1 }

export function growth(series: DailySeries, floor: number): SourceStat {
  const v = series.days.map((d) => d.value)
  const prior7 = v.slice(0, 7).reduce((a, b) => a + b, 0)
  const last7 = v.slice(7, 14).reduce((a, b) => a + b, 0)
  return { last7, prior7, growth: (last7 - prior7) / Math.max(prior7, floor) }
}

export function labelFor(delta: number): TrendLabel {
  return delta >= 200 ? 'Viral' : delta >= 100 ? 'Trending' : delta >= 50 ? 'Rising' : 'Steady'
}

const confidenceFor = (n: number): Confidence => (n >= 3 ? 'high' : n === 2 ? 'medium' : n === 1 ? 'low' : 'none')
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))

export function scoreTerms(input: { term: Term; series: DailySeries[] }[]): TermScore[] {
  // per-source stats, then z across the terms that have that source
  const stats = input.map(({ series }) => {
    const m: Partial<Record<SourceId, SourceStat>> = {}
    for (const s of series) m[s.source] = growth(s, FLOORS[s.source])
    return m
  })
  const z: Record<SourceId, { mean: number; sd: number }> = { wikipedia: { mean: 0, sd: 0.1 }, hackernews: { mean: 0, sd: 0.1 }, reddit: { mean: 0, sd: 0.1 }, tiwib: { mean: 0, sd: 0.1 } }
  for (const src of SOURCES) {
    const g = stats.map((m) => m[src]?.growth).filter((x): x is number => typeof x === 'number')
    if (!g.length) continue
    const mean = g.reduce((a, b) => a + b, 0) / g.length
    const sd = Math.sqrt(g.reduce((a, b) => a + (b - mean) ** 2, 0) / g.length)
    z[src] = { mean, sd: Math.max(sd, 0.1) }
  }

  return input.map(({ term, series }, i) => {
    const m = stats[i]
    const present = SOURCES.filter((s) => m[s])
    const totalW = present.reduce((a, s) => a + WEIGHTS[s], 0)
    const wOf = (s: SourceId) => (totalW > 0 ? WEIGHTS[s] / totalW : 0)
    const score = present.reduce((a, s) => a + wOf(s) * ((m[s]!.growth - z[s].mean) / z[s].sd), 0)
    const delta = clamp(Math.round(100 * present.reduce((a, s) => a + wOf(s) * m[s]!.growth, 0)), -90, 999)
    // shape of the last 8 days: each day's value over its 14-day mean, weighted, scaled to 100
    const shape = Array.from({ length: 8 }, (_, k) => {
      const day = 6 + k
      return present.reduce((a, s) => {
        const ser = series.find((x) => x.source === s)!
        const mean14 = ser.days.reduce((p, d) => p + d.value, 0) / 14
        return a + wOf(s) * (mean14 > 0 ? ser.days[day].value / mean14 : 0)
      }, 0)
    })
    const max = Math.max(...shape)
    const out = max > 0 ? shape.map((x) => Math.round((x / max) * 100)) : shape.map(() => 0)
    const sources = Object.fromEntries(SOURCES.map((s) => [s, m[s] ?? null])) as Record<SourceId, SourceStat | null>
    return { id: term.id, label: term.label, section: term.section, delta, trendLabel: labelFor(delta), score, confidence: confidenceFor(present.length), series: out, sources }
  })
}

export function productTrends(scores: TermScore[], terms: Term[]): Record<string, ProductTrend> {
  const out: Record<string, ProductTrend> = {}
  for (const term of terms) {
    const s = scores.find((x) => x.id === term.id)
    if (!s) continue
    for (const id of term.products) out[id] = { delta: s.delta, label: s.trendLabel, score: s.score, confidence: s.confidence, series: s.series }
  }
  return out
}
