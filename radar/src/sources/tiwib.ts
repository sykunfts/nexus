/*
  This Is Why I'm Broke's public RSS feed as a small novelty signal: titles, links and dates only.
  Nothing else from the site is fetched; descriptions and images are never kept.
*/
import type { Http } from '../fetch'
import type { DailySeries, NoveltyItem, Term, Window } from '../types'
import { iso, seriesFrom } from '../window'

export const TIWIB_FEED = 'https://www.thisiswhyimbroke.com/feed/'

const unescape = (s: string) => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").trim()
const tag = (block: string, name: string) => { const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`)); return m ? unescape(m[1]) : '' }

export function parseFeed(xml: string): NoveltyItem[] {
  const items: NoveltyItem[] = []
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const block = m[1]
    const title = tag(block, 'title')
    const link = tag(block, 'link')
    const pub = tag(block, 'pubDate')
    const t = Date.parse(pub)
    if (!title || !link || Number.isNaN(t)) continue
    items.push({ title, link, date: iso(new Date(t)), termId: null })
  }
  return items
}

export async function fetchFeed(http: Http): Promise<NoveltyItem[]> {
  const res = await http(TIWIB_FEED, { headers: { Accept: 'application/rss+xml, application/xml, text/xml' } })
  if (!res.ok) throw new Error(`http ${res.status} ${TIWIB_FEED}`)
  return parseFeed(await res.text())
}

const phraseRe = (phrase: string) => new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
const matches = (title: string, term: Term) => term.phrases.some((p) => phraseRe(p).test(title))

export function matchTerm(title: string, terms: Term[]): string | null {
  return terms.find((t) => matches(title, t))?.id ?? null
}

/* Items per day whose title carries one of the term's phrases, over the window. Synchronous: the feed is fetched once per run. */
export function fetchDaily(term: Term, w: Window, feed: NoveltyItem[]): DailySeries {
  const values = new Map<string, number>()
  for (const it of feed) if (it.date >= w.from && it.date <= w.to && matches(it.title, term)) values.set(it.date, (values.get(it.date) ?? 0) + 1)
  return seriesFrom('tiwib', w, values)
}
