import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { windowEnding } from '../src/window'
import { createHttp } from '../src/fetch'
import { fetchDaily as reddit, RedditSource } from '../src/sources/reddit'
import { fetchDaily as tiwib, fetchFeed, matchTerm } from '../src/sources/tiwib'
import redditFixture from './fixtures/reddit.json'
import type { Term } from '../src/types'

const term: Term = { id: 'smart-ring', label: 'Smart rings', section: 'Wearables', wikipedia: 'Smart_ring', phrases: ['smart ring', 'sleep tracking ring'], cj: { category: 'smart ring', keyword: 'smart ring' }, products: [] }
const projector: Term = { ...term, id: 'laser-projector', label: 'Laser projectors', phrases: ['laser projector', '4k projector'] }
const w = windowEnding(new Date('2026-10-04T03:00:00Z'))
const httpWith = (handler: (url: string) => Response | Promise<Response>) => createHttp({ fetch: async (url) => handler(url), sleep: async () => {}, retryDelays: [] })
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
const feedXml = readFileSync(new URL('./fixtures/tiwib.xml', import.meta.url), 'utf8')

describe('reddit', () => {
  it('counts posts per day', async () => {
    let calls = 0
    const s = await reddit(term, w, httpWith(() => { calls++; return json(calls === 1 ? redditFixture : { data: { children: [] } }) }))
    expect(calls).toBe(2)
    expect(s?.days.find((d) => d.date === '2026-10-02')?.value).toBe(2)
    expect(s?.days.find((d) => d.date === '2026-09-25')?.value).toBe(1)
    expect(s?.days.reduce((n, d) => n + d.value, 0)).toBe(3)   // the September 1 post is outside the window
  })
  it('403 → null and status says so', async () => {
    const src = new RedditSource()
    const s = await src.fetchDaily(term, w, httpWith(() => json({ message: 'Forbidden' }, 403)))
    expect(s).toBeNull()
    expect(src.status()).toBe('failed: 403')
  })
})

describe('tiwib', () => {
  it('parses 15 items with titles, links and dates', async () => {
    const items = await fetchFeed(httpWith(() => new Response(feedXml, { status: 200, headers: { 'content-type': 'application/rss+xml' } })))
    expect(items.length).toBe(15)
    expect(items[0]).toEqual({ title: 'A Lamp That Looks Like A Cloud', link: 'https://www.thisiswhyimbroke.com/item-1/', date: '2026-10-03', termId: null })
  })
  it('counts phrase matches per day', async () => {
    const items = await fetchFeed(httpWith(() => new Response(feedXml, { status: 200 })))
    const s = tiwib(term, w, items)
    expect(s.days.find((d) => d.date === '2026-10-03')?.value).toBe(1)
    expect(s.days.find((d) => d.date === '2026-09-26')?.value).toBe(1)
    expect(s.days.reduce((n, d) => n + d.value, 0)).toBe(2)
  })
  it('matchTerm finds the term by phrase and returns null otherwise', () => {
    expect(matchTerm('Laser Projector For Your Backyard', [term, projector])).toBe('laser-projector')
    expect(matchTerm('Smart Ring With A Camera', [term, projector])).toBe('smart-ring')
    expect(matchTerm('Smartring without a space', [term, projector])).toBeNull()
    expect(matchTerm('Cat Hammock', [term, projector])).toBeNull()
  })
})
