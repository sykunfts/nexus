/*
  Money is decided here, from the generated catalogue and the Worker's own freight quote; nothing
  the browser sends is trusted for a price.
*/
import type { CatalogueProduct } from './catalogue.generated'
import { OfficeError } from './errors'
import { taxFor, type Country } from '../../src/lib/shipping'
import type { FreightQuote } from '../../radar/src/types'

export interface CartLine { productId: string; variantId: string; qty: number }
export interface PricedLine { productId: string; variantId: string; name: string; qty: number; unitPrice: number; vid: string; origin: string }
export interface FreightChoice { logisticName: string; usd: number; days: [number, number]; fellBack: boolean }
export interface Quote {
  lines: PricedLine[]
  subtotal: number
  shipping: { origin: 'CN'; method: 'standard' | 'express'; logisticName: string; aud: number; days: [number, number]; fellBack: boolean }
  tax: { amount: number; included: boolean; label: string }
  total: number
}

export const MAX_QTY = 10
export const MIN_SHIPPING_AUD = 4.95
const r2 = (n: number) => Math.round(n * 100) / 100

export function priceLines(lines: CartLine[], catalogue: CatalogueProduct[]): PricedLine[] {
  if (!Array.isArray(lines) || lines.length === 0) throw new OfficeError(422, 'empty_cart', 'lines')
  return lines.map((l, i) => {
    const field = `lines[${i}]`
    const p = catalogue.find((c) => c.id === l.productId)
    if (!p) throw new OfficeError(422, 'unknown_product', field)
    if (!p.sellable || !p.supplier) throw new OfficeError(422, 'not_sellable', field, `${p.name} is not available to buy yet`)
    const v = p.variants.find((x) => x.id === l.variantId)
    if (!v) throw new OfficeError(422, 'unknown_variant', field)
    if (!Number.isInteger(l.qty) || l.qty < 1 || l.qty > MAX_QTY) throw new OfficeError(422, 'bad_qty', field, `quantity must be 1 to ${MAX_QTY}`)
    return { productId: p.id, variantId: v.id, name: p.name, qty: l.qty, unitPrice: r2(p.price + v.delta), vid: p.supplier.vid, origin: p.fulfil.origin }
  })
}

/* Freight in AUD the customer sees: the line's price converted, rounded up to the next .95, never under $4.95. */
export function shippingAud(freightUsd: number, rate: number): number {
  const aud = freightUsd * rate
  const pretty = Math.max(0, Math.ceil(aud - 0.95 - 1e-9)) + 0.95
  return r2(Math.max(MIN_SHIPPING_AUD, pretty))
}

export function chooseFreight(quote: FreightQuote, method: 'standard' | 'express'): FreightChoice {
  const c = quote.cheapest, f = quote.fastest
  if (method === 'express' && f.days[1] < c.days[1]) return { logisticName: f.name, usd: f.usd, days: f.days, fellBack: false }
  return { logisticName: c.name, usd: c.usd, days: c.days, fellBack: method === 'express' }
}

export function buildQuote(lines: PricedLine[], choice: FreightChoice, rate: number, country: Country, method: 'standard' | 'express'): Quote {
  const subtotal = r2(lines.reduce((n, l) => n + l.qty * l.unitPrice, 0))
  const aud = shippingAud(choice.usd, rate)
  const tax = taxFor(country, subtotal + aud)
  const total = r2(subtotal + aud + (tax.included ? 0 : tax.amount))
  return { lines, subtotal, shipping: { origin: 'CN', method, logisticName: choice.logisticName, aud, days: choice.days, fellBack: choice.fellBack }, tax: { amount: r2(tax.amount), included: tax.included, label: tax.label }, total }
}
