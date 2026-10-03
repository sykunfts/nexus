import { describe, expect, it } from 'vitest'
import { filterCandidates, issueUrl, rateLabel, sortCandidates, sourcesLine, staleBanner, termDeltas, DEFAULT_FILTERS } from './lib'
import sample from './fixtures/radar.sample.json'
import type { Candidate, RadarFile } from '../../radar/src/types'

const file = sample as unknown as RadarFile
const c = file.candidates

describe('radar lib', () => {
  it('filterCandidates applies margin, flags, AU plug, section and skipped', () => {
    expect(filterCandidates(c, DEFAULT_FILTERS, new Set()).length).toBe(c.length)
    expect(filterCandidates(c, { ...DEFAULT_FILTERS, section: 'Wearables' }, new Set()).every((x) => x.section === 'Wearables')).toBe(true)
    expect(filterCandidates(c, { ...DEFAULT_FILTERS, minMargin: 0.45 }, new Set()).every((x) => x.money.marginPct >= 0.45)).toBe(true)
    expect(filterCandidates(c, { ...DEFAULT_FILTERS, exclude: ['heavy'] }, new Set()).some((x) => x.flags.includes('heavy'))).toBe(false)
    expect(filterCandidates(c, { ...DEFAULT_FILTERS, auPlugOnly: true }, new Set()).every((x) => x.variant.auPlug)).toBe(true)
    expect(filterCandidates(c, DEFAULT_FILTERS, new Set(['DEMO-RING-1'])).some((x) => x.pid === 'DEMO-RING-1')).toBe(false)
    expect(filterCandidates(c, { ...DEFAULT_FILTERS, hideSkipped: false }, new Set(['DEMO-RING-1'])).some((x) => x.pid === 'DEMO-RING-1')).toBe(true)
  })
  it('sortCandidates by each key', () => {
    const by = (k: Parameters<typeof sortCandidates>[1]) => sortCandidates(c, k, termDeltas(file)).map((x) => x.pid)
    expect(by('score')[0]).toBe('DEMO-RING-1')
    expect(by('margin')[0]).toBe('DEMO-RING-2')      // 47 %
    expect(by('trend')[0]).toBe('DEMO-MASK-1')       // +260 %
    expect(by('demand')[0]).toBe('DEMO-BANK-1')      // 3,100 listed
    expect(by('newest')[by('newest').length - 1]).toBe('DEMO-PROJ-1')   // seen since 28 Sep, everything else today
  })
  it('issueUrl carries the pid and the retail', () => {
    const u = issueUrl('sykunfts/nexus', c[0])
    expect(u.startsWith('https://github.com/sykunfts/nexus/issues/new?')).toBe(true)
    const sp = new URL(u).searchParams
    expect(sp.get('title')).toBe('list: DEMO-RING-1')
    expect(sp.get('labels')).toBe('listing')
    expect(sp.get('body')).toContain('"pid":"DEMO-RING-1"')
    expect(sp.get('body')).toContain('"retailAud":95.95')
  })
  it('rateLabel and sourcesLine wording', () => {
    expect(rateLabel({ usdAud: 1.515, source: 'ecb', date: '2026-10-03' })).toBe('A$1.515 per US dollar, ECB rate for 3 October 2026')
    expect(rateLabel({ usdAud: 1.49, source: 'previous', date: '2026-10-02' })).toBe('A$1.49 per US dollar, carried from the previous run (2 October 2026)')
    expect(rateLabel({ usdAud: 1.52, source: 'fallback', date: '2026-10-04' })).toBe('A$1.52 per US dollar, fixed fallback rate')
    expect(sourcesLine(file.sources)).toBe('Wikipedia, Hacker News, TIWIB and CJ fed this run. Reddit: blocked (403).')
    expect(sourcesLine({ wikipedia: 'ok', hackernews: 'ok', reddit: 'ok', tiwib: 'ok', cj: 'skipped' })).toBe('Wikipedia, Hacker News, Reddit and TIWIB fed this run. CJ: skipped.')
    expect(sourcesLine({ wikipedia: 'not yet run', hackernews: 'not yet run', reddit: 'not yet run', tiwib: 'not yet run', cj: 'not yet run' })).toBe('The Radar has not run yet.')
  })
  it('staleBanner names the age of CJ data', () => {
    expect(staleBanner(file)).toBeNull()
    expect(staleBanner({ ...file, candidates: c.map((x) => ({ ...x, stale: true })), cjGeneratedAt: '2026-10-03T20:05:10.000Z' })).toBe('CJ data from 4 October 2026; today’s run could not reach CJ.')
  })
})
