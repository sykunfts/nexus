/* Shared shapes for the Trend Radar pipeline, its data files and the Radar page. */
export type SourceId = 'wikipedia' | 'hackernews' | 'reddit' | 'tiwib'
export type TrendLabel = 'Viral' | 'Trending' | 'Rising' | 'Steady'
export type Confidence = 'high' | 'medium' | 'low' | 'none'
export type Flag = 'battery' | 'mains' | 'radio' | 'skin' | 'kids' | 'heavy'
export type Dest = 'AU' | 'US' | 'GB'

/** `match`: every `all` group needs one whole-word hit; any `not` entry rejects (see match.ts). */
export interface TermMatch { all: string[][]; not?: string[] }
export interface Term { id: string; label: string; section: string; wikipedia: string; phrases: string[]; cj: { category: string; keyword: string }; match: TermMatch; products: string[] }
export interface Window { from: string; to: string; days: 14 }            // ISO dates, inclusive; `to` is yesterday UTC
export interface DailySeries { source: SourceId; days: { date: string; value: number }[] }
export interface SourceStat { last7: number; prior7: number; growth: number }
export interface TermScore { id: string; label: string; section: string; delta: number; trendLabel: TrendLabel; score: number; confidence: Confidence; series: number[]; sources: Record<SourceId, SourceStat | null> }

export interface FreightLine { name: string; usd: number; days: [number, number] }
export interface FreightQuote { cheapest: FreightLine; fastest: FreightLine; lines: number }
export interface CandidateVariant { vid: string; name: string; weightG: number; priceUsd: number; auPlug: boolean; variantCount: number }
export interface Money { costAud: number; freightAud: number; landedAud: number; retailAud: number; marginPct: number; netAud: number; at2x: number; at3x: number; sectionMedianAud: number | null }
export interface Candidate {
  pid: string; termId: string; section: string; name: string; image: string; cjUrl: string; listedNum: number
  cjScope: 'category' | 'keyword'; variant: CandidateVariant; freight: Record<Dest, FreightQuote | null>; money: Money
  flags: Flag[]; score: number; firstSeen: string; why: string; stale?: boolean
  /** money.netAud under PROFIT_FLOOR (A$20); may be missing in files written before Radar v2. */
  thin: boolean
  /** 1 when the detail name holds the term's keyword, 0.6 for a rules-only match; may be missing in older files. */
  match: number
}
/** A CJ result the match rules turned away: shown on the Radar page under "Thrown out today". */
export interface Rejected { pid: string; termId: string; name: string; reason: string }
export interface NoveltyItem { title: string; link: string; date: string; termId: string | null }
export interface Rate { usdAud: number; source: 'ecb' | 'previous' | 'fallback'; date: string }
export interface RadarFile {
  generatedAt: string; cjGeneratedAt: string | null; rate: Rate; sources: Record<SourceId | 'cj', string>; terms: TermScore[]; candidates: Candidate[]; novelty: NoveltyItem[]
  /** CJ results the match rules threw out this run (at most 60, shared across terms); absent when the CJ stage did not finish, and in files from before Radar v2. */
  rejected?: Rejected[]
  /** How many were thrown out in all (rejected holds at most 60 of them). */
  rejectedTotal?: number
  /** Novelty items hidden as alcohol, tobacco, weapons or adult. */
  noveltyHidden?: number
}
export interface ProductTrend { delta: number; label: TrendLabel; score: number; confidence: Confidence; series: number[] }
export interface TrendsFile { generatedAt: string; window: Window; sources: Record<SourceId, string>; products: Record<string, ProductTrend>; terms: TermScore[] }
