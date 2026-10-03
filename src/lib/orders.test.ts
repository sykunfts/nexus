import { describe, expect, it } from 'vitest'
import { newOrderId, orderStatus, orderTotals, shipmentStatus, splitShipments, toOrderLines } from './orders'
import { byId } from './data'

const line = (id: string, qty = 1) => ({ key: `${id}:x:`, productId: id, variantId: byId(id).variants[0].id, selection: {}, qty, unitPrice: byId(id).price })

describe('orders', () => {
  it('splits by origin for a UK address', () => {
    const lines = toOrderLines([line('xgimi-mogo-4-laser'), line('anker-maggo-10k')])
    const ships = splitShipments(lines, 'GB', {})
    expect(ships.map((s) => [s.origin, s.zone, s.etaDays, s.cost])).toEqual([['AU', 'UK', [8, 14], 39], ['CN', 'UK', [10, 20], 16]])
    const t = orderTotals(lines, ships, 'GB', 'GBP')
    expect(t.taxLabel).toBe('VAT 20 %')
    expect(t.taxIncluded).toBe(false)
    expect(t.tax).toBeCloseTo((1229 + 119.96 + 55) * 0.2, 2)
    expect(t.total).toBeCloseTo(1229 + 119.96 + 55 + t.tax, 2)
    expect(t.currency).toBe('GBP')
  })
  it('AU totals include GST and free Sydney shipping over 150', () => {
    const lines = toOrderLines([line('xgimi-mogo-4-laser')])
    const ships = splitShipments(lines, 'AU', { AU: 'standard' })
    const t = orderTotals(lines, ships, 'AU', 'AUD')
    expect(ships[0].cost).toBe(0)
    expect(t.taxIncluded).toBe(true)
    expect(t.total).toBe(1229)
  })
  it('express applies only where the lane offers it', () => {
    const lines = toOrderLines([line('xgimi-mogo-4-laser'), line('anker-maggo-10k')])
    const ships = splitShipments(lines, 'AU', { AU: 'express', CN: 'express' })
    expect(ships.find((s) => s.origin === 'AU')?.method).toBe('express')
    expect(ships.find((s) => s.origin === 'CN')?.method).toBe('standard')
  })
  it('status advances with time', () => {
    const lines = toOrderLines([line('chipolo-pop')])
    const order = { id: 'NX-000001', placedAt: '2026-10-03T00:00:00Z', email: 'n@x.com', address: {} as never, lines, shipments: splitShipments(lines, 'AU', {}), totals: {} as never, compat: { status: 'ok' as const, issues: [] } }
    const s = order.shipments[0]
    expect(shipmentStatus(order, s, new Date('2026-10-03T00:01:00Z')).status).toBe('placed')
    expect(shipmentStatus(order, s, new Date('2026-10-03T00:03:00Z')).status).toBe('packed')
    expect(shipmentStatus(order, s, new Date('2026-10-03T00:11:00Z')).status).toBe('shipped')
    expect(shipmentStatus(order, s, new Date('2026-10-03T00:45:00Z')).status).toBe('shipped')   // CN origin, etaDays[0] = 8 → delivered at +60
    expect(orderStatus(order, new Date('2026-10-03T01:01:00Z'))).toBe('delivered')
    expect(shipmentStatus(order, s, new Date('2026-10-03T00:03:00Z')).at.packed).toBe('2026-10-03T00:02:00.000Z')
    expect(shipmentStatus(order, s, new Date('2026-10-03T00:03:00Z')).at.shipped).toBeNull()
  })
  it('order ids are NX- plus six digits', () => {
    expect(newOrderId(new Date('2026-10-03T00:00:00Z'), 7)).toMatch(/^NX-\d{6}$/)
    expect(newOrderId(new Date('2026-10-03T00:00:00Z'), 7)).not.toBe(newOrderId(new Date('2026-10-03T00:00:01Z'), 8))
    const taken = newOrderId(new Date('2026-10-03T00:00:00Z'), 7)
    expect(newOrderId(new Date('2026-10-03T00:00:00Z'), 7, [taken])).not.toBe(taken)
  })
})
