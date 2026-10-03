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
const term: Term = { id: 'laser-projector', label: 'Laser projectors', section: 'Home cinema', wikipedia: 'Video_projector', phrases: ['laser projector'], cj: { category: 'projector', keyword: 'laser projector' }, products: [] }

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
    const scoped = await searchTerm(cj, term, flat)
    expect(scoped.scope).toBe('category')
    expect(urls[1]).toContain('categoryId=0AC6B44A-12CC-456F-831F-54064C77D303')
    expect(urls[1]).toMatch(/productNameEn=laser(\+|%20)projector/)
    expect(scoped.items.map((i) => i.pid)).toEqual(['P-A1', 'P-B2'])   // ≥ 3 USD, sorted by listedNum, the $1.20 cable dropped
    const loose = await searchTerm(cj, { ...term, cj: { category: 'zzz', keyword: 'laser projector' } }, flat)
    expect(loose.scope).toBe('keyword')
    expect(urls[2]).not.toContain('categoryId')
  })
})
