import { describe, expect, it } from 'vitest'
import terms from '../terms.json'
import type { Term } from '../src/types'
import { hasEntry, matchTitle } from '../src/match'

const t = (id: string): Term => {
  const found = (terms as Term[]).find((x) => x.id === id)
  if (!found) throw new Error(`no term ${id}`)
  return found
}

describe('matchTitle', () => {
  it('rejects the 4 October off-product titles', () => {
    const bad: [string, string][] = [
      ['smart-lock', 'Smart Teaser Cat Toy Electric UFO Cat Teaser Stick With Bell Training Pet Toys Replaceable Feather Interactive Cat Supplies Pet Supplies Pets Products'],
      ['smart-lock', '20000mAh Portable Charger High Capacity External Battery 45W PD 3.0 Fast Charging Travel Power Bank With Smart Digital Display'],
      ['travel-adapter', 'Outdoor Travel Backpack Student-style Simple Design'],
      ['travel-adapter', 'High-end Waterproof Oxford Fabric Laptop Backpack Large-capacity Travel Backpack'],
      ['travel-adapter', "Couple's Outdoor Travel Large-size Jacket For Men"],
      ['smart-ring', 'Stainless Steel Contrasting Zircon Ring'],
      ['smart-ring', 'Alien Birthday Stone Zircon Stainless Steel Ring For Women'],
      ['smart-ring', 'Digital Display Smart Induction Foam Dispenser For Home Use'],
      ['dev-board', "Women's Height Increasing Round Toe Lace-up Board Shoes"],
      ['dev-board', 'Washed Gray Finish Fireplace TV Stand,  Embossed Particle Board With Melamine Foil'],
      ['dev-board', 'WALL MOUNTED TOOL PEG BOARD SET GARAGE STORAGE BINS WORKSHOP RACK SHED ORGANISER'],
      ['matter-hub', 'Aluminum Tube Musical Wind Chime For Home'],
      ['matter-hub', 'Rechargeable Smart Sensor Soap Dispenser'],
      ['matter-hub', 'Retro-style Study Home Computer Chair'],
      ['desk-3d-printer', '3D printer accessories mute motherboard'],
      ['desk-3d-printer', 'DIY Set Of Accessories 1.83D Printer I3 Motor'],
      ['desk-3d-printer', '3D Printer DIY Model Moonlight Board Two-color Touch Night Light'],
      ['gan-charger', 'Retractable Car Charger 4 in 1 Fast Car Phone Charger 120W With USB Type C Cable'],
    ]
    for (const [id, title] of bad) expect(matchTitle(title, t(id)).ok, `${id}: ${title}`).toBe(false)
  })

  it('keeps the real ones, exact phrase scores 1 and the rest 0.6', () => {
    expect(matchTitle('Aluminum Alloy Smart Door Lock With Facial Recognition And Fingerprint Recognition', t('smart-lock'))).toEqual({ ok: true, strength: 0.6 })
    expect(matchTitle('Portable Home Theater Projector, Mini Projector For Bedroom Gaming Movies', t('laser-projector'))).toEqual({ ok: true, strength: 0.6 })
    expect(matchTitle('Ten-in-One Smart Watch Set With Wireless Earbuds, Multiple Watch Bands, Magnetic Charger & Protective Case', t('smartwatch'))).toEqual({ ok: true, strength: 1 })
    const good: [string, string][] = [
      ['smartwatch', "Children's Phone Watch Smart Positioning Call Photo"],
      ['smartwatch', 'S10 Smartwatch 4G Elderly Phone Watch'],
      ['laser-projector', '5G 4K Projector Smart HD LED WiFi Bluetooth H DMI USB Android Office Home Theater'],
      ['open-ear-buds', 'KP-113 Best-selling Wireless Bluetooth Ear-hook Headphones High-quality Audio Low Latency'],
      ['gan-charger', '100W GaN Multi-Port Charger with Built-in Retractable Type-C Cable - AI Smart Display UK EU Plug Adapter'],
      ['gan-charger', '65W USB C Type-C Adapter Charger For DELL, HP, ASUS, Lenovo, Huawei,Acer Laptop'],
    ]
    for (const [id, title] of good) expect(matchTitle(title, t(id)).ok, title).toBe(true)
  })

  it('says why', () => {
    expect(matchTitle('Retro-style Study Home Computer Chair', t('matter-hub'))).toEqual({ ok: false, reason: 'has "chair"' })
    expect(matchTitle('Aluminum Tube Musical Wind Chime For Home', t('matter-hub'))).toEqual({ ok: false, reason: 'no "hub"' })
    expect(matchTitle('', t('smart-lock'))).toEqual({ ok: false, reason: 'no "lock"' })
  })

  it('matches whole words only and tolerates CJ punctuation', () => {
    expect(hasEntry('V8 engine model', 'gin')).toBe(false)
    expect(hasEntry('DIY Set Of Accessories 1.83D Printer', '3d printer')).toBe(false)
    for (const s of ['Smart Door Lock,Fingerprint', 'WIFI SMART DOOR LOCK', 'Smart-Door Lock']) expect(matchTitle(s, t('smart-lock')).ok, s).toBe(true)
    expect(matchTitle('WiFi SmartLock Fingerprint', t('smart-lock'))).toEqual({ ok: false, reason: 'no "lock"' })
    expect(hasEntry('Wireless 75% Keyboard', '75%')).toBe(true)
  })

  it('pet words are per term: a pet camera is still a camera', () => {
    expect(matchTitle('WiFi Pet Camera 2K Indoor Security', t('indoor-camera')).ok).toBe(true)
  })
})
