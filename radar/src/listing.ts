/*
  A draft shop listing from a Radar candidate, and the decision behind the approval job: only the
  repository owner, only a candidate from today's radar.json, only at a price that covers landed cost.
*/
import type { Product } from '../../src/lib/data'
import { FLAG_NOTES } from './flags'
import type { Candidate, ProductTrend, RadarFile } from './types'

const hash = (s: string) => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0 } return h }
const trim = (s: string, n: number) => (s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…')

export function draftListing(c: Candidate, trend: ProductTrend | null, runDate: string, retailAud: number): Product {
  const au = c.variant.auPlug
  return {
    id: `cj-${c.pid}`,
    name: trim(c.name, 60),
    brand: 'Nexus Select',
    category: c.section,
    tagline: `${c.section} find from the Trend Radar, shipped direct from the maker in China.`,
    price: retailAud,
    priceCheckedAt: runDate,
    priceSource: { amount: c.variant.priceUsd, currency: 'USD', at: runDate },
    listedAt: runDate,
    market: 'global',
    sources: [c.cjUrl],
    notes: c.flags.length ? c.flags.map((f) => FLAG_NOTES[f]).join(' ') : undefined,
    rating: null,
    stock: 'in',
    fulfil: { route: 'supplier', origin: 'CN' },
    visual: 'device',
    hue: hash(c.pid) % 360,
    photos: c.image ? [c.image] : [],
    variants: [{ id: 'cj-' + c.variant.vid, label: c.variant.name || 'Standard', swatch: '#2b2b30', hue: hash(c.pid) % 360 }],
    badges: ['From the Radar'],
    trend: trend ? { label: trend.label, delta: trend.delta, series: trend.series, source: 'Trend Radar signals' } : { label: 'Steady', delta: 0, series: [0, 0, 0, 0, 0, 0, 0, 0], source: 'No trend data yet' },
    specs: [{ group: 'Supplier', rows: [
      { label: 'Weight', value: `${c.variant.weightG} g`, n: c.variant.weightG, better: 'low' },
      { label: 'Variants', value: `${c.variant.variantCount} on CJ`, n: c.variant.variantCount },
      { label: 'Ships from', value: 'China, CJdropshipping' },
      { label: 'Plug', value: au ? 'AU plug variant' : c.variant.name || 'as listed' },
    ] }],
    facts: { ...(au ? { plug: 'AU' as const } : {}), voltage: '100-240' },
  }
}

export interface IssueRequest { pid: string; vid: string; retailAud: number; termId: string }

export function parseIssue(title: string, body: string): IssueRequest | null {
  if (!/^list:\s*\S/.test(title.trim())) return null
  const m = body.match(/\{[\s\S]*\}/)
  if (!m) return null
  try {
    const j = JSON.parse(m[0]) as Record<string, unknown>
    if (typeof j.pid !== 'string' || typeof j.vid !== 'string' || typeof j.retailAud !== 'number' || typeof j.termId !== 'string') return null
    return { pid: j.pid, vid: j.vid, retailAud: j.retailAud, termId: j.termId }
  } catch { return null }
}

export type Decision = { ok: true; product: Product; request: IssueRequest } | { ok: false; reason: string }

export function decide(i: { author: string; owner: string; title: string; body: string; radar: RadarFile; trend?: ProductTrend | null }): Decision {
  if (i.author !== i.owner) return { ok: false, reason: `only the repository owner (${i.owner}) can add listings; this issue was opened by ${i.author}` }
  const req = parseIssue(i.title, i.body)
  if (!req) return { ok: false, reason: 'the issue body does not carry a valid listing request' }
  const c = i.radar.candidates.find((x) => x.pid === req.pid)
  if (!c) return { ok: false, reason: `${req.pid} is not in the current radar.json` }
  if (req.retailAud < c.money.landedAud) return { ok: false, reason: `retail $${req.retailAud} is below the landed cost of $${c.money.landedAud}` }
  const runDate = i.radar.generatedAt.slice(0, 10)
  return { ok: true, product: draftListing(c, i.trend ?? null, runDate, req.retailAud), request: req }
}
