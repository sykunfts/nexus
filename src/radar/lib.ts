/* Pure helpers for the Radar page: filtering, sorting, the approval link and the header's wording. */
import type { Candidate, Flag, RadarFile, Rate, SourceId } from '../../radar/src/types'
import { longDate } from '../lib/data'

/* The suggested price always earns the 45 % target, so margin cannot separate candidates; net dollars per sale can. */
export interface RadarFilters { section: string | null; minNet: 0 | 15 | 30; exclude: Flag[]; auPlugOnly: boolean; hideSkipped: boolean }
export type RadarSort = 'score' | 'net' | 'trend' | 'demand' | 'newest'

export const DEFAULT_FILTERS: RadarFilters = { section: null, minNet: 0, exclude: [], auPlugOnly: false, hideSkipped: true }
export const REPO = 'sykunfts/nexus'

const SOURCE_NAME: Record<SourceId | 'cj', string> = { wikipedia: 'Wikipedia', hackernews: 'Hacker News', reddit: 'Reddit', tiwib: 'TIWIB', cj: 'CJ' }
const join = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`)

export function filterCandidates(c: Candidate[], f: RadarFilters, skipped: Set<string>): Candidate[] {
  return c.filter((x) =>
    (!f.section || x.section === f.section) &&
    x.money.netAud >= f.minNet &&
    !x.flags.some((fl) => f.exclude.includes(fl)) &&
    (!f.auPlugOnly || x.variant.auPlug) &&
    (!f.hideSkipped || !skipped.has(x.pid)))
}

/* term id → delta, from the file's term scores, so the page can sort by trend. */
export const termDeltas = (f: RadarFile): Record<string, number> => Object.fromEntries(f.terms.map((t) => [t.id, t.delta]))

export function sortCandidates(c: Candidate[], s: RadarSort, deltas: Record<string, number> = {}): Candidate[] {
  const out = [...c]
  const delta = (x: Candidate) => deltas[x.termId] ?? 0
  switch (s) {
    case 'net': return out.sort((a, b) => b.money.netAud - a.money.netAud)
    case 'trend': return out.sort((a, b) => delta(b) - delta(a) || b.score - a.score)
    case 'demand': return out.sort((a, b) => b.listedNum - a.listedNum)
    case 'newest': return out.sort((a, b) => b.firstSeen.localeCompare(a.firstSeen) || b.score - a.score)
    default: return out.sort((a, b) => b.score - a.score)
  }
}

export function issueUrl(repo: string, c: Candidate): string {
  const body = `Adds this Radar find to the shop at the price below. The listing job writes the draft, closes this issue and rebuilds the site.\n\n\`\`\`json\n${JSON.stringify({ pid: c.pid, vid: c.variant.vid, retailAud: c.money.retailAud, termId: c.termId })}\n\`\`\``
  const sp = new URLSearchParams({ title: `list: ${c.pid}`, labels: 'listing', body })
  return `https://github.com/${repo}/issues/new?${sp.toString()}`
}

export function rateLabel(r: Rate): string {
  const amount = `A$${r.usdAud} per US dollar`
  if (r.source === 'ecb') return `${amount}, ECB rate for ${longDate(r.date + 'T12:00:00Z')}`
  if (r.source === 'previous') return `${amount}, carried from the previous run (${longDate(r.date + 'T12:00:00Z')})`
  return `${amount}, fixed fallback rate`
}

export function sourcesLine(s: RadarFile['sources']): string {
  const keys = Object.keys(s) as (SourceId | 'cj')[]
  if (keys.every((k) => s[k] === 'not yet run')) return 'The Radar has not run yet.'
  const fed = (v: string) => v === 'ok' || v.startsWith('partial')
  const ok = keys.filter((k) => fed(s[k])).map((k) => (s[k] === 'ok' ? SOURCE_NAME[k] : `${SOURCE_NAME[k]} (${s[k].replace(/^partial:\s*/, '').replace(/\s*\(.*\)$/, '')})`))
  const rest = keys.filter((k) => !fed(s[k])).map((k) => {
    const v = s[k]
    const m = v.match(/^failed:\s*(?:http\s*)?(\d{3})/)
    return `${SOURCE_NAME[k]}: ${m ? `blocked (${m[1]})` : v}.`
  })
  return [`${join(ok)} fed this run.`, ...rest].join(' ')
}

export function staleBanner(f: RadarFile): string | null {
  if (!f.candidates.length || !f.candidates.every((c) => c.stale)) return null
  return `CJ data from ${f.cjGeneratedAt ? longDate(f.cjGeneratedAt) : 'an earlier run'}; today’s run could not reach CJ.`
}
