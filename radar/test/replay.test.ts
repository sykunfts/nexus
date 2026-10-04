/*
  Replays the Radar's first live run (data/radar.json of 3 October 2026, 19:00 UTC; 4 October in Sydney) through
  the v2 matcher and ranking: the 30 candidates CJ returned, with the money, listings, weight, flags and AU freight
  that run recorded, and the term deltas it measured. Titles are the ones in the spec's section 7 where it gives them.
*/
import { describe, expect, it } from 'vitest'
import watch from '../terms.json'
import { matchTitle } from '../src/match'
import { rankCandidates, type Unranked } from '../src/rank'
import type { Confidence, Flag, FreightQuote, Term, TermScore } from '../src/types'

const rules = (id: string): Term => (watch as Term[]).find((t) => t.id === id)!
const quote: FreightQuote = { cheapest: { name: 'CJPacket Ordinary', usd: 8, days: [8, 15] }, fastest: { name: 'DHL', usd: 30, days: [3, 5] }, lines: 3 }

type Row = [termId: string, name: string, landed: number, retail: number, net: number, cost: number, listed: number, weightG: number, flags: Flag[], auFreight: boolean]
const ROWS: Row[] = [
  ['desk-3d-printer', '3D printer accessories mute motherboard', 53.06, 113.95, 46.93, 45.08, 666, 77, [], true],
  ['desk-3d-printer', 'DIY Set Of Accessories 1.83D Printer I3 Motor', 16.83, 36.95, 15.39, 8.34, 579, 108, [], true],
  ['desk-3d-printer', '3D Printer DIY Model Moonlight Board Two-color Touch Night Light', 13.69, 29.95, 12.37, 4.44, 381, 110, [], true],
  ['smart-lock', 'Smart Teaser Cat Toy Electric UFO Cat Teaser Stick With Bell Training Pet Toys Replaceable Feather Interactive Cat Supplies Pet Supplies Pets Products', 36.52, 78.95, 32.66, 11.85, 2, 755, ['kids'], true],
  ['smartwatch', "Children's Phone Watch Smart Positioning Call Photo", 29.99, 64.95, 26.87, 18.79, 15, 193, ['kids'], true],
  ['laser-projector', 'Portable Home Theater Projector, Mini Projector For Bedroom Gaming Movies', 64.52, 137.95, 56.59, 43.22, 19, 700, [], true],
  ['travel-adapter', 'Outdoor Travel Backpack Student-style Simple Design', 27.96, 60.95, 25.38, 6.83, 7, 870, [], true],
  ['open-ear-buds', 'KP-113 Best-selling Wireless Bluetooth Ear-hook Headphones High-quality Audio Low Latency', 20.51, 44.95, 18.75, 9.28, 5, 195, ['radio'], true],
  ['travel-adapter', 'High-end Waterproof Oxford Fabric Laptop Backpack Large-capacity Travel Backpack', 29.19, 62.95, 25.91, 10.38, 7, 730, [], true],
  ['smartwatch', 'S10 Smartwatch 4G Elderly Phone Watch', 47.34, 101.95, 42.09, 38.78, 9, 80, [], true],
  ['travel-adapter', "Couple's Outdoor Travel Large-size Jacket For Men", 42.31, 90.95, 37.43, 22.02, 5, 820, [], true],
  ['open-ear-buds', 'KP-21Ppro Best-selling Wireless Bluetooth Ear-hook Sports Headphones', 16.67, 36.95, 15.55, 7.78, 2, 94, ['battery', 'radio'], true],
  ['open-ear-buds', 'KP-22Ppro Best-selling Wireless Bluetooth Ear-hook Sports Headphones', 16.67, 36.95, 15.55, 7.78, 2, 94, ['battery', 'radio'], true],
  ['smart-ring', 'Stainless Steel Contrasting Zircon Ring', 13.43, 29.95, 12.63, 6.48, 6, 15, [], true],
  ['dev-board', "Women's Height Increasing Round Toe Lace-up Board Shoes", 61.51, 131.95, 54.32, 44.03, 2, 650, [], true],
  ['smart-ring', 'Alien Birthday Stone Zircon Stainless Steel Ring For Women', 14.37, 31.95, 13.45, 7.42, 6, 15, [], true],
  ['smart-lock', 'Aluminum Alloy Smart Door Lock With Facial Recognition And Fingerprint Recognition', 143.17, 304.95, 124.91, 72.56, 1, 4050, ['skin', 'heavy'], true],
  ['matter-hub', 'Aluminum Tube Musical Wind Chime For Home', 16.34, 35.95, 15.0, 5.82, 1, 230, [], true],
  ['matter-hub', 'Rechargeable Smart Sensor Soap Dispenser', 25.09, 53.95, 22.09, 11.51, 0, 296, ['battery'], true],
  ['gan-charger', '100W GaN Multi-Port Charger with Built-in Retractable Type-C Cable - AI Smart Display UK EU Plug Adapter', 76.36, 162.95, 66.75, 59.72, 17, 450, ['mains'], true],
  ['smart-ring', 'Digital Display Smart Induction Foam Dispenser For Home Use', 27.81, 59.95, 24.65, 12.51, 0, 370, [], true],
  ['matter-hub', 'Retro-style Study Home Computer Chair', 396.32, 842.95, 345.25, 80.07, 1, 15250, ['heavy'], true],
  ['laser-projector', 'Smart Portable Theater Projector With Trapezoidal Correction', 72.04, 153.95, 63.15, 72.04, 21, 820, ['radio'], false],
  ['laser-projector', '5G 4K Projector Smart HD LED WiFi Bluetooth H DMI USB Android Office Home Theater', 50.73, 108.95, 44.86, 50.73, 18, 651, ['radio'], false],
  ['smart-lock', '20000mAh Portable Charger High Capacity External Battery 45W PD 3.0 Fast Charging Travel Power Bank With Smart Digital Display', 37.04, 79.95, 33.02, 37.04, 3, 500, ['battery', 'mains'], false],
  ['gan-charger', 'Retractable Car Charger 4 in 1 Fast Car Phone Charger 120W With USB Type C Cable', 25.52, 54.95, 22.54, 25.52, 27, 454, ['mains'], false],
  ['gan-charger', '65W USB C Type-C Adapter Charger For DELL, HP, ASUS, Lenovo, Huawei,Acer Laptop', 18.68, 40.95, 17.06, 18.68, 20, 267, ['mains'], false],
  ['smartwatch', 'Ten-in-One Smart Watch Set With Wireless Earbuds, Multiple Watch Bands, Magnetic Charger & Protective Case', 30.26, 64.95, 26.6, 30.26, 68, 400, ['mains', 'radio'], false],
  ['dev-board', 'Washed Gray Finish Fireplace TV Stand,  Embossed Particle Board With Melamine Foil', 307.37, 653.95, 267.87, 307.37, 2, 44800, ['heavy'], false],
  ['dev-board', 'WALL MOUNTED TOOL PEG BOARD SET GARAGE STORAGE BINS WORKSHOP RACK SHED ORGANISER', 43.49, 93.95, 38.89, 43.49, 2, 4120, ['mains', 'heavy'], false],
]

