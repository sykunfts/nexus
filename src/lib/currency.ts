/*
  Multi-currency display, tax and shipping. Catalogue prices are AUD and include GST.
  Rates are a snapshot (2 Oct 2026); in production they are locked daily from the payment provider.
*/

export type Currency = 'AUD' | 'USD' | 'EUR' | 'GBP' | 'JPY'

export interface CurrencyInfo {
  code: Currency
  locale: string
  rate: number          // units of this currency per 1 AUD
  tax: number
  taxLabel: string
  taxIncluded: boolean  // AU prices already include GST; elsewhere tax is estimated on top
  region: string
  flag: string
}

export const CURRENCIES: Record<Currency, CurrencyInfo> = {
  AUD: { code: 'AUD', locale: 'en-AU', rate: 1, tax: 0.1, taxLabel: 'Includes GST 10 %', taxIncluded: true, region: 'AU', flag: 'AU' },
  USD: { code: 'USD', locale: 'en-US', rate: 0.66, tax: 0.0825, taxLabel: 'Est. sales tax (CA)', taxIncluded: false, region: 'US', flag: 'US' },
  EUR: { code: 'EUR', locale: 'de-DE', rate: 0.56, tax: 0.19, taxLabel: 'VAT 19 %', taxIncluded: false, region: 'DE', flag: 'EU' },
  GBP: { code: 'GBP', locale: 'en-GB', rate: 0.49, tax: 0.2, taxLabel: 'VAT 20 %', taxIncluded: false, region: 'GB', flag: 'GB' },
  JPY: { code: 'JPY', locale: 'ja-JP', rate: 98, tax: 0.1, taxLabel: '消費税 10 %', taxIncluded: false, region: 'JP', flag: 'JP' },
}

export function detectCurrency(): Currency {
  try {
    const lang = navigator.language || ''
    if (/-US/i.test(lang)) return 'USD'
    if (/-GB/i.test(lang)) return 'GBP'
    if (/-JP/i.test(lang) || /^ja/i.test(lang)) return 'JPY'
    if (/-(DE|FR|NL|ES|IT|IE|AT|BE|FI|PT)/i.test(lang)) return 'EUR'
  } catch { /* SSR or restricted */ }
  return 'AUD'
}

const formatters = new Map<Currency, Intl.NumberFormat>()
/** Format an AUD amount in the chosen currency. */
export function fmt(amountAud: number, code: Currency, opts: { compact?: boolean } = {}): string {
  const info = CURRENCIES[code]
  let f = formatters.get(code)
  if (!f) {
    f = new Intl.NumberFormat(info.locale, {
      style: 'currency',
      currency: code,
      currencyDisplay: 'narrowSymbol',
      maximumFractionDigits: code === 'JPY' ? 0 : 2,
      minimumFractionDigits: code === 'JPY' ? 0 : 2,
    })
    formatters.set(code, f)
  }
  const local = amountAud * info.rate
  if (opts.compact && code !== 'JPY' && Number.isInteger(Math.round(local * 100) / 100)) {
    return f.format(local).replace(/[.,]00$/, '')
  }
  return f.format(local)
}

export type ShipMethod = 'standard' | 'express'

/** Shipping in AUD. Free standard shipping in Australia from A$150. */
export function shippingCost(subtotalAud: number, method: ShipMethod, region: string): number {
  const far = region !== 'AU'
  if (method === 'express') return far ? 59 : 14.95
  if (!far && subtotalAud >= 150) return 0
  return far ? 29 : 9.95
}

/** Tax in AUD: the GST portion of an inclusive AU total, or an estimate added on top elsewhere. */
export function taxOf(amountAud: number, code: Currency): { amount: number; included: boolean } {
  const info = CURRENCIES[code]
  const amount = info.taxIncluded
    ? Math.round((amountAud - amountAud / (1 + info.tax)) * 100) / 100
    : Math.round(amountAud * info.tax * 100) / 100
  return { amount, included: info.taxIncluded }
}
