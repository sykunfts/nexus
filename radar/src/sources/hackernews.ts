/* Hacker News through Algolia: story points per day for each phrase, summed. One strong story beats ten dead ones. */
import type { Http } from '../fetch'
import type { DailySeries, Term, Window } from '../types'
import { dateOfEpoch, epochStart, seriesFrom } from '../window'

interface AlgoliaResponse { hits?: { points?: number | null; created_at_i?: number }[] }

export const HN_BASE = 'https://hn.algolia.com/api/v1/search_by_date'

export async function fetchDaily(term: Term, w: Window, http: Http): Promise<DailySeries | null> {
  const from = epochStart(w.from)
  const until = epochStart(w.to) + 86_400
  const values = new Map<string, number>()
  for (const phrase of term.phrases) {
    const url = `${HN_BASE}?query=${encodeURIComponent(phrase)}&tags=story&numericFilters=${encodeURIComponent(`created_at_i>${from},created_at_i<${until}`)}&hitsPerPage=1000`
    const body = await http.json<AlgoliaResponse>(url)
    for (const h of body.hits ?? []) {
      if (typeof h.created_at_i !== 'number') continue
      const date = dateOfEpoch(h.created_at_i)
      values.set(date, (values.get(date) ?? 0) + (typeof h.points === 'number' ? h.points : 0))
    }
  }
  return seriesFrom('hackernews', w, values)
}
