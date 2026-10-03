/* Order model. Types now; the functions (shipment split, totals, time-derived status) arrive in Task 9. */
import type { Origin, Visual } from './data'
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
}
