/* Tolerant readers for CJ replies: a field that is missing or the wrong type drops the item, never the run. */
import type { CandidateVariant, FreightLine, FreightQuote } from '../types'

export interface CjCategory { id: string; name: string }
export interface CjListItem { pid: string; name: string; image: string; sellPrice: number; listedNum: number; categoryName: string }
export interface CjVariant { vid: string; name: string; key: string; priceUsd: number; weightG: number }
export interface CjDetail { pid: string; name: string; images: string[]; variants: CjVariant[]; productUrl: string }

const num = (x: unknown): number | null => { const n = typeof x === 'number' ? x : typeof x === 'string' ? Number(x) : NaN; return Number.isFinite(n) ? n : null }
const str = (x: unknown): string => (typeof x === 'string' ? x : '')
const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null

/* Walks CJ's nested category tree (first → second → third level) at any depth and keeps every node with an id. */
export function flattenCategories(json: unknown): CjCategory[] {
  const out: CjCategory[] = []
  const walk = (node: unknown) => {
    if (Array.isArray(node)) { node.forEach(walk); return }
    if (!isObj(node)) return
    const id = str(node.categoryId); const name = str(node.categoryName)
    if (id && name) out.push({ id, name })
    for (const v of Object.values(node)) if (Array.isArray(v)) walk(v)
  }
  walk(isObj(json) ? json.data : json)
  return out
}

export function parseList(json: unknown): CjListItem[] {
  const data = isObj(json) && isObj(json.data) ? json.data : null
  const list = data && Array.isArray(data.list) ? data.list : []
  const out: CjListItem[] = []
  for (const it of list) {
    if (!isObj(it)) continue
    const pid = str(it.pid); const name = str(it.productNameEn); const price = num(it.sellPrice)
    if (!pid || price === null) continue   // a missing name is kept (as '') so the match gate can reject it with a reason
    out.push({ pid, name, image: str(it.productImage), sellPrice: price, listedNum: num(it.listedNum) ?? 0, categoryName: str(it.categoryName) })
  }
  return out
}

export function parseQuery(json: unknown): CjDetail | null {
  const d = isObj(json) && isObj(json.data) ? json.data : null
  if (!d) return null
  const pid = str(d.pid); const name = str(d.productNameEn)
  if (!pid || !name) return null
  const variants: CjVariant[] = []
  for (const v of Array.isArray(d.variants) ? d.variants : []) {
    if (!isObj(v)) continue
    const vid = str(v.vid); const price = num(v.variantSellPrice)
    if (!vid || price === null || price <= 0) continue
    variants.push({ vid, name: str(v.variantNameEn), key: str(v.variantKey), priceUsd: price, weightG: num(v.variantWeight) ?? 0 })
  }
  if (!variants.length) return null
  const images = Array.isArray(d.productImageSet) ? d.productImageSet.filter((x): x is string => typeof x === 'string') : []
  const productUrl = str(d.productUrl) || `https://www.cjdropshipping.com/product/-p-${pid}.html`
  return { pid, name, images, variants, productUrl }
}

const AU_RE = /\bAU\b|Australia/i

export function pickVariant(d: CjDetail): CandidateVariant {
  const au = d.variants.find((v) => AU_RE.test(v.name) || AU_RE.test(v.key))
  const chosen = au ?? [...d.variants].sort((a, b) => a.priceUsd - b.priceUsd)[0]
  return { vid: chosen.vid, name: chosen.name || chosen.key || 'Default', weightG: chosen.weightG, priceUsd: chosen.priceUsd, auPlug: !!au, variantCount: d.variants.length }
}

export function parseFreight(json: unknown): FreightQuote | null {
  const data = isObj(json) ? json.data : null
  const lines: FreightLine[] = []
  for (const l of Array.isArray(data) ? data : []) {
    if (!isObj(l)) continue
    const name = str(l.logisticName); const usd = num(l.logisticPrice)
    const m = str(l.logisticAging).match(/(\d+)\s*-\s*(\d+)/)
    if (!name || usd === null || !m) continue
    lines.push({ name, usd, days: [Number(m[1]), Number(m[2])] })
  }
  if (!lines.length) return null
  const cheapest = [...lines].sort((a, b) => a.usd - b.usd)[0]
  const fastest = [...lines].sort((a, b) => a.days[1] - b.days[1] || a.usd - b.usd)[0]
  return { cheapest, fastest, lines: lines.length }
}
