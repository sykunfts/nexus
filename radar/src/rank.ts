/*
  The Radar score: trend momentum, dropshipper demand and margin headroom, less penalties for the
  things that quietly kill a listing (weight, a mains plug for the wrong country, junk pricing, no
  way to ship it here). firstSeen is carried from the previous file so "new today" means it.
*/
import type { Candidate, RadarFile, SourceId, TermScore } from './types'

export type Unranked = Omit<Candidate, 'score' | 'why' | 'firstSeen'>

export const PENALTY = { heavy: 0.15, mainsNoAu: 0.25, cheap: 0.15, noAuFreight: 0.40 }
export const WEIGHT = { trend: 0.45, demand: 0.35, margin: 0.20 }

const SOURCE_NAME: Record<SourceId, string> = { wikipedia: 'Wikipedia', hackernews: 'Hacker News', reddit: 'Reddit', tiwib: 'TIWIB' }
const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
const joinNames = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`)

export function rankCandidates(cands: Unranked[], terms: TermScore[], previous: RadarFile | null, today: string): Candidate[] {
  const maxListed = Math.max(1, ...cands.map((c) => c.listedNum))
  const seen = new Map((previous?.candidates ?? []).map((c) => [c.pid, c.firstSeen]))
  const out = cands.map((c) => {
    const term = terms.find((t) => t.id === c.termId)
    const trendZ = clamp01(((term?.score ?? 0) + 2) / 4)            // z in [−2, 2] → [0, 1]
    const demand = Math.log10(c.listedNum + 1) / Math.log10(maxListed + 1)
    const headroom = clamp01((c.money.marginPct - 0.30) / 0.30)
    let score = WEIGHT.trend * trendZ + WEIGHT.demand * demand + WEIGHT.margin * headroom
    const heavy = c.flags.includes('heavy') || c.variant.weightG > 2000
    if (heavy) score -= PENALTY.heavy
    if (c.flags.includes('mains') && !c.variant.auPlug) score -= PENALTY.mainsNoAu
    if (c.money.costAud < 5) score -= PENALTY.cheap
    if (!c.freight.AU) score -= PENALTY.noAuFreight
    const sources = term ? (Object.keys(term.sources) as SourceId[]).filter((s) => term.sources[s]).map((s) => SOURCE_NAME[s]) : []
    const delta = term?.delta ?? 0
    const why = `${term?.label ?? c.termId} ${delta >= 0 ? '+' : '−'}${Math.abs(delta)} % on ${joinNames(sources) || 'no source'}; ${c.listedNum.toLocaleString('en-US')} dropshippers list this; ${Math.round(c.money.marginPct * 100)} % margin at $${c.money.retailAud.toFixed(2)}.`
    return { ...c, score: Math.round(score * 1000) / 1000, why, firstSeen: seen.get(c.pid) ?? today, delta }
  })
  return out.sort((a, b) => b.score - a.score || b.delta - a.delta).map(({ delta: _d, ...c }) => c)
}
