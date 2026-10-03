/*
  Landed cost in AUD, a retail price that earns the target margin after GST and card fees,
  and the margin at other prices. The ECB rate comes from frankfurter.app; if that is down the
  previous run's rate is used, and with no previous run a fixed fallback, each labelled as such.
*/
import type { Http } from './fetch'
import type { Money, Rate } from './types'

export const FEE_PCT = 0.029
export const FEE_FIXED = 0.30
export const GST = 0.10
export const TARGET = 0.45
export const FALLBACK_RATE = 1.52
export const RATE_URL = 'https://api.frankfurter.app/latest?from=USD&to=AUD'

const round2 = (x: number) => Math.round(x * 100) / 100

/* The next price ending in .95 at or above x. */
export function pretty95(x: number): number {
  const base = Math.ceil(x - 0.95 - 1e-9)
  return round2(Math.max(0, base) + 0.95)
}

export function marginAt(retailAud: number, landedAud: number): { netAud: number; marginPct: number } {
  const exGst = retailAud / (1 + GST)
  const netAud = exGst - (FEE_PCT * retailAud + FEE_FIXED) - landedAud
  return { netAud: round2(netAud), marginPct: exGst > 0 ? netAud / exGst : 0 }
}

export function suggestedRetail(landedAud: number): number {
  const target = (landedAud + FEE_FIXED) / ((1 - TARGET) / (1 + GST) - FEE_PCT)
  return Math.max(pretty95(target), pretty95(landedAud * 1.8))
}

export function moneyFor(priceUsd: number, freightUsd: number | null, rate: number, sectionMedianAud: number | null): Money {
  const costAud = round2(priceUsd * rate)
  const freightAud = freightUsd === null ? 0 : round2(freightUsd * rate)
  const landedAud = round2(costAud + freightAud)
  const retailAud = suggestedRetail(landedAud)
  const m = marginAt(retailAud, landedAud)
  return {
    costAud, freightAud, landedAud, retailAud, marginPct: m.marginPct, netAud: m.netAud,
    at2x: marginAt(pretty95(landedAud * 2), landedAud).marginPct,
    at3x: marginAt(pretty95(landedAud * 3), landedAud).marginPct,
    sectionMedianAud,
  }
}

export function sectionMedian(products: { category: string; price: number }[], section: string): number | null {
  const ps = products.filter((p) => p.category === section).map((p) => p.price).sort((a, b) => a - b)
  if (!ps.length) return null
  const mid = Math.floor(ps.length / 2)
  return ps.length % 2 ? ps[mid] : (ps[mid - 1] + ps[mid]) / 2
}

export async function fetchRate(http: Http, previous: Rate | null, today: string): Promise<Rate> {
  try {
    const body = await http.json<{ date?: string; rates?: { AUD?: number } }>(RATE_URL)
    const r = body.rates?.AUD
    if (typeof r === 'number' && r > 0) return { usdAud: r, source: 'ecb', date: body.date ?? today }
  } catch { /* fall through */ }
  if (previous) return { usdAud: previous.usdAud, source: 'previous', date: previous.date }
  return { usdAud: FALLBACK_RATE, source: 'fallback', date: today }
}
