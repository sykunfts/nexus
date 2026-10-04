import { describe, expect, it } from 'vitest'
import { createHttp } from '../src/fetch'
import { CjError, createCjClient } from '../src/cj/client'
import { flattenCategories, parseFreight, parseList, parseQuery, pickVariant } from '../src/cj/parse'
import { resolveCategory, searchTerm } from '../src/cj/search'
import cats from './fixtures/cj-categories.json'
import list from './fixtures/cj-list.json'
import query from './fixtures/cj-query.json'
import freight from './fixtures/cj-freight.json'
import type { Term } from '../src/types'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
const term: Term = { id: 'laser-projector', label: 'Laser projectors', section: 'Home cinema', wikipedia: 'Video_projector', phrases: ['laser projector'], cj: { category: 'projector', keyword: 'laser projector' }, match: { all: [['projector']], not: ['lens cap', 'projector screen'] }, products: [] }

describe('cj parse', () => {
  it('flattenCategories finds Projectors at depth 3', () => {
    const flat = flattenCategories(cats)
    expect(flat.find((c) => c.name === 'Projectors')?.id).toBe('0AC6B44A-12CC-456F-831F-54064C77D303')
    expect(flat.length).toBe(6)
  })
  it('resolveCategory prefers the shortest match', () => {
    const flat = flattenCategories(cats)
    expect(resolveCategory(flat, 'camera')?.name).toBe('Camera')
    expect(resolveCategory(flat, 'projector')?.name).toBe('Projectors')
    expect(resolveCategory(flat, 'smart ring')?.name).toBe('Smart Rings')
    expect(resolveCategory(flat, 'nothing here')).toBeNull()
  })
  it('parseList keeps numeric prices and drops junk', () => {
    const items = parseList(list)
    expect(items.map((i) => i.pid)).toEqual(['P-A1', 'P-B2', 'P-D4'])   // "abc" price and the item without a pid are skipped
    expect(items[0].sellPrice).toBe(62.4)
    expect(items[0].listedNum).toBe(1532)
  })
  it('parseQuery picks the AU plug variant', () => {
    const d = parseQuery(query)!
    expect(d.variants.map((v) => v.vid)).toEqual(['V-US', 'V-AU'])   // the string-priced EU variant is excluded
    const v = pickVariant(d)
    expect(v.vid).toBe('V-AU'); expect(v.auPlug).toBe(true); expect(v.weightG).toBe(1350); expect(v.priceUsd).toBe(62.4); expect(v.variantCount).toBe(2)
  })
  it('skips a product with no usable variant', () => {
    expect(parseQuery({ result: true, data: { pid: 'x', productNameEn: 'x', variants: [] } })).toBeNull()
    expect(parseQuery({ result: true, data: { pid: 'x', productNameEn: 'x', variants: [{ vid: 'v', variantNameEn: 'n', variantSellPrice: 'free' }] } })).toBeNull()
    expect(parseQuery({ result: true })).toBeNull()
  })
  it('pickVariant falls back to the cheapest when no AU plug', () => {
    const d = parseQuery({ ...query, data: { ...query.data, variants: query.data.variants.filter((v) => v.vid !== 'V-AU') } })!
    const v = pickVariant(d)
    expect(v.vid).toBe('V-US'); expect(v.auPlug).toBe(false)
  })
  it('parseFreight marks cheapest and fastest and returns null on empty', () => {
    const q = parseFreight(freight)!
    expect(q.cheapest).toEqual({ name: 'CJPacket Ordinary', usd: 22.05, days: [6, 10] })
    expect(q.fastest.name).toBe('DHL Express')
    expect(q.lines).toBe(3)   // the broken line is dropped
    expect(parseFreight({ result: true, data: [] })).toBeNull()
    expect(parseFreight({ result: true })).toBeNull()
  })
})

