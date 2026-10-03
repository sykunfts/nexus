import { describe, expect, it, vi } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

describe('merge-trends', () => {
  it('writes a module from a trends file', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'trends-'))
    mkdirSync(path.join(dir, 'data'), { recursive: true })
    writeFileSync(path.join(dir, 'data', 'trends.json'), JSON.stringify({ generatedAt: '2026-10-04T20:05:10.000Z', window: { from: '2026-09-20', to: '2026-10-03', days: 14 }, sources: { wikipedia: 'ok', hackernews: 'ok', reddit: 'failed: 403', tiwib: 'ok' }, products: { 'oura-ring-5': { delta: 212, label: 'Viral', score: 1.8, confidence: 'high', series: [1, 2, 3, 4, 5, 6, 7, 8] } }, terms: [] }))
    execFileSync('node', [path.resolve('scripts/merge-trends.mjs'), dir])
    const out = readFileSync(path.join(dir, 'src', 'lib', 'trends.generated.ts'), 'utf8')
    expect(out).toContain('export const TRENDS_GENERATED_AT: string | null = "2026-10-04T20:05:10.000Z"')
    expect(out).toContain('export const TRENDS_SOURCES: string[] = ["Wikipedia","Hacker News","TIWIB"]')
    expect(out).toContain('"oura-ring-5"')
    expect(out).toContain('"source": "Wikipedia, Hacker News and TIWIB"')
  })
  it('an empty products map means no real trends yet', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'trends-'))
    mkdirSync(path.join(dir, 'data'), { recursive: true })
    writeFileSync(path.join(dir, 'data', 'trends.json'), JSON.stringify({ generatedAt: '2026-10-03T00:00:00.000Z', sources: {}, products: {}, terms: [] }))
    execFileSync('node', [path.resolve('scripts/merge-trends.mjs'), dir])
    const out = readFileSync(path.join(dir, 'src', 'lib', 'trends.generated.ts'), 'utf8')
    expect(out).toContain('TRENDS_GENERATED_AT: string | null = null')
  })
})

describe('products with real trends', () => {
  it('trendNote uses the sample wording when there is no file', async () => {
    vi.resetModules()
    const { trendNote } = await import('./data')
    expect(trendNote()).toBe('Trend figures are sample data until the trend feed is live.')
  })
  it('a product with a file trend uses it, one without keeps a sample trend marked sample', async () => {
    vi.resetModules()
    vi.doMock('./trends.generated', () => ({
      TRENDS: { 'oura-ring-5': { label: 'Viral', delta: 212, series: [1, 2, 3, 4, 5, 6, 7, 8], source: 'Wikipedia and TIWIB' } },
      TRENDS_GENERATED_AT: '2026-10-04T20:05:10.000Z',
      TRENDS_SOURCES: ['Wikipedia', 'TIWIB'],
    }))
    try {
      const { byId, trendNote, TREND_NOTE } = await import('./data')
      expect(byId('oura-ring-5').trend.delta).toBe(212)
      expect(byId('oura-ring-5').trend.source).toBe('Wikipedia and TIWIB')
      expect(byId('xgimi-mogo-4-laser').trend.source).toMatch(/[Ss]ample/)
      // 20:05 UTC on the 4th is the morning of the 5th in Sydney, which is when Nick sees it
      expect(trendNote()).toBe('Trend figures from Wikipedia and TIWIB, refreshed 5 October 2026.')
      expect(TREND_NOTE).toBe(trendNote())
    } finally { vi.doUnmock('./trends.generated') }
  })
})
