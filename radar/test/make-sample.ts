/* Builds src/radar/fixtures/radar.sample.json: made-up candidates with consistent money, for the page tests, screenshots and the ?demo view. */
import { writeFileSync } from 'node:fs'
import { moneyFor } from '../src/money'
import { flagsFor } from '../src/flags'
import { rankCandidates, type Unranked } from '../src/rank'
import type { RadarFile, TermScore, FreightQuote } from '../src/types'

const fq = (c: number, f: number, d1: number, d2: number, lines = 5): FreightQuote => ({ cheapest: { name: 'CJPacket Ordinary', usd: c, days: [d1, d2] }, fastest: { name: 'DHL Express', usd: f, days: [3, 5] }, lines })
const term = (id: string, label: string, section: string, delta: number, score: number, series: number[]): TermScore => ({ id, label, section, delta, trendLabel: delta >= 200 ? 'Viral' : delta >= 100 ? 'Trending' : delta >= 50 ? 'Rising' : 'Steady', score, confidence: 'high', series, sources: { wikipedia: { last7: 1, prior7: 1, growth: delta / 100 }, hackernews: { last7: 1, prior7: 1, growth: delta / 100 }, reddit: null, tiwib: { last7: 1, prior7: 0, growth: 1 } } })
const terms = [
  term('smart-ring', 'Smart rings', 'Wearables', 212, 1.9, [8, 9, 12, 15, 22, 30, 38, 100]),
  term('laser-projector', 'Laser projectors', 'Home cinema', 140, 1.2, [12, 14, 13, 18, 24, 31, 40, 100]),
  term('open-ear-buds', 'Open-ear buds', 'Audio', 96, 0.8, [10, 11, 13, 14, 16, 19, 22, 100]),
  term('led-mask', 'LED masks', 'Health', 260, 2.1, [6, 8, 10, 16, 24, 30, 44, 100]),
  term('qi2-power-bank', 'Qi2 power banks', 'Power', 62, 0.4, [15, 16, 17, 19, 20, 22, 24, 100]),
  term('robot-vacuum', 'Robot vacuums', 'Smart home', 18, -0.2, [22, 23, 22, 24, 25, 25, 26, 100]),
]
const rate = 1.515
const mk = (pid: string, termId: string, section: string, name: string, listed: number, priceUsd: number, weightG: number, auPlug: boolean, vname: string, freight: Partial<Record<'AU' | 'US' | 'GB', FreightQuote | null>>, median: number | null, scope: 'category' | 'keyword' = 'category'): Unranked => ({
  pid, termId, section, name, image: '', cjUrl: `https://www.cjdropshipping.com/product/-p-${pid}.html`, listedNum: listed, cjScope: scope,
  variant: { vid: `${pid}-v`, name: vname, weightG, priceUsd, auPlug, variantCount: 4 },
  freight: { AU: freight.AU ?? null, US: freight.US ?? null, GB: freight.GB ?? null },
  money: moneyFor(priceUsd, freight.AU?.cheapest.usd ?? null, rate, median), flags: flagsFor(`${name} ${vname}`, weightG),
})
const unranked: Unranked[] = [
  mk('DEMO-RING-1', 'smart-ring', 'Wearables', 'Titanium Smart Ring Sleep & Heart Rate Tracker, App Included', 1532, 23.4, 60, false, 'Size 9 / Black', { AU: fq(6.1, 28, 8, 15), US: fq(5.2, 26, 7, 12), GB: fq(6.8, 30, 9, 16) }, 399),
  mk('DEMO-PROJ-1', 'laser-projector', 'Home cinema', 'Mini Laser Projector 1080P Portable Home Cinema With Android TV', 880, 62.4, 1350, true, 'AU Plug / Black', { AU: fq(22.05, 48.2, 6, 10, 11), US: fq(19.9, 44, 6, 10), GB: null }, 1099),
  mk('DEMO-BUDS-1', 'open-ear-buds', 'Audio', 'Open Ear Clip Earbuds Bluetooth 5.4 With Charging Case', 2210, 11.8, 90, false, 'Black', { AU: fq(5.4, 24, 8, 15), US: fq(4.9, 22, 7, 12), GB: fq(5.9, 26, 9, 16) }, 249),
  mk('DEMO-MASK-1', 'led-mask', 'Health', 'LED Light Therapy Face Mask Red And Near Infrared, 7 Colours', 640, 38.5, 520, true, 'AU Plug', { AU: fq(12.3, 36, 8, 15), US: fq(11, 33, 7, 12), GB: fq(13, 38, 9, 16) }, 549),
  mk('DEMO-BANK-1', 'qi2-power-bank', 'Power', 'Magnetic Wireless Power Bank 10000mAh Qi2 15W', 3100, 14.2, 210, false, 'Blue', { AU: fq(7.9, 30, 8, 15), US: fq(6.5, 28, 7, 12), GB: fq(8.2, 32, 9, 16) }, 129),
  mk('DEMO-VAC-1', 'robot-vacuum', 'Smart home', 'Robot Vacuum And Mop With Self-Empty Base, Wi-Fi App Control', 410, 189, 6800, false, 'US Plug / White', { AU: fq(61, 140, 10, 20), US: fq(48, 120, 8, 14), GB: null }, 1299, 'keyword'),
  mk('DEMO-RING-2', 'smart-ring', 'Wearables', 'Smart Ring Charging Case Only (No Ring)', 220, 2.9, 40, false, 'Black', { AU: fq(5, 20, 8, 15), US: fq(4.5, 20, 7, 12), GB: fq(5.5, 22, 9, 16) }, 399),
]
const candidates = rankCandidates(unranked, terms, { candidates: [{ pid: 'DEMO-PROJ-1', firstSeen: '2026-09-28' }] } as unknown as RadarFile, '2026-10-04')
const file: RadarFile = {
  generatedAt: '2026-10-04T20:05:10.000Z', cjGeneratedAt: '2026-10-04T20:05:10.000Z', rate: { usdAud: rate, source: 'ecb', date: '2026-10-03' },
  sources: { wikipedia: 'ok', hackernews: 'ok', reddit: 'failed: 403', tiwib: 'ok', cj: 'ok' }, terms, candidates,
  novelty: [
    { title: 'Smart Ring That Tracks Your Sleep', link: 'https://www.thisiswhyimbroke.com/', date: '2026-10-03', termId: 'smart-ring' },
    { title: 'Laser Projector For Your Backyard', link: 'https://www.thisiswhyimbroke.com/', date: '2026-10-02', termId: 'laser-projector' },
    { title: 'Levitating Plant Pot', link: 'https://www.thisiswhyimbroke.com/', date: '2026-10-02', termId: null },
    { title: 'Self-Stirring Mug', link: 'https://www.thisiswhyimbroke.com/', date: '2026-10-01', termId: null },
  ],
}
writeFileSync(new URL('../../src/radar/fixtures/radar.sample.json', import.meta.url), JSON.stringify(file, null, 2) + '\n')
console.log(`sample: ${candidates.length} candidates`)
