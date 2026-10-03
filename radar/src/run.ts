/*
  One run of the Radar: read the four signals for every term, score them, then (with a key) ask CJ
  for candidates, price them and rank them. Everything that can fail is recorded in `sources`
  and the run goes on; the two output files are returned, never written here.
*/
import type { Http } from './fetch'
import { fetchDaily as wikipedia } from './sources/wikipedia'
import { fetchDaily as hackernews } from './sources/hackernews'
import { RedditSource } from './sources/reddit'
import { fetchDaily as tiwibDaily, fetchFeed, matchTerm } from './sources/tiwib'
import { productTrends, scoreTerms } from './score'
import { iso, windowEnding } from './window'
import { createCjClient } from './cj/client'
import { pickVariant } from './cj/parse'
import { fetchCategories, fetchDetail, fetchFreight, searchTerm } from './cj/search'
import { fetchRate, moneyFor, sectionMedian } from './money'
import { flagsFor } from './flags'
import { rankCandidates, type Unranked } from './rank'
import type { Candidate, DailySeries, Dest, FreightQuote, NoveltyItem, RadarFile, SourceId, Term, TermScore, TrendsFile } from './types'

export interface RunDeps {
  http: Http
  now: () => Date
  env: { CJ_API_KEY?: string }
  terms: Term[]
  previous: RadarFile | null
  products: { id: string; category: string; price: number }[]
  log: (line: string) => void
  cj?: boolean
  limit?: number
  only?: string[]
}

export const TOP_TERMS = 8
export const PER_TERM = 3
export const BREAKER = 3          // consecutive failures before a source is given up for the run
const DESTS: Dest[] = ['AU', 'US', 'GB']

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 120)
const hasSignal = (s: DailySeries | null): s is DailySeries => !!s && s.days.some((d) => d.value > 0)

/* Per-source bookkeeping: how many terms failed, whether the source has been cut off, and the status line that results. */
class SourceHealth {
  failed = 0; streak = 0; cut: string | null = null; last = ''
  constructor(private total: number) {}
  ok() { this.streak = 0 }
  fail(reason: string) { this.failed++; this.streak++; this.last = reason; if (this.streak >= BREAKER) this.cut = reason }
  get open() { return !this.cut }
  status(): string {
    if (this.cut || this.failed >= this.total) return `failed: ${this.last}`
    return this.failed ? `partial: ${this.failed} of ${this.total} failed (${this.last})` : 'ok'
  }
}

/* Which terms are worth a CJ search: everything Rising or better, plus the top 8 by score; never a term with no signal. */
export function selectTerms(scores: TermScore[]): TermScore[] {
  const withData = scores.filter((t) => t.confidence !== 'none')
  const byScore = [...withData].sort((a, b) => b.score - a.score)
  const chosen = new Set<string>([...withData.filter((t) => t.trendLabel !== 'Steady').map((t) => t.id), ...byScore.slice(0, TOP_TERMS).map((t) => t.id)])
  return byScore.filter((t) => chosen.has(t.id))
}

