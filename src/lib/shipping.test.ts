import { describe, expect, it } from 'vitest'
import { COUNTRIES, ETA, RATE, etaText, parcelCost, taxFor, zoneOf } from './shipping'

describe('shipping', () => {
  it('maps every country to a zone with an ETA and a rate from every origin', () => {
    for (const c of COUNTRIES) {
      const z = zoneOf(c.code)
      for (const o of ['AU', 'CN', 'US', 'EU', 'UK'] as const) {
        expect(ETA[o][z]).toHaveLength(2)
        expect(RATE[o][z].standard).toBeGreaterThanOrEqual(0)
      }
    }
  })
  it('prices parcels', () => {
    expect(parcelCost('AU', 'AU', 'standard', 149)).toBe(9.95)
    expect(parcelCost('AU', 'AU', 'standard', 150)).toBe(0)
    expect(parcelCost('AU', 'AU', 'express', 999)).toBe(14.95)
    expect(parcelCost('CN', 'UK', 'standard', 50)).toBe(16)
    expect(() => parcelCost('CN', 'AU', 'express', 50)).toThrow()
    expect(etaText('CN', 'AU')).toBe('8–12 days')
  })
  it('taxes by destination', () => {
    expect(taxFor('AU', 110)).toEqual({ amount: 10, included: true, label: 'Includes GST 10 %' })
    expect(taxFor('GB', 100)).toEqual({ amount: 20, included: false, label: 'VAT 20 %' })
    expect(taxFor('US', 100).amount).toBe(0)
    expect(taxFor('JP', 100)).toEqual({ amount: 10, included: false, label: 'Consumption tax 10 %' })
  })
})
