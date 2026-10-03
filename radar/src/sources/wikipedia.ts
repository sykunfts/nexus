/* Wikimedia REST pageviews for the term's article, daily, user agents only. A missing article is null, not an error. */
import type { Http } from '../fetch'
import type { DailySeries, Term, Window } from '../types'
import { seriesFrom } from '../window'

interface PageviewsResponse { items?: { timestamp: string; views: number }[] }

export const WIKI_BASE = 'https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user'

export async function fetchDaily(term: Term, w: Window, http: Http): Promise<DailySeries | null> {
  const ymd = (d: string) => d.replace(/-/g, '')
  const url = `${WIKI_BASE}/${encodeURIComponent(term.wikipedia)}/daily/${ymd(w.from)}/${ymd(w.to)}`
  const res = await http(url)
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`http ${res.status} ${url}`)
  const body = (await res.json()) as PageviewsResponse
  const values = new Map<string, number>()
  for (const it of body.items ?? []) {
    const t = String(it.timestamp)
    const date = `${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)}`
    if (typeof it.views === 'number') values.set(date, (values.get(date) ?? 0) + it.views)
  }
  return seriesFrom('wikipedia', w, values)
}
