/*
  Worldwide shipping and tax. The destination decides shipping and tax; the shopper's region decides
  plug and voltage checks; the display currency decides nothing but formatting.
  Rates and ETAs are a declared matrix with placeholder values so the whole flow works today; live
  supplier quotes (build 4) replace the CN rows one at a time.
*/
import { Fulfil, Origin, Region } from './data'
import type { ShipMethod } from './currency'

export type Zone = 'AU' | 'NZ' | 'NA' | 'UK' | 'EU' | 'ASIA' | 'ROW'
export type Country = 'AU' | 'NZ' | 'US' | 'CA' | 'GB' | 'IE' | 'DE' | 'FR' | 'NL' | 'BE' | 'ES' | 'IT' | 'SE' | 'DK' | 'JP' | 'SG' | 'HK' | 'KR' | 'XX'

export interface CountryInfo { code: Country; name: string; zone: Zone; region: Region; dial: string }

export const COUNTRIES: CountryInfo[] = [
  { code: 'AU', name: 'Australia', zone: 'AU', region: 'AU', dial: '+61' },
  { code: 'NZ', name: 'New Zealand', zone: 'NZ', region: 'NZ', dial: '+64' },
  { code: 'US', name: 'United States', zone: 'NA', region: 'US', dial: '+1' },
  { code: 'CA', name: 'Canada', zone: 'NA', region: 'CA', dial: '+1' },
  { code: 'GB', name: 'United Kingdom', zone: 'UK', region: 'UK', dial: '+44' },
  { code: 'IE', name: 'Ireland', zone: 'EU', region: 'UK', dial: '+353' },
  { code: 'DE', name: 'Germany', zone: 'EU', region: 'EU', dial: '+49' },
  { code: 'FR', name: 'France', zone: 'EU', region: 'EU', dial: '+33' },
  { code: 'NL', name: 'Netherlands', zone: 'EU', region: 'EU', dial: '+31' },
  { code: 'BE', name: 'Belgium', zone: 'EU', region: 'EU', dial: '+32' },
  { code: 'ES', name: 'Spain', zone: 'EU', region: 'EU', dial: '+34' },
  { code: 'IT', name: 'Italy', zone: 'EU', region: 'EU', dial: '+39' },
  { code: 'SE', name: 'Sweden', zone: 'EU', region: 'EU', dial: '+46' },
  { code: 'DK', name: 'Denmark', zone: 'EU', region: 'EU', dial: '+45' },
  { code: 'JP', name: 'Japan', zone: 'ASIA', region: 'JP', dial: '+81' },
  { code: 'SG', name: 'Singapore', zone: 'ASIA', region: 'UK', dial: '+65' },
  { code: 'HK', name: 'Hong Kong', zone: 'ASIA', region: 'UK', dial: '+852' },
  { code: 'KR', name: 'South Korea', zone: 'ASIA', region: 'EU', dial: '+82' },
  { code: 'XX', name: 'Other country', zone: 'ROW', region: 'EU', dial: '' },
]

export const countryInfo = (c: Country) => COUNTRIES.find((x) => x.code === c) ?? COUNTRIES[COUNTRIES.length - 1]
export const zoneOf = (c: Country): Zone => countryInfo(c).zone
export const regionOf = (c: Country): Region => countryInfo(c).region
export const ZONE_LABEL: Record<Zone, string> = { AU: 'Australia', NZ: 'New Zealand', NA: 'United States and Canada', UK: 'United Kingdom', EU: 'Europe', ASIA: 'Asia', ROW: 'Rest of world' }

type Rate = { standard: number; express: number | null; freeFrom: number | null }

/* Sydney stock. The same rows serve US, EU and UK origins once the catalogue has them, with the origin's own zone priced like AU→AU. */
const FROM_HOME: Record<Zone, [number, number]> = { AU: [2, 4], NZ: [4, 7], NA: [7, 12], UK: [8, 14], EU: [8, 14], ASIA: [6, 10], ROW: [10, 20] }
const FROM_HOME_RATE: Record<Zone, Rate> = {
  AU: { standard: 9.95, express: 14.95, freeFrom: 150 },
  NZ: { standard: 19, express: 39, freeFrom: null },
  NA: { standard: 35, express: 69, freeFrom: null },
  UK: { standard: 39, express: 79, freeFrom: null },
  EU: { standard: 39, express: 79, freeFrom: null },
  ASIA: { standard: 29, express: 59, freeFrom: null },
  ROW: { standard: 49, express: 99, freeFrom: null },
}
/* Supplier direct from China (CJ lines): no express until live quotes arrive. */
const FROM_CN: Record<Zone, [number, number]> = { AU: [8, 12], NZ: [10, 16], NA: [10, 18], UK: [10, 20], EU: [10, 20], ASIA: [6, 12], ROW: [15, 30] }
const FROM_CN_RATE: Record<Zone, Rate> = {
  AU: { standard: 14.95, express: null, freeFrom: null },
  NZ: { standard: 19, express: null, freeFrom: null },
  NA: { standard: 14.95, express: null, freeFrom: null },
  UK: { standard: 16, express: null, freeFrom: null },
  EU: { standard: 16, express: null, freeFrom: null },
  ASIA: { standard: 12, express: null, freeFrom: null },
  ROW: { standard: 29, express: null, freeFrom: null },
}

