/*
  Typed hash routes. The store's `route` is the source of truth; the hash mirrors it when the
  frame allows history changes, and `hashchange` feeds it back. Filters serialise as
  `key:value` pairs joined by `;` so a filtered collection link is shareable.
*/
import { products } from './data'

export type Sort = 'trending' | 'price-asc' | 'price-desc' | 'rating' | 'newest'
export type Platform = 'ios' | 'android' | 'homekit' | 'google' | 'alexa' | 'matter' | 'thread'
export type Badge = 'Viral' | 'Trending' | 'Rising' | 'New' | 'Limited stock'

export interface Filters {
  category?: string[]
  price?: [number, number]
  route?: 'warehouse' | 'supplier'
  brand?: string[]
  platform?: Platform[]
  inStock?: boolean
  badge?: Badge[]
  setupItem?: string
  worksWithSetup?: boolean
  text?: string
}

export type Route =
  | { name: 'home' }
  | { name: 'collection'; slug: string; filters: Filters; sort?: Sort }
  | { name: 'search'; q: string; filters: Filters; sort?: Sort }
  | { name: 'product'; id: string }
  | { name: 'compare'; ids: string[] }
  | { name: 'setup' }
  | { name: 'guides' }
  | { name: 'guide'; slug: string }
  | { name: 'how-we-pick' }
  | { name: 'account' }
  | { name: 'orders' }
  | { name: 'order'; id: string }
  | { name: 'checkout' }
  | { name: 'confirmed'; id: string }
  | { name: 'not-found'; hash: string }

const SORTS: Sort[] = ['trending', 'price-asc', 'price-desc', 'rating', 'newest']
const PLATFORMS: Platform[] = ['ios', 'android', 'homekit', 'google', 'alexa', 'matter', 'thread']
const BADGES: Badge[] = ['Viral', 'Trending', 'Rising', 'New', 'Limited stock']

const isSort = (s: string | null): s is Sort => !!s && (SORTS as string[]).includes(s)
/* A hand-typed or truncated hash can carry a bad percent-encoding; keep the raw text rather than throw. */
const safeDecode = (s: string) => { try { return decodeURIComponent(s) } catch { return s } }

export function serialiseFilters(f: Filters): string {
  const out: string[] = []
  if (f.category?.length) out.push(`category:${f.category.map(encodeURIComponent).join(',')}`)
  if (f.price) out.push(`price:${f.price[0]}-${Number.isFinite(f.price[1]) ? f.price[1] : 'inf'}`)
  if (f.route) out.push(`route:${f.route}`)
  if (f.brand?.length) out.push(`brand:${f.brand.map(encodeURIComponent).join(',')}`)
  if (f.platform?.length) out.push(`platform:${f.platform.join(',')}`)
  if (f.inStock) out.push('inStock:1')
  if (f.badge?.length) out.push(`badge:${f.badge.map(encodeURIComponent).join(',')}`)
  if (f.setupItem) out.push(`setupItem:${encodeURIComponent(f.setupItem)}`)
  if (f.worksWithSetup) out.push('worksWithSetup:1')
  if (f.text) out.push(`text:${encodeURIComponent(f.text)}`)
  return out.join(';')
}

export function parseFilters(s: string): Filters {
  const f: Filters = {}
  if (!s) return f
  for (const pair of s.split(';')) {
    const i = pair.indexOf(':')
    if (i < 1) continue
    const key = pair.slice(0, i)
    const raw = pair.slice(i + 1)
    if (!raw) continue
    const list = () => raw.split(',').map((x) => safeDecode(x)).filter(Boolean)
    switch (key) {
      case 'category': { const v = list(); if (v.length) f.category = v; break }
      case 'brand': { const v = list(); if (v.length) f.brand = v; break }
      case 'platform': { const v = list().filter((x): x is Platform => (PLATFORMS as string[]).includes(x)); if (v.length) f.platform = v; break }
      case 'badge': { const v = list().filter((x): x is Badge => (BADGES as string[]).includes(x)); if (v.length) f.badge = v; break }
      case 'price': {
        const m = raw.match(/^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?|inf)$/)
        if (m) f.price = [Number(m[1]), m[2] === 'inf' ? Infinity : Number(m[2])]
        break
      }
      case 'route': if (raw === 'warehouse' || raw === 'supplier') f.route = raw; break
      case 'inStock': if (raw === '1') f.inStock = true; break
      case 'worksWithSetup': if (raw === '1') f.worksWithSetup = true; break
      case 'setupItem': f.setupItem = safeDecode(raw); break
      case 'text': { const t = safeDecode(raw).trim(); if (t) f.text = t; break }
      default: break
    }
  }
  return f
}

