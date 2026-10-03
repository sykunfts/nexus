import { describe, expect, it } from 'vitest'
import { MemoryKV } from '../src/kv'
import { normaliseEmail, OrderStore, transition } from '../src/orders'
import { mkOrder } from './helpers'

describe('transition', () => {
  it('allows the documented moves and refuses the rest', () => {
    const o = mkOrder('NX-000001')
    const placed = transition(o, 'placed_with_supplier', 't1', 'cj ok')
    expect(placed.state).toBe('placed_with_supplier')
    expect(placed.history.at(-1)).toEqual({ at: 't1', state: 'placed_with_supplier', note: 'cj ok' })
    expect(transition(placed, 'shipped', 't2').state).toBe('shipped')
    expect(transition(transition(placed, 'shipped', 't2'), 'delivered', 't3').state).toBe('delivered')
    expect(transition(placed, 'needs_attention', 't2').state).toBe('needs_attention')
    expect(transition(transition(placed, 'needs_attention', 't2'), 'placed_with_supplier', 't3').state).toBe('placed_with_supplier')
    expect(transition(o, 'refunded', 't1').state).toBe('refunded')
    const delivered = transition(transition(placed, 'shipped', 't2'), 'delivered', 't3')
    expect(() => transition(delivered, 'paid', 't4')).toThrow(/bad_transition/)
    expect(() => transition(o, 'shipped', 't1')).toThrow(/bad_transition/)
  })
})

describe('OrderStore', () => {
  const store = () => new OrderStore(new MemoryKV(), () => new Date('2026-10-05T00:00:00Z'), () => 0.42)
  it('newId is unique against the store', async () => {
    const s = store()
    const a = await s.newId()
    expect(a).toMatch(/^NX-\d{6}$/)
    await s.create(mkOrder(a))
    const b = await s.newId()
    expect(b).not.toBe(a)
  })
  it('create writes the indexes and bySession finds it', async () => {
    const s = store()
    await s.create(mkOrder('NX-000002'))
    expect((await s.get('NX-000002'))?.id).toBe('NX-000002')
    expect((await s.bySession('cs_NX-000002'))?.id).toBe('NX-000002')
    expect(await s.bySession('cs_nope')).toBeNull()
    expect((await s.listOpen()).map((o) => o.id)).toEqual(['NX-000002'])
  })
  it('email lookup is case- and space-insensitive', async () => {
    const s = store()
    await s.create(mkOrder('NX-000003'))
    expect((await s.byEmail('NX-000003', '  Nick@Example.COM '))?.id).toBe('NX-000003')
    expect(await s.byEmail('NX-000003', 'someone@else.com')).toBeNull()
    expect(normaliseEmail(' A@B.CO ')).toBe('a@b.co')
  })
  it('listOpen drops delivered and refunded; list is newest first and filters by state', async () => {
    const s = store()
    await s.create(mkOrder('NX-000010', { createdAt: '2026-10-01T00:00:00.000Z' }))
    await s.create(mkOrder('NX-000011', { createdAt: '2026-10-03T00:00:00.000Z' }))
    await s.create(mkOrder('NX-000012', { createdAt: '2026-10-02T00:00:00.000Z' }))
    const done = transition(transition(transition((await s.get('NX-000010'))!, 'placed_with_supplier', 't'), 'shipped', 't'), 'delivered', 't')
    await s.save(done)
    await s.save(transition((await s.get('NX-000012'))!, 'refunded', 't'))
    expect((await s.listOpen()).map((o) => o.id)).toEqual(['NX-000011'])
    expect((await s.list()).map((o) => o.id)).toEqual(['NX-000011', 'NX-000012', 'NX-000010'])
    expect((await s.list('refunded')).map((o) => o.id)).toEqual(['NX-000012'])
  })
})
