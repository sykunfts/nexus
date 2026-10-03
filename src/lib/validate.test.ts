import { describe, expect, it } from 'vitest'
import { auStateForPostcode, luhn, validEmail, validExpiry, validPostcode, validateAddress, validateCard, errorSummary } from './validate'

describe('validate', () => {
  it('maps AU postcodes to states', () => {
    expect(auStateForPostcode('2000')).toBe('NSW')
    expect(auStateForPostcode('2600')).toBe('ACT')
    expect(auStateForPostcode('3000')).toBe('VIC')
    expect(auStateForPostcode('0800')).toBe('NT')
    expect(auStateForPostcode('1234')).toBe('NSW')
    expect(auStateForPostcode('9999')).toBe('QLD')
    expect(auStateForPostcode('abcd')).toBeNull()
  })
  it('rejects an AU postcode in the wrong state', () => {
    expect(validateAddress({ name: 'N', line1: '1 St', city: 'Melbourne', region: 'NSW', postcode: '3000', country: 'AU' }).postcode).toMatch(/VIC/)
    expect(validateAddress({ name: 'N', line1: '1 St', city: 'Sydney', region: 'NSW', postcode: '2000', country: 'AU' })).toEqual({})
    expect(validateAddress({ name: '', line1: '', city: '', postcode: '', country: 'GB' })).toEqual(expect.objectContaining({ name: expect.any(String), line1: expect.any(String), city: expect.any(String), postcode: expect.any(String) }))
  })
  it('validates postcodes per country', () => {
    expect(validPostcode('US', '90210')).toBe(true)
    expect(validPostcode('US', '90210-1234')).toBe(true)
    expect(validPostcode('US', '9021')).toBe(false)
    expect(validPostcode('CA', 'M5V 3L9')).toBe(true)
    expect(validPostcode('GB', 'SW1A 1AA')).toBe(true)
    expect(validPostcode('NZ', '6011')).toBe(true)
    expect(validPostcode('JP', '100-0001')).toBe(true)
    expect(validPostcode('DE', '10115')).toBe(true)
    expect(validPostcode('XX', 'AB')).toBe(false)
    expect(validPostcode('XX', 'ABC 123')).toBe(true)
  })
  it('luhn, expiry and email', () => {
    expect(luhn('4242 4242 4242 4242')).toBe(true)
    expect(luhn('4242 4242 4242 4241')).toBe(false)
    expect(validExpiry('12/27', new Date('2026-10-03'))).toBe(true)
    expect(validExpiry('09/26', new Date('2026-10-03'))).toBe(false)
    expect(validExpiry('10/26', new Date('2026-10-03'))).toBe(true)
    expect(validEmail('nick@example.com')).toBe(true)
    expect(validEmail('nick@')).toBe(false)
    expect(Object.keys(validateCard({ number: '4242424242424242', expiry: '12/27', cvc: '123', name: 'N' }, new Date('2026-10-03')))).toEqual([])
    expect(validateCard({ number: '1234', expiry: '13/27', cvc: '12', name: '' }, new Date('2026-10-03'))).toEqual(expect.objectContaining({ number: expect.any(String), expiry: expect.any(String), cvc: expect.any(String), name: expect.any(String) }))
  })
  it('summarises a step\'s errors as one sentence naming the fields', () => {
    const labels = { name: 'Name', line1: 'Street address', postcode: 'Postcode' }
    expect(errorSummary({}, labels)).toBeNull()
    expect(errorSummary({ postcode: 'x' }, labels)).toBe('One field needs fixing: Postcode.')
    expect(errorSummary({ name: 'x', line1: 'y', postcode: 'z' }, labels)).toBe('3 fields need fixing: Name, Street address and Postcode.')
    expect(errorSummary({ mystery: 'x' }, labels)).toBe('One field needs fixing: mystery.')
  })
})
