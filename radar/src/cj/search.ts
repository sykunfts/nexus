/* Category-scoped product search (gated by the term's match rules), product detail and freight, built on the client and the parsers. */
import type { CjClient } from './client'
import { CjError } from './client'
import { CjCategory, CjDetail, CjListItem, flattenCategories, parseFreight, parseList, parseQuery } from './parse'
import { matchTitle } from '../match'
import type { Dest, FreightQuote, Rejected, Term } from '../types'

export const MIN_PRICE_USD = 3
export const PAGE_SIZE = 50
export const MAX_SEARCHES = 3
/** Stop searching once this many items have passed the match rules (PER_TERM * 3). */
export const ENOUGH = 9
export const ZIPS: Record<Dest, string> = { AU: '2000', US: '10001', GB: 'SW1A 1AA' }

export async function fetchCategories(cj: CjClient): Promise<CjCategory[]> {
  return flattenCategories(await cj.get('/product/getCategory', {}))
}

/* Case-insensitive substring; among several matches the shortest name is the most specific one. */
export function resolveCategory(cats: CjCategory[], fragment: string): CjCategory | null {
  const f = fragment.trim().toLowerCase()
  if (!f) return null
  const hits = cats.filter((c) => c.name.toLowerCase().includes(f))
  if (!hits.length) return null
  return [...hits].sort((a, b) => a.name.length - b.name.length)[0]
}

export type GatedItem = CjListItem & { strength: number }

/*
  Searches CJ once per distinct phrase (keyword first, at most MAX_SEARCHES), merges by pid (first seen wins),
  drops items under MIN_PRICE_USD without a record, and runs every other name through the term's match rules.
  Stops after the search in which ENOUGH items have passed. Passing items come back sorted by listedNum.
*/
export async function searchTerm(cj: CjClient, term: Term, cats: CjCategory[]): Promise<{ items: GatedItem[]; scope: 'category' | 'keyword'; rejected: Rejected[] }> {
  const cat = resolveCategory(cats, term.cj.category)
  const phrases = [...new Set([term.cj.keyword, ...term.phrases].map((p) => p.trim().toLowerCase()).filter(Boolean))].slice(0, MAX_SEARCHES)
  const seen = new Set<string>()
  const items: GatedItem[] = []
  const rejected: Rejected[] = []
  for (const phrase of phrases) {
    const params: Record<string, string | number> = { productNameEn: phrase, pageNum: 1, pageSize: PAGE_SIZE, ...(cat ? { categoryId: cat.id } : {}) }
    for (const item of parseList(await cj.get('/product/list', params))) {
      if (seen.has(item.pid)) continue
      seen.add(item.pid)
      if (item.sellPrice < MIN_PRICE_USD) continue
      const m = matchTitle(item.name, term)
      if (m.ok) items.push({ ...item, strength: m.strength })
      else rejected.push({ pid: item.pid, termId: term.id, name: item.name, reason: m.reason })
    }
    if (items.length >= ENOUGH) break
  }
  items.sort((a, b) => b.listedNum - a.listedNum)
  return { items, scope: cat ? 'category' : 'keyword', rejected }
}

export async function fetchDetail(cj: CjClient, pid: string): Promise<CjDetail | null> {
  return parseQuery(await cj.get('/product/query', { pid }))
}

export async function fetchFreight(cj: CjClient, vid: string, dest: Dest): Promise<FreightQuote | null> {
  const body = (code: string) => ({ startCountryCode: 'CN', endCountryCode: code, zip: ZIPS[dest], products: [{ quantity: 1, vid }] })
  try {
    return parseFreight(await cj.post('/logistic/freightCalculate', body(dest)))
  } catch (e) {
    if (dest === 'GB' && e instanceof CjError) return parseFreight(await cj.post('/logistic/freightCalculate', body('UK')))
    throw e
  }
}
