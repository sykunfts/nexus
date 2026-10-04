import { describe, expect, it } from 'vitest'
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { PENALTY, rankCandidates, type Unranked } from '../src/rank'
import { readJson, writeAtomic } from '../src/write'
import { moneyFor } from '../src/money'
import type { RadarFile, TermScore } from '../src/types'

const term = (id: string, score: number, delta: number): TermScore => ({ id, label: id, section: 'Wearables', delta, trendLabel: 'Rising', score, confidence: 'high', series: [], sources: { wikipedia: { last7: 2, prior7: 1, growth: 1 }, hackernews: null, reddit: { last7: 2, prior7: 1, growth: 1 }, tiwib: null } })
const freight = { cheapest: { name: 'CJPacket', usd: 6, days: [8, 15] as [number, number] }, fastest: { name: 'DHL', usd: 30, days: [3, 5] as [number, number] }, lines: 2 }
const base = (pid: string, over: Partial<Unranked> = {}): Unranked => ({
  pid, termId: 'a', section: 'Wearables', name: `Item ${pid}`, image: '', cjUrl: '', listedNum: 1000, cjScope: 'category',
  variant: { vid: 'v', name: 'AU', weightG: 200, priceUsd: 20, auPlug: true, variantCount: 1 },
  freight: { AU: freight, US: null, GB: null }, money: moneyFor(20, 6, 1.5, null), flags: ['radio'], match: 1, ...over,
})

describe('rank', () => {
  const terms = [term('a', 1.2, 150), term('b', 0.2, 60)]
  it('orders by score then delta', () => {
    const out = rankCandidates([base('low', { termId: 'b' }), base('high', { termId: 'a' })], terms, null, '2026-10-04')
    expect(out.map((c) => c.pid)).toEqual(['high', 'low'])
    expect(out[0].score).toBeGreaterThan(out[1].score)
  })
  it('each penalty lowers the score by its amount', () => {
    const ref = rankCandidates([base('ref')], terms, null, '2026-10-04')[0].score
    const heavy = rankCandidates([base('h', { variant: { vid: 'v', name: 'AU', weightG: 2500, priceUsd: 20, auPlug: true, variantCount: 1 } })], terms, null, '2026-10-04')[0].score
    const mains = rankCandidates([base('m', { flags: ['mains'], variant: { vid: 'v', name: 'US', weightG: 200, priceUsd: 20, auPlug: false, variantCount: 1 } })], terms, null, '2026-10-04')[0].score
    // the money block is held constant so only the penalty moves the score
    const cheap = rankCandidates([base('c', { money: { ...moneyFor(20, 6, 1.5, null), costAud: 4.5 } })], terms, null, '2026-10-04')[0].score
    const noAu = rankCandidates([base('n', { freight: { AU: null, US: freight, GB: null } })], terms, null, '2026-10-04')[0].score
    expect(ref - heavy).toBeCloseTo(PENALTY.heavy, 2)   // heavy is derived from the weight even without the flag
    expect(ref - mains).toBeCloseTo(PENALTY.mainsNoAu, 2)
    expect(ref - cheap).toBeCloseTo(PENALTY.cheap, 2)
    expect(ref - noAu).toBeCloseTo(PENALTY.noAuFreight, 2)
  })
  it('firstSeen carries over by pid', () => {
    const previous = { candidates: [{ pid: 'old', firstSeen: '2026-09-28' }] } as unknown as RadarFile
    const out = rankCandidates([base('old'), base('new')], terms, previous, '2026-10-04')
    expect(out.find((c) => c.pid === 'old')!.firstSeen).toBe('2026-09-28')
    expect(out.find((c) => c.pid === 'new')!.firstSeen).toBe('2026-10-04')
  })
  it('profit beats listings under equally hot terms', () => {
    const hot = [term('a', 1, 300), term('b', 1, 300)]
    const big = base('big', { termId: 'a', listedNum: 1, money: { ...moneyFor(20, 6, 1.5, null), netAud: 60 } })
    const crowded = base('crowded', { termId: 'b', listedNum: 666, money: { ...moneyFor(20, 6, 1.5, null), netAud: 21 } })
    expect(rankCandidates([crowded, big], hot, null, '2026-10-04').map((c) => c.pid)).toEqual(['big', 'crowded'])
  })
  it('a falling term adds no heat', () => {
    const down = rankCandidates([base('x', { termId: 'd' })], [term('d', -1, -40)], null, '2026-10-04')[0]
    const flat = rankCandidates([base('y', { termId: 'f' })], [term('f', 0, 0)], null, '2026-10-04')[0]
    expect(down.score).toBeCloseTo(flat.score, 3)
  })
  it('thin candidates sort after ones that clear A$20, even with a higher score', () => {
    const thin = base('thin', { money: { ...moneyFor(20, 6, 1.5, null), netAud: 15 }, listedNum: 5000 })
    const ok = base('ok', { termId: 'b', money: { ...moneyFor(20, 6, 1.5, null), netAud: 25 }, listedNum: 1 })
    const out = rankCandidates([thin, ok], [term('a', 1, 300), term('b', -1, -10)], null, '2026-10-04')
    expect(out.map((c) => [c.pid, c.thin])).toEqual([['ok', false], ['thin', true]])
    expect(out[1].score).toBeGreaterThan(out[0].score)
  })
  it('why reads plainly with a hyphen-minus for a fall', () => {
    const c = rankCandidates([base('w', { termId: 'd' })], [term('d', -1, -12)], null, '2026-10-04')[0]
    expect(c.why).toMatch(/^d -12% on Wikipedia and Reddit; A\$\d+\.\d\d profit a sale at A\$\d+\.95; 1,000 dropshippers list it\.$/)
    expect(c.why).not.toMatch(/[–—−]/)
  })
  it('match strength and demand count for ten percent each', () => {
    const exact = rankCandidates([base('e', { match: 1 })], [term('a', 1, 0)], null, '2026-10-04')[0].score
    const close = rankCandidates([base('c', { match: 0.6 })], [term('a', 1, 0)], null, '2026-10-04')[0].score
    expect(exact - close).toBeCloseTo(0.04, 3)
  })
  it('writeAtomic leaves no temp file and round-trips', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'radar-'))
    const file = path.join(dir, 'out.json')
    await writeAtomic(file, { a: 1, b: [1, 2] })
    expect(readdirSync(dir)).toEqual(['out.json'])
    expect(readFileSync(file, 'utf8').endsWith('\n')).toBe(true)
    expect(await readJson<{ a: number }>(file)).toEqual({ a: 1, b: [1, 2] })
    expect(await readJson(path.join(dir, 'missing.json'))).toBeNull()
  })
})
