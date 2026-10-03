/* Address and card validation. Field errors are plain sentences the checkout shows inline. */
import type { Address } from './account'
import type { Country } from './shipping'

export const AU_STATES = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'] as const
export type AUState = (typeof AU_STATES)[number]

export const US_STATES = ['AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'] as const
export const CA_PROVINCES = ['AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT'] as const

/* Australia Post ranges. */
const AU_RANGES: [number, number, AUState][] = [
  [1000, 1999, 'NSW'], [2000, 2599, 'NSW'], [2619, 2899, 'NSW'], [2921, 2999, 'NSW'],
  [200, 299, 'ACT'], [2600, 2618, 'ACT'], [2900, 2920, 'ACT'],
  [3000, 3999, 'VIC'], [8000, 8999, 'VIC'],
  [4000, 4999, 'QLD'], [9000, 9999, 'QLD'],
  [5000, 5999, 'SA'], [6000, 6999, 'WA'], [7000, 7999, 'TAS'], [800, 999, 'NT'],
]

export function auStateForPostcode(pc: string): AUState | null {
  if (!/^\d{4}$/.test(pc)) return null
  const n = Number(pc)
  return AU_RANGES.find(([a, b]) => n >= a && n <= b)?.[2] ?? null
}

const POSTCODE: Partial<Record<Country, RegExp>> = {
  AU: /^\d{4}$/, NZ: /^\d{4}$/, US: /^\d{5}(-\d{4})?$/, CA: /^[A-Za-z]\d[A-Za-z] ?\d[A-Za-z]\d$/,
  GB: /^[A-Za-z]{1,2}\d[A-Za-z\d]? ?\d[A-Za-z]{2}$/, IE: /^[A-Za-z0-9]{3} ?[A-Za-z0-9]{4}$/,
  DE: /^\d{5}$/, FR: /^\d{5}$/, NL: /^\d{4} ?[A-Za-z]{2}$/, BE: /^\d{4}$/, ES: /^\d{5}$/, IT: /^\d{5}$/, SE: /^\d{3} ?\d{2}$/, DK: /^\d{4}$/,
  JP: /^\d{3}-?\d{4}$/, SG: /^\d{6}$/, HK: /^.{0,10}$/, KR: /^\d{5}$/,
}

export function validPostcode(country: Country, pc: string): boolean {
  const s = pc.trim()
  const re = POSTCODE[country]
  if (re) return re.test(s)
  return s.length >= 3 && s.length <= 10
}

export const validEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s.trim())

export function luhn(cardNumber: string): boolean {
  const digits = cardNumber.replace(/\D/g, '')
  if (digits.length < 12 || digits.length > 19) return false
  let sum = 0
  let double = false
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = Number(digits[i])
    if (double) { d *= 2; if (d > 9) d -= 9 }
    sum += d
    double = !double
  }
  return sum % 10 === 0
}

export function validExpiry(mmyy: string, now: Date): boolean {
  const m = mmyy.trim().match(/^(\d{2})\s*\/\s*(\d{2})$/)
  if (!m) return false
  const month = Number(m[1])
  const year = 2000 + Number(m[2])
  if (month < 1 || month > 12) return false
  const end = new Date(Date.UTC(year, month, 0, 23, 59, 59))   // last day of that month
  return end.getTime() >= now.getTime()
}

export type AddressInput = Omit<Address, 'id' | 'isDefault'>

export function validateAddress(a: AddressInput): Record<string, string> {
  const e: Record<string, string> = {}
  if (!a.name?.trim()) e.name = 'Who is it for?'
  if (!a.line1?.trim()) e.line1 = 'Street address is needed.'
  if (!a.city?.trim()) e.city = a.country === 'AU' ? 'Suburb is needed.' : 'City is needed.'
  if (!a.postcode?.trim()) e.postcode = 'Postcode is needed.'
  else if (!validPostcode(a.country, a.postcode)) e.postcode = `That does not look like a ${a.country === 'US' ? 'ZIP code' : 'postcode'} for this country.`
  if (a.country === 'AU') {
    if (!a.region) e.region = 'State is needed.'
    const st = auStateForPostcode(a.postcode?.trim() ?? '')
    if (!e.postcode && st && a.region && st !== a.region) e.postcode = `Postcode ${a.postcode.trim()} is in ${st}, not ${a.region}.`
  }
  if ((a.country === 'US' || a.country === 'CA') && !a.region) e.region = a.country === 'US' ? 'State is needed.' : 'Province is needed.'
  if (a.phone && !/^\+?[\d\s()-]{6,20}$/.test(a.phone)) e.phone = 'That phone number does not look right.'
  return e
}

export function validateCard(c: { number: string; expiry: string; cvc: string; name: string }, now: Date): Record<string, string> {
  const e: Record<string, string> = {}
  if (!luhn(c.number)) e.number = 'That card number does not pass the check digit.'
  if (!validExpiry(c.expiry, now)) e.expiry = 'Expiry needs to be MM/YY and in the future.'
  if (!/^\d{3,4}$/.test(c.cvc.trim())) e.cvc = 'CVC is the 3 or 4 digits on the card.'
  if (!c.name.trim()) e.name = 'Name on the card is needed.'
  return e
}
