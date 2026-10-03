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
const DESTS: Dest[] = ['AU', 'US', 'GB']

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 120)
const hasSignal = (s: DailySeries | null): s is DailySeries => !!s && s.days.some((d) => d.value > 0)

/* Which terms are worth a CJ search: everything Rising or better, plus the top 8 by score. */
export function selectTerms(scores: TermScore[]): TermScore[] {
  const byScore = [...scores].sort((a, b) => b.score - a.score)
  const chosen = new Set<string>([...scores.filter((t) => t.trendLabel !== 'Steady').map((t) => t.id), ...byScore.slice(0, TOP_TERMS).map((t) => t.id)])
  return byScore.filter((t) => chosen.has(t.id))
}

export async function runRadar(d: RunDeps): Promise<{ radar: RadarFile; trends: TrendsFile; ok: boolean }> {
  const now = d.now()
  const generatedAt = now.toISOString()
  const today = iso(now)
  const w = windowEnding(now)
  const sources: Record<SourceId | 'cj', string> = { wikipedia: 'ok', hackernews: 'ok', reddit: 'ok', tiwib: 'ok', cj: 'skipped' }
  const terms = d.only?.length ? d.terms.filter((t) => d.only!.includes(t.id)) : d.terms
  const reddit = new RedditSource()

  let feed: NoveltyItem[] = []
  try { feed = await fetchFeed(d.http) } catch (e) { sources.tiwib = `failed: ${msg(e)}`; d.log(`tiwib: ${msg(e)}`) }

  const perTerm: { term: Term; series: DailySeries[] }[] = []
  for (const term of terms) {
    const series: DailySeries[] = []
    const take = (s: DailySeries | null) => { if (hasSignal(s)) series.push(s) }
    const [wk, hn] = await Promise.all([
      wikipedia(term, w, d.http).catch((e) => { sources.wikipedia = `failed: ${msg(e)}`; return null }),
      hackernews(term, w, d.http).catch((e) => { sources.hackernews = `failed: ${msg(e)}`; return null }),
    ])
    take(wk); take(hn)
    if (sources.reddit === 'ok') {
      const r = await reddit.fetchDaily(term, w, d.http).catch((e) => { reddit.markFailed(msg(e)); return null })
      if (r) take(r); else sources.reddit = reddit.status()
    }
    if (sources.tiwib === 'ok') take(tiwibDaily(term, w, feed))
    perTerm.push({ term, series })
    d.log(`${term.id}: ${series.map((s) => s.source).join('+') || 'no data'}`)
  }

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
      for (const ts of selected) {
        const term = terms.find((t) => t.id === ts.id)!
        const { items, scope } = await searchTerm(cj, term, cats)
        for (const item of items.filter((i) => !seen.has(i.pid)).slice(0, PER_TERM)) {
          seen.add(item.pid)
          const detail = await fetchDetail(cj, item.pid)
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
      sources.cj = 'ok'
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
