/*
  The Radar score (v2): how hot the term is, how much a sale makes, how sure the match is and how many
  dropshippers already list it, less penalties for the things that quietly kill a listing (weight, a mains
  plug for the wrong country, junk pricing, no way to ship it here). Anything making under PROFIT_FLOOR a
  sale is "thin" and sorts after everything that clears it. firstSeen is carried from the previous file
  so "new today" means it.
*/
import type { Candidate, Confidence, RadarFile, SourceId, TermScore } from './types'

export type Unranked = Omit<Candidate, 'score' | 'why' | 'firstSeen' | 'thin'>

export const PENALTY = { heavy: 0.15, mainsNoAu: 0.25, cheap: 0.15, noAuFreight: 0.40 }
export const WEIGHT = { heat: 0.45, profit: 0.35, match: 0.10, demand: 0.10 }
export const HEAT_FULL = 300        // % week-on-week change that counts as fully hot
export const PROFIT_FULL = 60       // A$ profit a sale that counts as full marks
export const PROFIT_FLOOR = 20      // under this a sale is "thin"
export const DEMAND_FULL = 1000     // dropshippers listing it that counts as full demand
export const CONFIDENCE: Record<Confidence, number> = { high: 1, medium: 0.85, low: 0.6, none: 0 }

const SOURCE_NAME: Record<SourceId, string> = { wikipedia: 'Wikipedia', hackernews: 'Hacker News', reddit: 'Reddit', tiwib: 'TIWIB' }
const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
const joinNames = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`)

export function rankCandidates(cands: Unranked[], terms: TermScore[], previous: RadarFile | null, today: string): Candidate[] {
  const seen = new Map((previous?.candidates ?? []).map((c) => [c.pid, c.firstSeen]))
  const out = cands.map((c) => {
    const term = terms.find((t) => t.id === c.termId)
    const delta = term?.delta ?? 0
    const heat = clamp01(delta / HEAT_FULL) * CONFIDENCE[term?.confidence ?? 'none']
    const profit = clamp01(c.money.netAud / PROFIT_FULL)
    const demand = clamp01(Math.log10(c.listedNum + 1) / Math.log10(DEMAND_FULL + 1))
    let score = WEIGHT.heat * heat + WEIGHT.profit * profit + WEIGHT.match * c.match + WEIGHT.demand * demand
    const heavy = c.flags.includes('heavy') || c.variant.weightG > 2000
    if (heavy) score -= PENALTY.heavy
    if (c.flags.includes('mains') && !c.variant.auPlug) score -= PENALTY.mainsNoAu
    if (c.money.costAud < 5) score -= PENALTY.cheap
    if (!c.freight.AU) score -= PENALTY.noAuFreight
    const sources = term ? (Object.keys(term.sources) as SourceId[]).filter((s) => term.sources[s]).map((s) => SOURCE_NAME[s]) : []
    const why = `${term?.label ?? c.termId} ${delta > 0 ? '+' : ''}${delta}% on ${joinNames(sources) || 'no source'}; A$${c.money.netAud.toFixed(2)} profit a sale at A$${c.money.retailAud.toFixed(2)}; ${c.listedNum.toLocaleString('en-US')} dropshippers list it.`
    return { ...c, score: Math.round(score * 1000) / 1000, why, firstSeen: seen.get(c.pid) ?? today, thin: c.money.netAud < PROFIT_FLOOR, delta }
  })
  return out
    .sort((a, b) => Number(a.thin) - Number(b.thin) || b.score - a.score || b.delta - a.delta)
    .map(({ delta: _d, ...c }) => c)
}
