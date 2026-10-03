/* Shared shapes for the Trend Radar pipeline, its data files and the Radar page. */
export type SourceId = 'wikipedia' | 'hackernews' | 'reddit' | 'tiwib'
export type TrendLabel = 'Viral' | 'Trending' | 'Rising' | 'Steady'
export type Confidence = 'high' | 'medium' | 'low' | 'none'
export type Flag = 'battery' | 'mains' | 'radio' | 'skin' | 'kids' | 'heavy'
export type Dest = 'AU' | 'US' | 'GB'

export interface Term { id: string; label: string; section: string; wikipedia: string; phrases: string[]; cj: { category: string; keyword: string }; products: string[] }
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
}
export interface NoveltyItem { title: string; link: string; date: string; termId: string | null }
export interface Rate { usdAud: number; source: 'ecb' | 'previous' | 'fallback'; date: string }
export interface RadarFile { generatedAt: string; cjGeneratedAt: string | null; rate: Rate; sources: Record<SourceId | 'cj', string>; terms: TermScore[]; candidates: Candidate[]; novelty: NoveltyItem[] }
export interface ProductTrend { delta: number; label: TrendLabel; score: number; confidence: Confidence; series: number[] }
export interface TrendsFile { generatedAt: string; window: Window; sources: Record<SourceId, string>; products: Record<string, ProductTrend>; terms: TermScore[] }
