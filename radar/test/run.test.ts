import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { createHttp } from '../src/fetch'
import { runRadar } from '../src/run'
import terms from '../terms.json'
import wiki from './fixtures/wikipedia.json'
import hn from './fixtures/hackernews.json'
import reddit from './fixtures/reddit.json'
import cats from './fixtures/cj-categories.json'
import list from './fixtures/cj-list.json'
import query from './fixtures/cj-query.json'
import freight from './fixtures/cj-freight.json'
import type { RadarFile, Term } from '../src/types'

const feedXml = readFileSync(new URL('./fixtures/tiwib.xml', import.meta.url), 'utf8')
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
const now = () => new Date('2026-10-04T20:05:10Z')
const products = [{ id: 'xgimi-mogo-4-laser', category: 'Home cinema', price: 1099 }, { id: 'oura-ring-5', category: 'Wearables', price: 549 }]

/* Every source answers from its fixture; `over` swaps a route for a test. */
function fakeHttp(over: Partial<Record<'wiki' | 'hn' | 'reddit' | 'tiwib' | 'rate' | 'cj', (url: string, init?: RequestInit) => Response>> = {}) {
  return createHttp({
    sleep: async () => {}, retryDelays: [],
    fetch: async (url, init) => {
      if (url.includes('wikimedia.org')) return (over.wiki ?? (() => json(wiki)))(url, init)
      if (url.includes('hn.algolia.com')) return (over.hn ?? (() => json(hn)))(url, init)
      if (url.includes('reddit.com')) return (over.reddit ?? (() => json(reddit)))(url, init)
      if (url.includes('thisiswhyimbroke.com')) return (over.tiwib ?? (() => new Response(feedXml, { status: 200 })))(url, init)
      if (url.includes('frankfurter.app')) return (over.rate ?? (() => json({ date: '2026-10-03', rates: { AUD: 1.515 } })))(url, init)
      if (url.includes('cjdropshipping.com')) {
        if (over.cj) return over.cj(url, init)
        if (url.includes('getAccessToken')) return json({ result: true, data: { accessToken: 't' } })
        if (url.includes('getCategory')) return json(cats)
        if (url.includes('/product/list')) return json(list)
        if (url.includes('/product/query')) return json(query)
        if (url.includes('freightCalculate')) return json(freight)
      }
      return json({ error: 'unrouted ' + url }, 500)
    },
  })
}
const T = terms as Term[]
const base = { now, terms: T, previous: null, products, log: () => {} }

describe('runRadar', () => {
  it('a dry run produces both files with 31 terms and every product scored', async () => {
    const { radar, trends, ok } = await runRadar({ ...base, http: fakeHttp(), env: {}, cj: false })
    expect(ok).toBe(true)
    expect(radar.terms.length).toBe(31)
    expect(trends.terms.length).toBe(31)
    expect(Object.keys(trends.products).length).toBe(T.flatMap((t) => t.products).length)
    expect(trends.window).toEqual({ from: '2026-09-20', to: '2026-10-03', days: 14 })
    expect(radar.generatedAt).toBe('2026-10-04T20:05:10.000Z')
    expect(radar.sources.cj).toBe('skipped')
    expect(radar.sources.wikipedia).toBe('ok')
    expect(radar.novelty.length).toBe(15)
    expect(radar.novelty.find((n) => n.title.includes('Smart Ring'))?.termId).toBe('smart-ring')
    expect(radar.rate).toEqual({ usdAud: 1.515, source: 'ecb', date: '2026-10-03' })
  })
  it('a failed source renormalises weights and is recorded', async () => {
    const good = await runRadar({ ...base, http: fakeHttp(), env: {}, cj: false })
    const { radar } = await runRadar({ ...base, http: fakeHttp({ reddit: () => json({ message: 'Forbidden' }, 403) }), env: {}, cj: false })
    expect(radar.sources.reddit).toBe('failed: 403')
    // smart-glasses has no TIWIB match in the fixture: Wikipedia + HN + Reddit → high, without Reddit → medium
    const pick = (f: RadarFile) => f.terms.find((t) => t.id === 'smart-glasses')!
    expect(pick(good.radar).confidence).toBe('high')
    expect(pick(radar).confidence).toBe('medium')
    expect(pick(radar).sources.reddit).toBeNull()
  })
  it('skip-cj keeps previous candidates as stale', async () => {
    const previous = { generatedAt: '2026-10-03T20:00:00.000Z', cjGeneratedAt: '2026-10-03T20:00:00.000Z', rate: { usdAud: 1.5, source: 'ecb', date: '2026-10-02' }, sources: {}, terms: [], novelty: [],
      candidates: [{ pid: 'OLD', termId: 'smart-ring', firstSeen: '2026-10-01', score: 0.5 }] } as unknown as RadarFile
    const { radar } = await runRadar({ ...base, http: fakeHttp(), env: {}, cj: false, previous })
    expect(radar.candidates.length).toBe(1)
    expect(radar.candidates[0].stale).toBe(true)
    expect(radar.cjGeneratedAt).toBe('2026-10-03T20:00:00.000Z')
  })
  it('cj candidates carry money, flags, freight and score', async () => {
    const { radar } = await runRadar({ ...base, http: fakeHttp(), env: { CJ_API_KEY: 'k' }, cj: true, only: ['laser-projector'], limit: 1 })
    expect(radar.sources.cj).toBe('ok')
    expect(radar.candidates.length).toBeGreaterThan(0)
    const c = radar.candidates[0]
    expect(c.termId).toBe('laser-projector')
    expect(c.cjScope).toBe('category')
    expect(c.variant.auPlug).toBe(true)
    expect(c.freight.AU?.cheapest.usd).toBe(22.05)
    expect(c.money.retailAud % 1).toBeCloseTo(0.95, 2)
    expect(c.money.costAud).toBeCloseTo(62.4 * 1.515, 1)
    expect(c.flags).toContain('mains')
    expect(c.score).toBeGreaterThan(0)
    expect(c.firstSeen).toBe('2026-10-04')
    expect(c.why).toContain('Laser projectors')
    expect(radar.cjGeneratedAt).toBe(radar.generatedAt)
  })
  it('a cj failure mid-run keeps trends and marks cj failed', async () => {
    const { radar, trends } = await runRadar({ ...base, http: fakeHttp({ cj: () => json({ result: false, code: 1600001, message: 'key invalid' }) }), env: { CJ_API_KEY: 'bad' }, cj: true, limit: 1 })
    expect(radar.sources.cj.startsWith('failed')).toBe(true)
    expect(trends.terms.length).toBe(31)
  })
  it('fewer than half the terms with data → ok false', async () => {
    const dead = (u: string) => json({ error: u }, 404)
    const { ok } = await runRadar({ ...base, http: fakeHttp({ wiki: dead, hn: () => json({ error: 'x' }, 403), reddit: () => json({}, 403), tiwib: () => new Response('<rss></rss>', { status: 200 }) }), env: {}, cj: false })
    expect(ok).toBe(false)
  })
})