/* Section 7: the off-product titles (by their opening words) and the real ones. */
const REJECT = ['3D printer accessories', 'DIY Set Of Accessories', '3D Printer DIY Model', 'Smart Teaser Cat Toy', 'Outdoor Travel Backpack', 'High-end Waterproof Oxford', "Couple's Outdoor Travel", 'Stainless Steel Contrasting Zircon', 'Alien Birthday Stone', 'Digital Display Smart Induction', "Women's Height Increasing", 'Washed Gray Finish', 'WALL MOUNTED TOOL PEG BOARD', 'Aluminum Tube Musical', 'Rechargeable Smart Sensor Soap', 'Retro-style Study Home Computer Chair', '20000mAh Portable Charger', 'Retractable Car Charger']
const KEEP = ['Aluminum Alloy Smart Door Lock', "Children's Phone Watch", 'S10 Smartwatch', 'Ten-in-One Smart Watch', 'Portable Home Theater Projector', '5G 4K Projector', 'KP-113', '100W GaN Multi-Port', '65W USB C Type-C Adapter']

const DELTAS: Record<string, [number, Confidence]> = {
  'smart-lock': [480, 'medium'], 'laser-projector': [285, 'medium'], 'desk-3d-printer': [880, 'medium'], smartwatch: [-2, 'low'], 'open-ear-buds': [2, 'low'], 'gan-charger': [-11, 'medium'],
  'travel-adapter': [40, 'medium'], 'smart-ring': [67, 'medium'], 'dev-board': [10, 'low'], 'matter-hub': [5, 'low'],
}
const TERMS: TermScore[] = Object.entries(DELTAS).map(([id, [delta, confidence]]) => ({
  id, label: rules(id).label, section: rules(id).section, delta, confidence, score: 0, series: [],
  trendLabel: delta >= 200 ? 'Viral' : delta >= 100 ? 'Trending' : delta >= 50 ? 'Rising' : 'Steady',
  sources: { wikipedia: { last7: 1, prior7: 1, growth: delta / 100 }, hackernews: null, reddit: null, tiwib: null },
}))

