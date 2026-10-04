/*
  Does a CJ product title belong to a watch term? Each term carries its own rules in terms.json:
  every `all` group needs at least one hit, and nothing from the term's `not` list or the shared NEVER list may appear.
  Matching is whole-word and case-insensitive: an entry only counts where it is not glued to another letter or digit,
  so "gin" is not found in "engine" and "3d printer" is not found in "1.83D Printer".
*/
import type { Term } from './types'

/** Words that never belong to any gadget term (clothing and furniture CJ's loose name search drags in). */
export const NEVER: string[] = ['shoes', 'jacket', 'coat', 'backpack', 'dress', 'chair', 'sofa', 'curtain', 'wig']

export type MatchResult = { ok: true; strength: number } | { ok: false; reason: string }

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** True when `entry` appears in `text` as a whole word (or phrase), ignoring case. */
export function hasEntry(text: string, entry: string): boolean {
  return new RegExp(`(?<![\\p{L}\\p{N}])${escape(entry)}(?![\\p{L}\\p{N}])`, 'iu').test(text)
}

export function matchTitle(title: string, term: Term): MatchResult {
  for (const entry of [...(term.match.not ?? []), ...NEVER]) {
    if (hasEntry(title, entry)) return { ok: false, reason: `has "${entry}"` }
  }
  for (const group of term.match.all) {
    if (!group.some((entry) => hasEntry(title, entry))) return { ok: false, reason: `no "${group[0]}"` }
  }
  return { ok: true, strength: hasEntry(title, term.cj.keyword) ? 1 : 0.6 }
}
