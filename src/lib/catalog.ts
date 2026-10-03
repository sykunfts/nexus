/*
  Catalogue query engine: one `query` that every page, rail and menu item reads through, so a
  collection is a saved query rather than a hand-picked list. Pure and unit-tested.
*/
import { CompatFacts, DEFAULT_GEAR, Product } from './data'
import { checkBuild, resolveFacts } from './compat'
import { Badge, Filters, Platform, Sort } from './routes'

export interface SetupItem { id: string; name: string; facts: CompatFacts }

export const PRICE_BANDS: { label: string; range: [number, number] }[] = [
  { label: 'Under $100', range: [0, 100] },
  { label: '$100 to $300', range: [100, 300] },
  { label: '$300 to $800', range: [300, 800] },
  { label: '$800 and up', range: [800, Infinity] },
]

export const PLATFORM_LABEL: Record<Platform, string> = { ios: 'iPhone', android: 'Android', homekit: 'Apple Home', google: 'Google Home', alexa: 'Alexa', matter: 'Matter', thread: 'Thread' }

export const statusFor = (p: Product, setup: SetupItem[]) =>
  checkBuild({ name: p.name, facts: resolveFacts(p, {}), product: p }, setup).status

const tokens = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)

function haystack(p: Product): string[] {
  return tokens([p.name, p.brand, p.category, p.tagline, ...p.specs.flatMap((g) => g.rows.map((r) => r.value))].join(' '))
}

const prefixMatch = (words: string[], token: string) => words.some((w) => w.startsWith(token))

function platformsOf(p: Product): Set<Platform> {
  const out = new Set<Platform>()
  for (const a of p.facts.app ?? []) out.add(a)
  for (const h of p.facts.home ?? []) out.add(h)
  for (const h of p.facts.hubs ?? []) out.add(h)
  return out
}

function badgesOf(p: Product): Set<string> {
  return new Set([...(p.badges ?? []), p.trend.label])
}

function passes(p: Product, f: Filters, setup: SetupItem[]): boolean {
  if (f.category?.length && !f.category.includes(p.category)) return false
  if (f.price && !(p.price >= f.price[0] && p.price < f.price[1])) return false
  if (f.route && p.fulfil.route !== f.route) return false
  if (f.brand?.length && !f.brand.includes(p.brand)) return false
  if (f.platform?.length) { const have = platformsOf(p); if (!f.platform.some((x) => have.has(x))) return false }
  if (f.inStock && p.stock === 'out') return false
  if (f.badge?.length) { const have = badgesOf(p); if (!f.badge.some((b) => have.has(b))) return false }
  if (f.setupItem) {
    const item = DEFAULT_GEAR.find((g) => g.id === f.setupItem)
    if (!item) return false
    if (statusFor(p, [{ id: item.id, name: item.name, facts: item.facts }]) !== 'ok') return false
  }
  if (f.worksWithSetup && statusFor(p, setup) !== 'ok') return false
  if (f.text) { const words = haystack(p); if (!tokens(f.text).every((t) => prefixMatch(words, t))) return false }
  return true
}

function compare(sort: Sort): (a: Product, b: Product) => number {
  switch (sort) {
    case 'price-asc': return (a, b) => a.price - b.price
    case 'price-desc': return (a, b) => b.price - a.price
    case 'rating': return (a, b) => (b.rating?.value ?? -1) - (a.rating?.value ?? -1) || b.trend.delta - a.trend.delta
    case 'newest': return (a, b) => (b.releasedAt ?? '').localeCompare(a.releasedAt ?? '') || b.listedAt.localeCompare(a.listedAt) || b.trend.delta - a.trend.delta
    case 'trending': default: return (a, b) => b.trend.delta - a.trend.delta
  }
}

export function query(all: Product[], f: Filters, sort: Sort, setup: SetupItem[]): Product[] {
  return all.filter((p) => passes(p, f, setup)).sort(compare(sort))
}

export interface Facets {
  brand: { value: string; count: number }[]
  platform: { value: Platform; label: string; count: number }[]
  route: { value: 'warehouse' | 'supplier'; count: number }[]
  badge: { value: Badge; count: number }[]
  price: { label: string; range: [number, number]; count: number }[]
  worksWithSetup: number
  inStock: number
}

/** Counts per option, each computed on the result set with that facet's own filter removed. */
export function facets(all: Product[], f: Filters, setup: SetupItem[]): Facets {
  const without = (key: keyof Filters) => all.filter((p) => passes(p, { ...f, [key]: undefined }, setup))
  const count = <T,>(ps: Product[], values: T[], has: (p: Product, v: T) => boolean) => values.map((v) => ({ value: v, count: ps.filter((p) => has(p, v)).length }))

  const brandPool = without('brand')
  const brands = [...new Set(all.map((p) => p.brand))].sort()
  const platPool = without('platform')
  const platforms: Platform[] = ['ios', 'android', 'homekit', 'google', 'alexa', 'matter', 'thread']
  const routePool = without('route')
  const badgePool = without('badge')
  const badges: Badge[] = ['Viral', 'Trending', 'Rising', 'New', 'Limited stock']
  const pricePool = without('price')
  const wwPool = without('worksWithSetup')
  const stockPool = without('inStock')
  /* A value drops out of the rail at zero, unless it is ticked: a tick the user cannot see cannot be removed. */
  const keep = <T,>(x: { value: T; count: number }, chosen: T[] | undefined) => x.count > 0 || !!chosen?.includes(x.value)

  return {
    brand: count(brandPool, brands, (p, v) => p.brand === v).filter((x) => keep(x, f.brand)),
    platform: count(platPool, platforms, (p, v) => platformsOf(p).has(v)).map((x) => ({ ...x, label: PLATFORM_LABEL[x.value] })),
    route: count(routePool, ['warehouse', 'supplier'] as const, (p, v) => p.fulfil.route === v),
    badge: count(badgePool, badges, (p, v) => badgesOf(p).has(v)).filter((x) => keep(x, f.badge)),
    price: PRICE_BANDS.map((b) => ({ ...b, count: pricePool.filter((p) => p.price >= b.range[0] && p.price < b.range[1]).length })),
    worksWithSetup: wwPool.filter((p) => statusFor(p, setup) === 'ok').length,
    inStock: stockPool.filter((p) => p.stock !== 'out').length,
  }
}

/** Nearest products by token overlap, for the zero-results state. */
export function similar(all: Product[], q: string, n: number): Product[] {
  const qt = tokens(q)
  if (!qt.length) return all.slice(0, n)
  return all
    .map((p) => { const words = haystack(p); return { p, score: qt.filter((t) => prefixMatch(words, t)).length } })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || b.p.trend.delta - a.p.trend.delta)
    .slice(0, n)
    .map((x) => x.p)
}