function replay() {
  const kept: Unranked[] = []
  const thrown: string[] = []
  ROWS.forEach(([termId, name, landed, retail, net, cost, listed, weightG, flags, auFreight], i) => {
    const m = matchTitle(name, rules(termId))
    if (!m.ok) { thrown.push(name); return }
    kept.push({
      pid: `R-${i}`, termId, section: rules(termId).section, name, image: '', cjUrl: '', listedNum: listed, cjScope: 'category',
      variant: { vid: `R-${i}-v`, name: 'default', weightG, priceUsd: cost / 1.4411, auPlug: false, variantCount: 1 },
      freight: { AU: auFreight ? quote : null, US: quote, GB: null },
      money: { costAud: cost, freightAud: Math.round((landed - cost) * 100) / 100, landedAud: landed, retailAud: retail, marginPct: 0.45, netAud: net, at2x: 0.5, at3x: 0.67, sectionMedianAud: null },
      flags, match: m.strength,
    })
  })
  return { ranked: rankCandidates(kept, TERMS, null, '2026-10-04'), thrown }
}

describe('replay of the 4 October run', () => {
  const { ranked, thrown } = replay()
  const at = (prefix: string) => ranked.findIndex((c) => c.name.startsWith(prefix))

  it('throws out every off-product title and keeps every real one', () => {
    expect(ROWS.length).toBe(30)
    for (const p of REJECT) expect(thrown.some((t) => t.startsWith(p)), `should be thrown out: ${p}`).toBe(true)
    for (const p of KEEP) expect(at(p), `should be kept: ${p}`).toBeGreaterThanOrEqual(0)
    expect(thrown.length).toBe(REJECT.length)
    expect(ranked.length).toBe(30 - REJECT.length)
  })

  it('no 3D-printer accessory reaches the ranking', () => {
    expect(ranked.some((c) => c.termId === 'desk-3d-printer')).toBe(false)
  })

  it('the top picks are the projectors and the smart door lock, all from Viral terms', () => {
    expect(ranked[0].termId).toBe('laser-projector')   // the one projector with an AU freight line
    expect(ranked.slice(0, 3).map((c) => c.termId)).toEqual(['laser-projector', 'smart-lock', 'laser-projector'])
    for (const c of ranked.slice(0, 3)) expect(TERMS.find((t) => t.id === c.termId)!.trendLabel).toBe('Viral')
    // the third projector had no freight line to Australia (the 0.40 penalty), so a shippable smartwatch edges it
    expect(at('5G 4K Projector')).toBeGreaterThan(at('S10 Smartwatch'))
  })

  it('the smart door lock ranks above every smartwatch, open-ear and GaN candidate', () => {
    const lock = at('Aluminum Alloy Smart Door Lock')
    for (const c of ranked.filter((x) => ['smartwatch', 'open-ear-buds', 'gan-charger'].includes(x.termId))) {
      expect(ranked.indexOf(c), c.name).toBeGreaterThan(lock)
    }
  })

  it('anything under A$20 a sale sorts last', () => {
    const firstThin = ranked.findIndex((c) => c.thin)
    expect(firstThin).toBeGreaterThan(0)
    expect(ranked.slice(firstThin).every((c) => c.thin)).toBe(true)
    expect(ranked.filter((c) => c.thin).map((c) => c.name.slice(0, 9)).sort()).toEqual(['65W USB C', 'KP-113 Be', 'KP-21Ppro', 'KP-22Ppro'])
  })
})
