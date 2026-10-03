import { describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { draftListing, decide, parseIssue } from '../src/listing'
import { moneyFor } from '../src/money'
import type { Candidate, RadarFile } from '../src/types'

const freight = { cheapest: { name: 'CJPacket Ordinary', usd: 22.05, days: [6, 10] as [number, number] }, fastest: { name: 'DHL', usd: 48.2, days: [3, 5] as [number, number] }, lines: 3 }
const cand: Candidate = {
  pid: 'P-A1', termId: 'laser-projector', section: 'Home cinema', name: 'Mini Laser Projector 1080P Portable Home Cinema With A Very Long Name That Goes On', image: 'https://cc.example/a1.jpg', cjUrl: 'https://www.cjdropshipping.com/product/-p-P-A1.html',
  listedNum: 1532, cjScope: 'category', variant: { vid: 'V-AU', name: 'AU Plug / Black', weightG: 1350, priceUsd: 62.4, auPlug: true, variantCount: 2 },
  freight: { AU: freight, US: null, GB: null }, money: moneyFor(62.4, 22.05, 1.515, 1099), flags: ['mains', 'radio'], score: 0.71, firstSeen: '2026-10-04', why: 'why',
}
const radar = { generatedAt: '2026-10-04T20:05:10.000Z', candidates: [cand] } as unknown as RadarFile

describe('draft listing', () => {
  it('makes a Product that passes the catalogue rules', () => {
    const p = draftListing(cand, { delta: 150, label: 'Trending', score: 1, confidence: 'high', series: [1, 2] }, '2026-10-04', cand.money.retailAud)
    expect(p.id).toBe('cj-P-A1')
    expect(p.name.length).toBeLessThanOrEqual(60)
    expect(p.category).toBe('Home cinema')
    expect(p.price).toBe(cand.money.retailAud)
    expect(p.priceSource).toEqual({ amount: 62.4, currency: 'USD', at: '2026-10-04' })
    expect(p.fulfil).toEqual({ route: 'supplier', origin: 'CN' })
    expect(p.market).toBe('global')
    expect(p.variants.length).toBeGreaterThan(0)
    expect(p.photos).toEqual(['https://cc.example/a1.jpg'])
    expect(p.facts.plug).toBe('AU')
    expect(p.facts.voltage).toBe('100-240')
    expect(p.sources).toEqual([cand.cjUrl])
    expect(p.specs.flatMap((g) => g.rows).length).toBeGreaterThanOrEqual(3)
    expect(p.badges).toContain('From the Radar')
    expect(p.trend.label).toBe('Trending')
    expect(p.notes).toContain('RCM')
    expect(p.rating).toBeNull()
    expect(p.listedAt).toBe('2026-10-04')
  })
  it('without a trend or an AU plug it stays honest', () => {
    const p = draftListing({ ...cand, variant: { ...cand.variant, auPlug: false, name: 'US Plug' } }, null, '2026-10-04', 199.95)
    expect(p.facts.plug).toBeUndefined()
    expect(p.trend.label).toBe('Steady')
    expect(p.trend.delta).toBe(0)
  })
})

describe('approval', () => {
  it('parseIssue reads the body and rejects garbage', () => {
    expect(parseIssue('list: P-A1', 'Adds the product to the shop.\n```json\n{"pid":"P-A1","vid":"V-AU","retailAud":199.95,"termId":"laser-projector"}\n```')).toEqual({ pid: 'P-A1', vid: 'V-AU', retailAud: 199.95, termId: 'laser-projector' })
    expect(parseIssue('list: P-A1', '{"pid":"P-A1","vid":"V-AU","retailAud":199.95,"termId":"laser-projector"}')).toEqual({ pid: 'P-A1', vid: 'V-AU', retailAud: 199.95, termId: 'laser-projector' })
    expect(parseIssue('hello', '{"pid":"P-A1"}')).toBeNull()
    expect(parseIssue('list: P-A1', 'no json here')).toBeNull()
    expect(parseIssue('list: P-A1', '{"pid":"P-A1","vid":"V-AU","retailAud":"lots","termId":"x"}')).toBeNull()
  })
  it('refuses an issue from another user', () => {
    const d = decide({ author: 'mallory', owner: 'sykunfts', title: 'list: P-A1', body: '{"pid":"P-A1","vid":"V-AU","retailAud":199.95,"termId":"laser-projector"}', radar })
    expect(d.ok).toBe(false)
    if (!d.ok) expect(d.reason).toMatch(/owner/)
  })
  it('refuses a retail below landed and an unknown pid, accepts a good one', () => {
    const body = (retail: number, pid = 'P-A1') => JSON.stringify({ pid, vid: 'V-AU', retailAud: retail, termId: 'laser-projector' })
    const low = decide({ author: 'sykunfts', owner: 'sykunfts', title: 'list: P-A1', body: body(10), radar })
    expect(low.ok).toBe(false)
    const unknown = decide({ author: 'sykunfts', owner: 'sykunfts', title: 'list: NOPE', body: body(199.95, 'NOPE'), radar })
    expect(unknown.ok).toBe(false)
    const good = decide({ author: 'sykunfts', owner: 'sykunfts', title: 'list: P-A1', body: body(199.95), radar })
    expect(good.ok).toBe(true)
    if (good.ok) { expect(good.product.id).toBe('cj-P-A1'); expect(good.product.price).toBe(199.95) }
  })
  it('merge-listings produces a module from a listings folder', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'listings-'))
    mkdirSync(path.join(dir, 'data', 'listings'), { recursive: true })
    mkdirSync(path.join(dir, 'src', 'lib'), { recursive: true })
    const p = draftListing(cand, null, '2026-10-04', 199.95)
    writeFileSync(path.join(dir, 'data', 'listings', 'P-A1.json'), JSON.stringify(p))
    execFileSync('node', [path.resolve('scripts/merge-listings.mjs'), dir])
    const out = readFileSync(path.join(dir, 'src', 'lib', 'data.listings.ts'), 'utf8')
    expect(out).toContain('export const LISTINGS: Product[] = ')
    expect(out).toContain('"id": "cj-P-A1"')
    execFileSync('node', [path.resolve('scripts/merge-listings.mjs'), mkdtempSync(path.join(tmpdir(), 'empty-'))])
  })
})
