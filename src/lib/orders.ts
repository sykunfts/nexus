/* Order model: stored snapshots of what was bought, shipments split by origin, status as a pure function of time. */
import type { Origin, Visual } from './data'
import { byId } from './data'
import { canExpress, etaDays, parcelCost, taxFor, zoneOf, Country } from './shipping'
import type { Line } from './store'
import type { Currency, ShipMethod } from './currency'
import type { Zone } from './shipping'
import type { Address } from './account'

export type OrderStatus = 'placed' | 'packed' | 'shipped' | 'delivered'

export interface OrderLine {
  key: string
  productId: string
  name: string
  brand: string
  variantLabel: string
  qty: number
  unitPrice: number
  visual: Visual
  hue: number
  swatch: string
  origin: Origin
}

export interface Shipment { origin: Origin; zone: Zone; method: ShipMethod; lineKeys: string[]; etaDays: [number, number]; cost: number }

export interface Totals { subtotal: number; shipping: number; tax: number; taxIncluded: boolean; taxLabel: string; total: number; currency: Currency }

export interface Order {
  id: string
  placedAt: string
  email: string
  address: Address
  lines: OrderLine[]
  shipments: Shipment[]
  totals: Totals
  compat: { status: 'ok' | 'warn' | 'bad'; issues: string[] }
  office?: OfficeStatus   // present when the order lives in the back office; its state replaces the time-based status
}

/* What the back office knows about a real order. */
export type OfficeState = 'paid' | 'placed_with_supplier' | 'shipped' | 'delivered' | 'needs_attention' | 'refunded'
export interface OfficeStatus { state: OfficeState; sessionId: string; cjOrderId?: string; trackNumber?: string; logisticName?: string; attention?: string }

/* ---------- functions ---------- */

/* A picture for an order line from its own snapshot, so a product that leaves the catalogue still shows as itself. */
export const lineVisual = (l: OrderLine) => ({ photos: [], visual: l.visual, hue: l.hue, brand: l.brand, name: l.name, variants: [] })

export function toOrderLines(cart: Line[]): OrderLine[] {
  return cart.map((l) => {
    const p = byId(l.productId)
    const v = p.variants.find((x) => x.id === l.variantId) ?? p.variants[0]
    const options = (p.options ?? []).map((g) => g.choices.find((c) => c.id === l.selection[g.id])?.label).filter(Boolean)
    return { key: l.key, productId: p.id, name: p.name, brand: p.brand, variantLabel: [v.label, ...options].join(', '), qty: l.qty, unitPrice: l.unitPrice, visual: p.visual, hue: v.hue, swatch: v.swatch, origin: p.fulfil.origin }
  })
}

/** One shipment per origin present in the lines; express only where the lane offers it. */
export function splitShipments(lines: OrderLine[], country: Country, methods: Partial<Record<Origin, ShipMethod>>): Shipment[] {
  const zone = zoneOf(country)
  const origins = [...new Set(lines.map((l) => l.origin))]
  return origins.map((origin) => {
    const mine = lines.filter((l) => l.origin === origin)
    const subtotal = mine.reduce((n, l) => n + l.qty * l.unitPrice, 0)
    const method: ShipMethod = methods[origin] === 'express' && canExpress(origin, zone) ? 'express' : 'standard'
    return { origin, zone, method, lineKeys: mine.map((l) => l.key), etaDays: etaDays(origin, zone), cost: parcelCost(origin, zone, method, subtotal) }
  })
}

const r2 = (n: number) => Math.round(n * 100) / 100

export function orderTotals(lines: OrderLine[], shipments: Shipment[], country: Country, currency: Currency): Totals {
  const subtotal = r2(lines.reduce((n, l) => n + l.qty * l.unitPrice, 0))
  const shipping = r2(shipments.reduce((n, s) => n + s.cost, 0))
  const tax = taxFor(country, subtotal + shipping)
  return { subtotal, shipping, tax: tax.amount, taxIncluded: tax.included, taxLabel: tax.label, total: r2(subtotal + shipping + (tax.included ? 0 : tax.amount)), currency }
}

export function newOrderId(now: Date, salt: number, taken: string[] = []): string {
  for (let i = 0; ; i++) {
    const n = (Math.floor(now.getTime() / 1000) * 31 + (salt + i) * 7919) % 1_000_000
    const id = `NX-${String(n).padStart(6, '0')}`
    if (!taken.includes(id)) return id
  }
}

const MIN = 60_000
const STEPS: OrderStatus[] = ['placed', 'packed', 'shipped', 'delivered']

/** Status is a pure function of time: packed +2 min, shipped +10 min, delivered +30 min for a short lane, +60 otherwise. */
export function shipmentStatus(order: Order, s: Shipment, now: Date): { status: OrderStatus; at: Record<OrderStatus, string | null> } {
  const placed = Date.parse(order.placedAt)
  const deliverAfter = s.etaDays[0] < 5 ? 30 : 60
  const times: Record<OrderStatus, number> = { placed, packed: placed + 2 * MIN, shipped: placed + 10 * MIN, delivered: placed + deliverAfter * MIN }
  const t = now.getTime()
  const status = [...STEPS].reverse().find((k) => t >= times[k]) ?? 'placed'
  const at = Object.fromEntries(STEPS.map((k) => [k, t >= times[k] ? new Date(times[k]).toISOString() : null])) as Record<OrderStatus, string | null>
  return { status, at }
}

/** The least advanced shipment decides the order's status. */
export function orderStatus(order: Order, now: Date): OrderStatus {
  const idx = Math.min(...order.shipments.map((s) => STEPS.indexOf(shipmentStatus(order, s, now).status)))
  return STEPS[Number.isFinite(idx) ? idx : 0]
}