export function formatRoute(r: Route): string {
  const q = (params: Record<string, string | undefined>) => {
    const sp = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) if (v !== undefined) sp.set(k, v)
    const s = sp.toString()
    return s ? `?${s}` : ''
  }
  switch (r.name) {
    case 'home': return '#/'
    case 'collection': return `#/c/${encodeURIComponent(r.slug)}${q({ f: serialiseFilters(r.filters) || undefined, sort: r.sort })}`
    case 'search': return `#/search${q({ q: r.q, f: serialiseFilters(r.filters) || undefined, sort: r.sort })}`
    case 'product': return `#/p/${encodeURIComponent(r.id)}`
    case 'compare': return `#/compare${q({ ids: r.ids.join(',') })}`
    case 'setup': return '#/setup'
    case 'guides': return '#/guides'
    case 'guide': return `#/guides/${encodeURIComponent(r.slug)}`
    case 'how-we-pick': return '#/how-we-pick'
    case 'account': return '#/account'
    case 'orders': return '#/orders'
    case 'order': return `#/orders/${encodeURIComponent(r.id)}`
    case 'checkout': return '#/checkout'
    case 'confirmed': return `#/orders/${encodeURIComponent(r.id)}/confirmed`
    case 'not-found': return r.hash
  }
}

/* The identity of the page a route renders: filters and sort change what a page shows, not which page it is. */
export function pageKey(r: Route): string {
  switch (r.name) {
    case 'collection': return `collection:${r.slug}`
    case 'search': return `search:${r.q}`
    case 'product': return `product:${r.id}`
    case 'compare': return `compare:${r.ids.join(',')}`
    case 'guide': return `guide:${r.slug}`
    case 'order': return `order:${r.id}`
    case 'confirmed': return `confirmed:${r.id}`
    case 'not-found': return `not-found:${r.hash}`
    default: return r.name
  }
}

export function parseRoute(hash: string): Route {
  const h = (hash || '').replace(/^#/, '')
  if (h === '' || h === 'home' || h === '/') return { name: 'home' }
  if (!h.startsWith('/')) {
    return products.some((p) => p.id === h) ? { name: 'product', id: h } : { name: 'not-found', hash }
  }
  const qi = h.indexOf('?')
  const path = qi >= 0 ? h.slice(0, qi) : h
  let sp: URLSearchParams
  try { sp = new URLSearchParams(qi >= 0 ? h.slice(qi + 1) : '') } catch { return { name: 'not-found', hash } }
  const sort = isSort(sp.get('sort')) ? (sp.get('sort') as Sort) : undefined
  const seg = path.split('/').filter(Boolean).map((s) => safeDecode(s))

  if (seg.length === 0) return { name: 'home' }
  const [a, b, c] = seg
  if (a === 'c' && b && seg.length === 2) return { name: 'collection', slug: b, filters: parseFilters(sp.get('f') ?? ''), ...(sort ? { sort } : {}) }
  if (a === 'search' && seg.length === 1) return { name: 'search', q: (sp.get('q') ?? '').trim(), filters: parseFilters(sp.get('f') ?? ''), ...(sort ? { sort } : {}) }
  if (a === 'p' && b && seg.length === 2) return { name: 'product', id: b }
  if (a === 'compare' && seg.length === 1) return { name: 'compare', ids: (sp.get('ids') ?? '').split(',').map((s) => s.trim()).filter(Boolean) }
  if (a === 'setup' && seg.length === 1) return { name: 'setup' }
  if (a === 'guides' && seg.length === 1) return { name: 'guides' }
  if (a === 'guides' && b && seg.length === 2) return { name: 'guide', slug: b }
  if (a === 'how-we-pick' && seg.length === 1) return { name: 'how-we-pick' }
  if (a === 'account' && seg.length === 1) return { name: 'account' }
  if (a === 'orders' && seg.length === 1) return { name: 'orders' }
  if (a === 'orders' && b && seg.length === 2) return { name: 'order', id: b }
  if (a === 'orders' && b && c === 'confirmed' && seg.length === 3) return { name: 'confirmed', id: b }
  if (a === 'checkout' && seg.length === 1) return { name: 'checkout' }
  return { name: 'not-found', hash }
}
