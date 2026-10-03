import { describe, expect, it } from 'vitest'
import { createHttp } from '../src/fetch'
import { FALLBACK_RATE, fetchRate, marginAt, moneyFor, pretty95, sectionMedian, suggestedRetail, TARGET } from '../src/money'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
const httpWith = (handler: (url: string) => Response | Promise<Response>) => createHttp({ fetch: async (url) => handler(url), sleep: async () => {}, retryDelays: [] })

describe('money', () => {
  it('pretty95 rounds up to .95', () => {
    expect(pretty95(44.69)).toBe(44.95)
    expect(pretty95(44.95)).toBe(44.95)
    expect(pretty95(45)).toBe(45.95)
    expect(pretty95(0.5)).toBe(0.95)
  })
  it('suggestedRetail hits 45 % net margin and never sits below 1.8× landed', () => {
    const landed = 44.69
    const retail = suggestedRetail(landed)
    const m = marginAt(retail, landed)
    expect(retail % 1).toBeCloseTo(0.95, 2)
    expect(m.marginPct).toBeGreaterThanOrEqual(TARGET)
    expect(m.marginPct).toBeLessThan(TARGET + 0.02)
    expect(retail).toBeGreaterThanOrEqual(pretty95(landed * 1.8))
    expect(suggestedRetail(5)).toBeGreaterThanOrEqual(pretty95(9))   // the 1.8× floor wins on cheap items
  })
  it('marginAt is 0 at breakeven and negative below', () => {
    const retail = 110
    const landed = retail / 1.1 - (0.029 * retail + 0.30)
    expect(marginAt(retail, landed).marginPct).toBeCloseTo(0, 6)
    expect(marginAt(retail, landed + 10).netAud).toBeCloseTo(-10, 6)
  })
  it('rate falls back in order', async () => {
    const previous = { usdAud: 1.49, source: 'ecb' as const, date: '2026-10-02' }
    const ok = await fetchRate(httpWith(() => json({ amount: 1, base: 'USD', date: '2026-10-03', rates: { AUD: 1.515 } })), previous, '2026-10-04')
    expect(ok).toEqual({ usdAud: 1.515, source: 'ecb', date: '2026-10-03' })
    const prev = await fetchRate(httpWith(() => json({ error: 'down' }, 503)), previous, '2026-10-04')
    expect(prev).toEqual({ usdAud: 1.49, source: 'previous', date: '2026-10-02' })
    const fb = await fetchRate(httpWith(() => { throw new Error('offline') }), null, '2026-10-04')
    expect(fb).toEqual({ usdAud: FALLBACK_RATE, source: 'fallback', date: '2026-10-04' })
  })
  it('moneyFor converts, lands, prices and reports the alternatives', () => {
    const m = moneyFor(23.4, 6.1, 1.515, 399)
    expect(m.costAud).toBeCloseTo(35.45, 2)
    expect(m.freightAud).toBeCloseTo(9.24, 2)
    expect(m.landedAud).toBeCloseTo(44.69, 2)
    expect(m.retailAud).toBe(suggestedRetail(m.landedAud))
    expect(m.marginPct).toBeCloseTo(marginAt(m.retailAud, m.landedAud).marginPct, 6)
    expect(m.at2x).toBeCloseTo(marginAt(pretty95(m.landedAud * 2), m.landedAud).marginPct, 6)
    expect(m.at3x).toBeGreaterThan(m.at2x)
    expect(m.sectionMedianAud).toBe(399)
    const noFreight = moneyFor(23.4, null, 1.515, null)
    expect(noFreight.freightAud).toBe(0)
    expect(noFreight.landedAud).toBeCloseTo(noFreight.costAud, 6)
  })
  it('sectionMedian uses the shop prices', () => {
    const ps = [{ category: 'Wearables', price: 100 }, { category: 'Wearables', price: 300 }, { category: 'Wearables', price: 500 }, { category: 'Audio', price: 50 }]
    expect(sectionMedian(ps, 'Wearables')).toBe(300)
    expect(sectionMedian(ps, 'Audio')).toBe(50)
    expect(sectionMedian(ps, 'Nope')).toBeNull()
  })
})
