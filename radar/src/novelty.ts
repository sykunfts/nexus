/*
  The novelty feed (TIWIB) mixes gadgets with things a gadget shop cannot sell or advertise.
  Titles naming alcohol, tobacco and vaping, weapons, or adult products are hidden from the Radar.
  Whole-word matching, so "Gunmetal" and "Sussex" stay. The pipeline filters before writing radar.json and
  the Radar page filters again, so an older file is cleaned on screen too.
*/
import { hasEntry } from './match'
import type { NoveltyItem } from './types'

export const BLOCKED: string[] = [
  'alcohol', 'beer', 'wine', 'wines', 'vodka', 'whisky', 'whiskey', 'rum', 'gin', 'tequila', 'liquor', 'booze', 'flask',
  'cannabis', 'marijuana', 'weed', 'cbd', 'thc', 'vape', 'vaping', 'cigarette', 'cigarettes', 'cigar', 'tobacco', 'nicotine', 'bong',
  'weapon', 'weapons', 'knife', 'knives', 'dagger', 'sword', 'gun', 'guns', 'firearm', 'rifle', 'pistol', 'ammo', 'ammunition', 'crossbow', 'taser',
  'sex', 'sexy', 'adult', 'erotic', 'fleshlight', 'dildo', 'vibrator', 'lingerie', 'porn',
]

export function isBlocked(title: string): boolean {
  return BLOCKED.some((word) => hasEntry(title, word))
}

/** Drops blocked titles; items matched to a watch term come first, feed order otherwise. */
export function filterNovelty(items: NoveltyItem[]): { items: NoveltyItem[]; hidden: number } {
  const kept = items.filter((i) => !isBlocked(i.title))
  return { items: [...kept.filter((i) => i.termId), ...kept.filter((i) => !i.termId)], hidden: items.length - kept.length }
}
