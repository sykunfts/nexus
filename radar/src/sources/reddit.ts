/*
  Reddit site-wide search, posts per day per phrase. Reddit turns away many data-centre addresses with
  403; that is recorded as a failed source for the run, not an error that stops it.
*/
import type { Http } from '../fetch'
import type { DailySeries, Term, Window } from '../types'
import { dateOfEpoch, epochStart, seriesFrom } from '../window'

interface RedditResponse { data?: { children?: { data?: { created_utc?: number } }[] } }

export const REDDIT_BASE = 'https://www.reddit.com/search.json'

export class RedditSource {
  private last = 'ok'
  status(): string { return this.last }
  markFailed(reason: string) { this.last = `failed: ${reason}` }

  async fetchDaily(term: Term, w: Window, http: Http): Promise<DailySeries | null> {
    const from = epochStart(w.from)
    const until = epochStart(w.to) + 86_400
    const values = new Map<string, number>()
    for (const phrase of term.phrases) {
      const url = `${REDDIT_BASE}?q=${encodeURIComponent(phrase)}&sort=new&t=month&limit=100&raw_json=1`
      const res = await http(url)
      if (!res.ok) { this.last = `failed: ${res.status}`; return null }
      const body = (await res.json()) as RedditResponse
      const children = body.data?.children ?? []
      /* A full page whose oldest post is still inside the window hides the earlier week: growth would read as the page size. */
      const oldest = Math.min(...children.map((c) => c.data?.created_utc ?? Infinity))
      if (children.length >= 100 && oldest >= from) { this.last = `truncated: more than 100 posts in the window for "${phrase}"`; return null }
      for (const c of children) {
        const t = c.data?.created_utc
        if (typeof t !== 'number' || t < from || t >= until) continue
        const date = dateOfEpoch(t)
        values.set(date, (values.get(date) ?? 0) + 1)
      }
    }
    this.last = 'ok'
    return seriesFrom('reddit', w, values)
  }
}

const shared = new RedditSource()
export const fetchDaily = (term: Term, w: Window, http: Http) => shared.fetchDaily(term, w, http)
export const status = () => shared.status()
