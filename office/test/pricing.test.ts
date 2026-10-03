import { describe, expect, it } from 'vitest'
import { OfficeError } from '../src/errors'
import { buildQuote, chooseFreight, priceLines, shippingAud } from '../src/pricing'
import type { CatalogueProduct } from '../src/catalogue.generated'

const cat: CatalogueProduct[] = [
  { id: 'cj-P-A1', name: 'Mini Laser Projector', brand: 'Nexus Select', category: 'Home cinema', price: 95.95, variants: [{ id: 'cj-V-AU', label: 'AU Plug', delta: 0 }, { id: 'cj-V-BIG', label: 'Big', delta: 10 }], fulfil: { route: 'supplier', origin: 'CN' }, supplier: { url: 'u', pid: 'P-A1', vid: 'V-AU', costUsd: 62.4, termId: 'laser-projector' }, sellable: true },
  { id: 'oura-ring-5', name: 'Oura Ring', brand: 'Oura', category: 'Wearables', price: 549, variants: [{ id: 'silver', label: 'Silver', delta: 0 }], fulfil: { route: 'warehouse', origin: 'AU' }, sellable: false },
]
const freight = { cheapest: { name: 'CJPacket Ordinary', usd: 6.1, days: [8, 15] as [number, number] }, fastest: { name: 'DHL Express', usd: 28, days: [3, 5] as [number, number] }, lines: 5 }
const err = (fn: () => unknown) => { try { fn(); return null } catch (e) { return e as OfficeError } }

describe('pricing', () => {
  it('prices lines from the catalogue with variant deltas', () => {
    const lines = priceLines([{ productId: 'cj-P-A1', variantId: 'cj-V-BIG', qty: 2 }], cat)
    expect(lines[0]).toEqual({ productId: 'cj-P-A1', variantId: 'cj-V-BIG', name: 'Mini Laser Projector', qty: 2, unitPrice: 105.95, vid: 'V-AU', origin: 'CN' })
  })
  it('refuses a line that is not sellable', () => {
    const e = err(() => priceLines([{ productId: 'oura-ring-5', variantId: 'silver', qty: 1 }], cat))!
    expect(e).toBeInstanceOf(OfficeError)
    expect(e.status).toBe(422); expect(e.code).toBe('not_sellable'); expect(e.field).toBe('lines[0]')
  })
  it('refuses unknown product, unknown variant and bad quantities', () => {
    expect(err(() => priceLines([{ productId: 'nope', variantId: 'x', qty: 1 }], cat))!.code).toBe('unknown_product')
    expect(err(() => priceLines([{ productId: 'cj-P-A1', variantId: 'x', qty: 1 }], cat))!.code).toBe('unknown_variant')
    expect(err(() => priceLines([{ productId: 'cj-P-A1', variantId: 'cj-V-AU', qty: 0 }], cat))!.code).toBe('bad_qty')
    expect(err(() => priceLines([{ productId: 'cj-P-A1', variantId: 'cj-V-AU', qty: 11 }], cat))!.code).toBe('bad_qty')
    expect(err(() => priceLines([], cat))!.code).toBe('empty_cart')
  })
  it('shippingAud rounds up to .95 with a 4.95 floor', () => {
    expect(shippingAud(6.1, 1.515)).toBe(9.95)
    expect(shippingAud(1, 1.5)).toBe(4.95)
    expect(shippingAud(9.95 / 1.0, 1)).toBe(9.95)
    expect(shippingAud(22.05, 1.515)).toBe(33.95)
  })
  it('express picks the faster line, and falls back to the cheapest line when no faster line exists', () => {
    expect(chooseFreight(freight, 'standard')).toEqual({ logisticName: 'CJPacket Ordinary', usd: 6.1, days: [8, 15], fellBack: false })
    expect(chooseFreight(freight, 'express')).toEqual({ logisticName: 'DHL Express', usd: 28, days: [3, 5], fellBack: false })
    const flat = { ...freight, fastest: freight.cheapest, lines: 1 }
    expect(chooseFreight(flat, 'express')).toEqual({ logisticName: 'CJPacket Ordinary', usd: 6.1, days: [8, 15], fellBack: true })
  })
  it('buildQuote includes GST for AU and adds VAT for GB', () => {
    const lines = priceLines([{ productId: 'cj-P-A1', variantId: 'cj-V-AU', qty: 1 }], cat)
    const au = buildQuote(lines, chooseFreight(freight, 'standard'), 1.515, 'AU', 'standard')
    expect(au.subtotal).toBe(95.95); expect(au.shipping.aud).toBe(9.95); expect(au.tax.included).toBe(true)
    expect(au.total).toBeCloseTo(105.9, 2)
    expect(au.shipping).toMatchObject({ origin: 'CN', method: 'standard', logisticName: 'CJPacket Ordinary', days: [8, 15], fellBack: false })
    const gb = buildQuote(lines, chooseFreight(freight, 'standard'), 1.515, 'GB', 'standard')
    expect(gb.tax.included).toBe(false)
    expect(gb.total).toBeCloseTo(105.9 + gb.tax.amount, 2)
    expect(gb.tax.amount).toBeCloseTo(105.9 * 0.2, 1)
  })
})
