/* The 14-day window every source is read over: yesterday UTC and the 13 days before it. */
import type { DailySeries, SourceId, Window } from './types'

const DAY = 86_400_000
export const iso = (d: Date) => d.toISOString().slice(0, 10)

export function windowEnding(now: Date): Window {
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - DAY)
  const from = new Date(to.getTime() - 13 * DAY)
  return { from: iso(from), to: iso(to), days: 14 }
}

export function dates(w: Window): string[] {
  const start = Date.parse(w.from + 'T00:00:00Z')
  return Array.from({ length: w.days }, (_, i) => iso(new Date(start + i * DAY)))
}

/* A zero-filled series for the window, with the given per-date values laid in. */
export function seriesFrom(source: SourceId, w: Window, values: Map<string, number>): DailySeries {
  return { source, days: dates(w).map((date) => ({ date, value: values.get(date) ?? 0 })) }
}

export const epochStart = (date: string) => Math.floor(Date.parse(date + 'T00:00:00Z') / 1000)
export const dateOfEpoch = (sec: number) => iso(new Date(sec * 1000))
