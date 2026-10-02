/* Multi-currency display, tax estimate and shipping. Rates are a daily locked snapshot in production. */

export type Currency = 'USD' | 'AUD' | 'EUR' | 'GBP' | 'JPY'

export interface CurrencyInfo {
  code: Currency
  locale: string
  rate: number
  tax: number
  taxLabel: string
  region: string
  flag: string
}

export const CURRENCIES: Record<Currency, CurrencyInfo> = {
  USD: { code: 'USD', locale: 'en-US', rate: 1, tax: 0.0825, taxLabel: 'Est. sales tax (CA)', region: 'US', flag: 'US' },
  AUD: { code: 'AUD', locale: 'en-AU', rate: 1.52, tax: 0.1, taxLabel: 'GST 10 %', region: 'AU', flag: 'AU' },
  EUR: { code: 'EUR', locale: 'de-DE', rate: 0.92, tax: 0.19, taxLabel: 'VAT 19 %', region: 'DE', flag: 'EU' },
  GBP: { code: 'GBP', locale: 'en-GB', rate: 0.79, tax: 0.2, taxLabel: 'VAT 20 %', region: 'GB', flag: 'GB' },
  JPY: { code: 'JPY', locale: 'ja-JP', rate: 149, tax: 0.1, taxLabel: '消費税 10 %', region: 'JP', flag: 'JP' },
}

export function detectCurrency(): Currency {
  try {
    const lang = navigator.language || ''
    if (/-AU/i.test(lang)) return 'AUD'
    if (/-GB/i.test(lang)) return 'GBP'
    if (/-JP/i.test(lang) || /^ja/i.test(lang)) return 'JPY'
    if (/-(DE|FR|NL|ES|IT|IE|AT|BE|FI|PT)/i.test(lang)) return 'EUR'
  } catch { /* SSR or restricted */ }
  return 'USD'
}

const formatters = new Map<Currency, Intl.NumberFormat>()
export function fmt(amountUsd: number, code: Currency, opts: { compact?: boolean } = {}): string {
  const info = CURRENCIES[code]
  const key = code
  let f = formatters.get(key)
  if (!f) {
    f = new Intl.NumberFormat(info.locale, {
      style: 'currency',
      currency: code,
      maximumFractionDigits: code === 'JPY' ? 0 : 2,
      minimumFractionDigits: code === 'JPY' ? 0 : 2,
    })
    formatters.set(key, f)
  }
  const local = amountUsd * info.rate
  if (opts.compact && code !== 'JPY' && Number.isInteger(Math.round(local * 100) / 100) ) {
    return f.format(local).replace(/[.,]00$/, '')
  }
  return f.format(local)
}

export type ShipMethod = 'standard' | 'express'

export function shippingUsd(subtotalUsd: number, method: ShipMethod, region: string): number {
  const far = region !== 'US'
  if (method === 'express') return far ? 49 : 29
  if (subtotalUsd >= 999) return 0
  return far ? 19 : 9
}

export function taxUsd(taxableUsd: number, code: Currency): number {
  return Math.round(taxableUsd * CURRENCIES[code].tax * 100) / 100
}
