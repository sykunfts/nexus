import { describe, expect, it } from 'vitest'
import { dates, windowEnding } from '../src/window'
import { fetchDaily as wikipedia } from '../src/sources/wikipedia'
import { fetchDaily as hackernews } from '../src/sources/hackernews'
import { createHttp } from '../src/fetch'
import wikiFixture from './fixtures/wikipedia.json'
import hnFixture from './fixtures/hackernews.json'
import type { Term } from '../src/types'

const term: Term = { id: 'smart-ring', label: 'Smart rings', section: 'Wearables', wikipedia: 'Smart_ring', phrases: ['smart ring', 'sleep tracking ring'], cj: { category: 'smart ring', keyword: 'smart ring' }, match: { all: [['ring'], ['smart', 'sleep']] }, products: [] }
const w = windowEnding(new Date('2026-10-04T03:00:00Z'))
const httpWith = (handler: (url: string) => Response | Promise<Response>) => createHttp({ fetch: async (url) => handler(url), sleep: async () => {}, retryDelays: [] })
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

describe('window', () => {
  it('windowEnding gives 14 days ending yesterday', () => {
    expect(w).toEqual({ from: '2026-09-20', to: '2026-10-03', days: 14 })
    const d = dates(w)
    expect(d.length).toBe(14)
    expect(d[0]).toBe('2026-09-20')
    expect(d[13]).toBe('2026-10-03')
  })
})

describe('wikipedia', () => {
  it('parses a fixture into 14 zero-filled days', async () => {
    const urls: string[] = []
    const s = await wikipedia(term, w, httpWith((url) => { urls.push(url); return json(wikiFixture) }))
    expect(urls[0]).toContain('/per-article/en.wikipedia/all-access/user/Smart_ring/daily/20260920/20261003')
    expect(s?.source).toBe('wikipedia')
    expect(s?.days.length).toBe(14)
    expect(s?.days.find((d) => d.date === '2026-09-23')?.value).toBe(0)
    expect(s?.days.reduce((n, d) => n + d.value, 0)).toBe(wikiFixture.items.reduce((n, i) => n + i.views, 0))
  })
  it('404 → null', async () => {
    const s = await wikipedia(term, w, httpWith(() => json({ type: 'not_found' }, 404)))
    expect(s).toBeNull()
  })
})

describe('hackernews', () => {
  it('sums points per day across phrases', async () => {
    let calls = 0
    const s = await hackernews(term, w, httpWith(() => { calls++; return json(calls === 1 ? hnFixture : { hits: [] }) }))
    expect(calls).toBe(2)   // one call per phrase
    expect(s?.days.find((d) => d.date === '2026-10-01')?.value).toBe(42)
    expect(s?.days.find((d) => d.date === '2026-09-21')?.value).toBe(7)
    expect(s?.days.length).toBe(14)
  })
  it('empty hits → a series of zeros, not null', async () => {
    const s = await hackernews(term, w, httpWith(() => json({ hits: [] })))
    expect(s).not.toBeNull()
    expect(s?.days.every((d) => d.value === 0)).toBe(true)
  })
})