const homeZone: Record<Exclude<Origin, 'CN'>, Zone> = { AU: 'AU', US: 'NA', EU: 'EU', UK: 'UK' }

function fromOrigin<T>(origin: Origin, home: Record<Zone, T>, cn: Record<Zone, T>): Record<Zone, T> {
  if (origin === 'CN') return cn
  if (origin === 'AU') return home
  // a US/EU/UK origin ships to its own zone like Sydney ships to Australia, and to Australia like Sydney ships abroad
  const own = homeZone[origin]
  return { ...home, [own]: home.AU, AU: home[own] } as Record<Zone, T>
}

export const ETA: Record<Origin, Record<Zone, [number, number]>> = {
  AU: fromOrigin('AU', FROM_HOME, FROM_CN), CN: fromOrigin('CN', FROM_HOME, FROM_CN),
  US: fromOrigin('US', FROM_HOME, FROM_CN), EU: fromOrigin('EU', FROM_HOME, FROM_CN), UK: fromOrigin('UK', FROM_HOME, FROM_CN),
}
export const RATE: Record<Origin, Record<Zone, Rate>> = {
  AU: fromOrigin('AU', FROM_HOME_RATE, FROM_CN_RATE), CN: fromOrigin('CN', FROM_HOME_RATE, FROM_CN_RATE),
  US: fromOrigin('US', FROM_HOME_RATE, FROM_CN_RATE), EU: fromOrigin('EU', FROM_HOME_RATE, FROM_CN_RATE), UK: fromOrigin('UK', FROM_HOME_RATE, FROM_CN_RATE),
}

export const etaDays = (origin: Origin, zone: Zone): [number, number] => ETA[origin][zone]
export const etaText = (origin: Origin, zone: Zone): string => { const [a, b] = ETA[origin][zone]; return `${a}–${b} days` }

const ORIGIN_NAME: Record<Origin, string> = { AU: 'Australia', CN: 'China', US: 'the United States', EU: 'Europe', UK: 'the United Kingdom' }
export function originLabel(f: Fulfil): string {
  if (f.route === 'warehouse') return f.origin === 'AU' ? 'Sydney warehouse' : `Warehouse in ${ORIGIN_NAME[f.origin]}`
  return `Supplier, ships from ${ORIGIN_NAME[f.origin]}`
}
export const originShort = (f: Fulfil): string => (f.route === 'warehouse' && f.origin === 'AU' ? 'Sydney stock' : f.route === 'warehouse' ? 'Warehouse stock' : 'Supplier direct')

export const canExpress = (origin: Origin, zone: Zone) => RATE[origin][zone].express !== null

/** AUD cost of one parcel. Throws if express is not offered on that lane. */
export function parcelCost(origin: Origin, zone: Zone, method: ShipMethod, parcelSubtotal: number): number {
  const r = RATE[origin][zone]
  if (method === 'express') {
    if (r.express === null) throw new Error(`No express line from ${origin} to ${zone}`)
    return r.express
  }
  if (r.freeFrom !== null && parcelSubtotal >= r.freeFrom) return 0
  return r.standard
}

/** Tax by delivery country, in AUD. Prices include GST; elsewhere tax is added on top or collected on delivery. */
export function taxFor(country: Country, taxable: number): { amount: number; included: boolean; label: string } {
  const r2 = (n: number) => Math.round(n * 100) / 100
  switch (country) {
    case 'AU': return { amount: r2(taxable - taxable / 1.1), included: true, label: 'Includes GST 10 %' }
    case 'NZ': return { amount: r2(taxable * 0.15), included: false, label: 'GST 15 %' }
    case 'GB': return { amount: r2(taxable * 0.2), included: false, label: 'VAT 20 %' }
    case 'IE': case 'DE': case 'FR': case 'NL': case 'BE': case 'ES': case 'IT': case 'SE': case 'DK':
      return { amount: r2(taxable * 0.2), included: false, label: 'VAT 20 % (estimate)' }
    case 'JP': return { amount: r2(taxable * 0.1), included: false, label: 'Consumption tax 10 %' }
    case 'US': case 'CA': return { amount: 0, included: false, label: 'Sales tax estimated by the payment provider' }
    default: return { amount: 0, included: false, label: 'Duties and taxes may be collected on delivery' }
  }
}

/** Until the store carries the shopper's region (Task 5), every page reads the Australian zone. */
export const useZone = (): Zone => 'AU'
