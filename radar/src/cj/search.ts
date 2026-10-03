/* Category-scoped product search, product detail and freight, built on the client and the parsers. */
import type { CjClient } from './client'
import { CjError } from './client'
import { CjCategory, CjDetail, CjListItem, flattenCategories, parseFreight, parseList, parseQuery } from './parse'
import type { Dest, FreightQuote, Term } from '../types'

export const MIN_PRICE_USD = 3
export const PAGE_SIZE = 20
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

export async function searchTerm(cj: CjClient, term: Term, cats: CjCategory[]): Promise<{ items: CjListItem[]; scope: 'category' | 'keyword' }> {
  const cat = resolveCategory(cats, term.cj.category)
  const params: Record<string, string | number> = { productNameEn: term.cj.keyword, pageNum: 1, pageSize: PAGE_SIZE, ...(cat ? { categoryId: cat.id } : {}) }
  const items = parseList(await cj.get('/product/list', params))
    .filter((i) => i.sellPrice >= MIN_PRICE_USD)
    .sort((a, b) => b.listedNum - a.listedNum)
  return { items, scope: cat ? 'category' : 'keyword' }
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