describe('cj client and search', () => {
  it('client sends the token and throws CjError on result false', async () => {
    const calls: { url: string; init?: RequestInit }[] = []
    const http = createHttp({ fetch: async (url, init) => { calls.push({ url, init }); return url.endsWith('/authentication/getAccessToken') ? json({ result: true, data: { accessToken: 'tok-1' } }) : url.includes('/product/list') ? json(list) : json({ result: false, code: 1600200, message: 'bad request' }) }, sleep: async () => {}, retryDelays: [] })
    const cj = createCjClient({ apiKey: 'test-key', http })
    await cj.auth()
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ apiKey: 'test-key' })
    const out = await cj.get<typeof list>('/product/list', { pageNum: 1 })
    expect((calls[1].init?.headers as Record<string, string>)['CJ-Access-Token']).toBe('tok-1')
    expect(out.data.list.length).toBe(5)
    await expect(cj.get('/product/query', { pid: 'x' })).rejects.toBeInstanceOf(CjError)
  })
  it('searches within the resolved category and falls back to keyword scope', async () => {
    const urls: string[] = []
    const http = createHttp({ fetch: async (url) => { urls.push(url); return url.includes('getAccessToken') ? json({ result: true, data: { accessToken: 't' } }) : json(list) }, sleep: async () => {}, retryDelays: [] })
    const cj = createCjClient({ apiKey: 'k', http })
    await cj.auth()
    const flat = flattenCategories(cats)
    const scoped = await searchTerm(cj, { ...term, phrases: ['Laser Projector', '4K projector '] }, flat)
    expect(scoped.scope).toBe('category')
    const searches = urls.slice(1)
    expect(searches.length).toBe(2)   // keyword and the one new phrase; the repeated phrase is searched once
    expect(searches[0]).toContain('categoryId=0AC6B44A-12CC-456F-831F-54064C77D303')
    expect(searches[0]).toMatch(/productNameEn=laser(\+|%20)projector/)
    expect(searches[0]).toContain('pageSize=50')
    expect(searches[1]).toMatch(/productNameEn=4k(\+|%20)projector/)
    expect(searches[1]).toContain('categoryId=0AC6B44A-12CC-456F-831F-54064C77D303')
    expect(scoped.items.map((i) => i.pid)).toEqual(['P-A1', 'P-B2'])   // >= 3 USD, sorted by listedNum, merged by pid, the $1.20 cable dropped
    expect(scoped.items.every((i) => i.strength > 0)).toBe(true)
    expect(scoped.rejected.map((r) => r.pid)).not.toContain('P-C3')   // its "abc" price never parses, so it is in neither list
    expect(scoped.items.map((i) => i.pid)).not.toContain('P-C3')
    expect(scoped.rejected.map((r) => r.pid)).not.toContain('P-D4')   // under MIN_PRICE_USD: dropped without a record
    const before = urls.length
    const loose = await searchTerm(cj, { ...term, cj: { category: 'zzz', keyword: 'laser projector' } }, flat)
    expect(loose.scope).toBe('keyword')
    for (const u of urls.slice(before)) expect(u).not.toContain('categoryId')
  })

  it('gates titles, de-duplicates across phrases and stops at nine passes', async () => {
    let calls = 0
    const http = createHttp({ fetch: async (url) => {
      if (url.includes('getAccessToken')) return json({ result: true, data: { accessToken: 't' } })
      calls++
      const page = Array.from({ length: 6 }, (_, i) => ({ pid: `P-${calls}-${i}`, productNameEn: `Mini Projector ${calls}-${i}`, sellPrice: 20, listedNum: calls * 10 + i }))
      page.push({ pid: `P-${calls}-cap`, productNameEn: 'Projector Lens Cap', sellPrice: 5, listedNum: 1 })
      if (calls === 2) page.push({ pid: 'P-1-0', productNameEn: 'Mini Projector 1-0 again', sellPrice: 20, listedNum: 999 })   // seen in the first search: first one wins
      return json({ code: 200, result: true, data: { list: page } })
    }, sleep: async () => {}, retryDelays: [] })
    const cj = createCjClient({ apiKey: 'k', http })
    await cj.auth()
    const out = await searchTerm(cj, { ...term, phrases: ['portable projector', 'mini projector'] }, [])
    expect(calls).toBe(2)
    expect(out.items.length).toBe(12)
    expect(out.items.find((i) => i.pid === 'P-1-0')?.name).toBe('Mini Projector 1-0')
    expect(out.items.map((i) => i.listedNum)).toEqual([...out.items.map((i) => i.listedNum)].sort((a, b) => b - a))
    expect(out.rejected).toEqual([
      { pid: 'P-1-cap', termId: 'laser-projector', name: 'Projector Lens Cap', reason: 'has "lens cap"' },
      { pid: 'P-2-cap', termId: 'laser-projector', name: 'Projector Lens Cap', reason: 'has "lens cap"' },
    ])
  })

  it('a list item with no name is rejected, not thrown on', async () => {
    const http = createHttp({ fetch: async (url) => url.includes('getAccessToken')
      ? json({ result: true, data: { accessToken: 't' } })
      : json({ code: 200, result: true, data: { list: [{ pid: 'P-X', productNameEn: '', sellPrice: 9 }, { pid: 'P-Y', sellPrice: 9 }] } }), sleep: async () => {}, retryDelays: [] })
    const cj = createCjClient({ apiKey: 'k', http })
    await cj.auth()
    const out = await searchTerm(cj, term, [])
    expect(out.items).toEqual([])
    expect(out.rejected).toEqual([
      { pid: 'P-X', termId: 'laser-projector', name: '', reason: 'no "projector"' },
      { pid: 'P-Y', termId: 'laser-projector', name: '', reason: 'no "projector"' },
    ])
  })
})