export async function runRadar(d: RunDeps): Promise<{ radar: RadarFile; trends: TrendsFile; ok: boolean }> {
  const now = d.now()
  const generatedAt = now.toISOString()
  const today = iso(now)
  const w = windowEnding(now)
  const terms = d.only?.length ? d.terms.filter((t) => d.only!.includes(t.id)) : d.terms
  const health: Record<SourceId, SourceHealth> = { wikipedia: new SourceHealth(terms.length), hackernews: new SourceHealth(terms.length), reddit: new SourceHealth(terms.length), tiwib: new SourceHealth(1) }
  const reddit = new RedditSource()

  let feed: NoveltyItem[] = []
  try { feed = await fetchFeed(d.http); health.tiwib.ok() } catch (e) { health.tiwib.fail(msg(e)); d.log(`tiwib: ${msg(e)}`) }

  const perTerm: { term: Term; series: DailySeries[] }[] = []
  for (const term of terms) {
    const series: DailySeries[] = []
    const take = (s: DailySeries | null) => { if (hasSignal(s)) series.push(s) }
    /* one adapter call, counted: a thrown error is a failure for that term; too many in a row and the source is left alone for the rest of the run */
    const guarded = async (id: SourceId, call: () => Promise<DailySeries | null>) => {
      if (!health[id].open) return null
      try { const s = await call(); health[id].ok(); return s } catch (e) { health[id].fail(msg(e)); d.log(`${term.id} ${id}: ${msg(e)}`); return null }
    }
    const [wk, hn] = await Promise.all([guarded('wikipedia', () => wikipedia(term, w, d.http)), guarded('hackernews', () => hackernews(term, w, d.http))])
    take(wk); take(hn)
    if (health.reddit.open) {
      const r = await guarded('reddit', () => reddit.fetchDaily(term, w, d.http))
      if (r) take(r)
      else if (reddit.status() !== 'ok') { health.reddit.fail(reddit.status().replace(/^failed: /, '')); if (/^failed/.test(reddit.status())) health.reddit.cut = reddit.status() }
    }
    if (health.tiwib.open) take(tiwibDaily(term, w, feed))
    perTerm.push({ term, series })
    d.log(`${term.id}: ${series.map((s) => s.source).join('+') || 'no data'}`)
  }
  const sources: Record<SourceId | 'cj', string> = { wikipedia: health.wikipedia.status(), hackernews: health.hackernews.status(), reddit: health.reddit.status(), tiwib: health.tiwib.status(), cj: 'skipped' }

  const termScores = scoreTerms(perTerm)
  const withData = termScores.filter((t) => t.confidence !== 'none').length
  const ok = withData >= Math.ceil(termScores.length / 2)
  const products = productTrends(termScores, terms)
  const novelty = feed.map((n) => ({ ...n, termId: matchTerm(n.title, d.terms) }))
  const rate = await fetchRate(d.http, d.previous?.rate ?? null, today)

  let candidates: Candidate[] = (d.previous?.candidates ?? []).map((c) => ({ ...c, stale: true }))
  let cjGeneratedAt = d.previous?.cjGeneratedAt ?? null
  const key = d.env.CJ_API_KEY
  if (d.cj !== false && key) {
    try {
      const cj = createCjClient({ apiKey: key, http: d.http })
      await cj.auth()
      const cats = await fetchCategories(cj)
      let selected = selectTerms(termScores)
      if (d.limit) selected = selected.slice(0, d.limit)
      const unranked: Unranked[] = []
      const seen = new Set<string>()
      let cjErrors = 0, cjStreak = 0
      const cjFail = (what: string, e: unknown) => { cjErrors++; cjStreak++; d.log(`${what}: ${msg(e)}`); if (cjStreak >= BREAKER) throw new Error(`${BREAKER} CJ calls failed in a row, last: ${msg(e)}`) }
      for (const ts of selected) {
        const term = terms.find((t) => t.id === ts.id)!
        let found: Awaited<ReturnType<typeof searchTerm>>
        try { found = await searchTerm(cj, term, cats); cjStreak = 0 } catch (e) { cjFail(`${term.id} search`, e); continue }
        const { items, scope } = found
        for (const item of items.filter((i) => !seen.has(i.pid)).slice(0, PER_TERM)) {
          seen.add(item.pid)
          let detail: Awaited<ReturnType<typeof fetchDetail>>
          try { detail = await fetchDetail(cj, item.pid); cjStreak = 0 } catch (e) { cjFail(`${item.pid} detail`, e); continue }
          if (!detail) { d.log(`${item.pid}: no usable variant, skipped`); continue }
          const variant = pickVariant(detail)
          const freight = {} as Record<Dest, FreightQuote | null>
          for (const dest of DESTS) freight[dest] = await fetchFreight(cj, variant.vid, dest).catch((e) => { d.log(`${item.pid} ${dest} freight: ${msg(e)}`); return null })
          const money = moneyFor(variant.priceUsd, freight.AU?.cheapest.usd ?? null, rate.usdAud, sectionMedian(d.products, term.section))
          const flags = flagsFor(`${detail.name} ${variant.name} ${item.categoryName}`, variant.weightG)
          unranked.push({ pid: item.pid, termId: term.id, section: term.section, name: detail.name, image: detail.images[0] ?? item.image, cjUrl: detail.productUrl, listedNum: item.listedNum, cjScope: scope, variant, freight, money, flags })
        }
      }
      candidates = rankCandidates(unranked, termScores, d.previous, today)
      sources.cj = cjErrors ? `partial: ${cjErrors} CJ calls failed` : 'ok'
      cjGeneratedAt = generatedAt
    } catch (e) {
      sources.cj = `failed: ${msg(e)}`
      d.log(`cj: ${msg(e)}`)
    }
  }

  const radar: RadarFile = { generatedAt, cjGeneratedAt, rate, sources, terms: termScores, candidates, novelty }
  const trends: TrendsFile = { generatedAt, window: w, sources: { wikipedia: sources.wikipedia, hackernews: sources.hackernews, reddit: sources.reddit, tiwib: sources.tiwib }, products, terms: termScores }
  return { radar, trends, ok }
}
