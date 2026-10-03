import { describe, expect, it } from 'vitest'
import { MemoryKV } from '../src/kv'
import { OrderStore, type OfficeOrder } from '../src/orders'
import { fulfil, MAX_ATTEMPTS, RETRY_AFTER_MS, runCron, sync, type FulfilDeps } from '../src/fulfil'
import type { CjOffice } from '../src/cj'
import type { Mailer } from '../src/email'
import { mkOrder } from './helpers'

function harness(o: { failAt?: 'create' | 'confirm' | 'pay' | 'detail'; dryRun?: boolean; detail?: { status: string; trackNumber?: string; logisticName?: string } } = {}) {
  let t = Date.parse('2026-10-05T00:00:00Z')
  const now = () => new Date(t)
  const kv = new MemoryKV({ now: () => t })
  const store = new OrderStore(kv, now, () => 0.5)
  const calls: string[] = []
  const boom = (step: string) => { if (o.failAt === step) throw new Error(step === 'pay' ? 'insufficient balance' : `${step} failed`) }
  const cj: CjOffice = {
    auth: async () => true,
    freight: async () => null,
    createOrder: async () => { calls.push('create'); boom('create'); return 'CJ-1' },
    confirmOrder: async () => { calls.push('confirm'); boom('confirm') },
    payBalance: async () => { calls.push('pay'); boom('pay') },
    orderDetail: async () => { calls.push('detail'); boom('detail'); return o.detail ?? { status: 'PROCESSING' } },
  }
  const mails: string[] = []
  const mailer: Mailer = { confirmation: async (x) => { mails.push(`confirmation:${x.id}`) }, shipped: async (x) => { mails.push(`shipped:${x.id}`) }, attention: async (x) => { mails.push(`attention:${x.id}`) } }
  const deps: FulfilDeps = { cj, store, mailer, now, dryRun: !!o.dryRun, log: () => {} }
  return { deps, store, calls, mails, advance: (ms: number) => { t += ms } }
}

describe('fulfil', () => {
  it('happy path places, confirms, pays and mails', async () => {
    const h = harness()
    await h.store.create(mkOrder('NX-000030'))
    const out = await fulfil((await h.store.get('NX-000030'))!, h.deps)
    expect(out.state).toBe('placed_with_supplier')
    expect(out.supplier).toMatchObject({ cjOrderId: 'CJ-1', dryRun: false })
    expect(out.supplier?.paidAt).toBeTruthy()
    expect(h.calls).toEqual(['create', 'confirm', 'pay'])
    expect(h.mails).toEqual(['confirmation:NX-000030'])
    expect((await h.store.get('NX-000030'))?.state).toBe('placed_with_supplier')
  })
  it('dry run skips payBalance and marks supplier.dryRun', async () => {
    const h = harness({ dryRun: true })
    const out = await fulfil(mkOrder('NX-000031'), h.deps)
    expect(h.calls).toEqual(['create', 'confirm'])
    expect(out.supplier?.dryRun).toBe(true)
    expect(out.supplier?.paidAt).toBeUndefined()
    expect(out.state).toBe('placed_with_supplier')
  })
  it('each failing step → needs_attention with its reason', async () => {
    for (const [step, reason] of [['create', 'cj_create_failed'], ['confirm', 'cj_confirm_failed'], ['pay', 'cj_pay_failed']] as const) {
      const h = harness({ failAt: step })
      const out = await fulfil(mkOrder('NX-000032'), h.deps)
      expect(out.state).toBe('needs_attention')
      expect(out.attention).toMatchObject({ reason, attempts: 1 })
      expect(out.attention?.lastError).toContain(step === 'pay' ? 'insufficient balance' : step)
      expect(Date.parse(out.attention!.nextRetryAt) - h.deps.now().getTime()).toBe(RETRY_AFTER_MS)
      expect(h.mails).toEqual(['attention:NX-000032'])
      if (step !== 'create') expect(out.supplier?.cjOrderId).toBe('CJ-1')   // the CJ order exists even though a later step failed
    }
  })
  it('sync moves to shipped with tracking and mails once, then to delivered', async () => {
    const h = harness({ detail: { status: 'SHIPPED', trackNumber: 'CJPK9', logisticName: 'CJPacket Ordinary' } })
    const placed = mkOrder('NX-000033', { state: 'placed_with_supplier', supplier: { cjOrderId: 'CJ-1', placedAt: 't' } })
    await h.store.create(placed)
    const shipped = await sync(placed, h.deps)
    expect(shipped.state).toBe('shipped')
    expect(shipped.supplier).toMatchObject({ trackNumber: 'CJPK9', logisticName: 'CJPacket Ordinary', cjStatus: 'SHIPPED' })
    expect(h.mails).toEqual(['shipped:NX-000033'])
    const again = await sync(shipped, h.deps)
    expect(h.mails.length).toBe(1)
    expect(again.state).toBe('shipped')
    const h2 = harness({ detail: { status: 'DELIVERED', trackNumber: 'CJPK9' } })
    const delivered = await sync(shipped, h2.deps)
    expect(delivered.state).toBe('delivered')
    const h3 = harness({ detail: { status: 'CANCELLED' } })
    expect((await sync(shipped, h3.deps)).attention?.reason).toBe('cj_cancelled')
  })
  it('cron retries a failed order after 24 h and gives up after 3 attempts', async () => {
    const h = harness({ failAt: 'create' })
    await h.store.create(mkOrder('NX-000034'))
    const first = await fulfil((await h.store.get('NX-000034'))!, h.deps)
    expect(first.attention?.attempts).toBe(1)
    let r = await runCron(h.deps)
    expect(r.retried).toBe(0)                           // not yet due
    h.advance(RETRY_AFTER_MS + 1)
    r = await runCron(h.deps)
    expect(r.retried).toBe(1)
    expect((await h.store.get('NX-000034'))?.attention?.attempts).toBe(2)
    h.advance(RETRY_AFTER_MS + 1); await runCron(h.deps)
    expect((await h.store.get('NX-000034'))?.attention?.attempts).toBe(MAX_ATTEMPTS)
    h.advance(RETRY_AFTER_MS + 1)
    r = await runCron(h.deps)
    expect(r.retried).toBe(0)                           // gave up
    expect(h.calls.filter((c) => c === 'create').length).toBe(MAX_ATTEMPTS)
  })
  it('pay failed on an empty wallet: the next cron after top-up pays without confirming again', async () => {
    const h = harness({ failAt: 'pay' })
    await h.store.create(mkOrder('NX-000037'))
    const stuck = await fulfil((await h.store.get('NX-000037'))!, h.deps)
    expect(stuck.attention?.reason).toBe('cj_pay_failed')
    expect(stuck.supplier).toMatchObject({ cjOrderId: 'CJ-1', confirmedAt: expect.any(String) })
    h.calls.length = 0
    h.advance(RETRY_AFTER_MS + 1)
    const ok = harness({})                                                    // wallet topped up
    const r = await runCron({ ...ok.deps, store: h.store, now: h.deps.now })
    expect(r.retried).toBe(1)
    const placed = (await h.store.get('NX-000037'))!
    expect(placed.state).toBe('placed_with_supplier')
    expect(ok.calls).toEqual(['pay'])                                         // no second create, no second confirm
  })
  it('SHIPPED without a tracking number waits; the shipped mail goes when the number arrives', async () => {
    const h = harness({ detail: { status: 'SHIPPED' } })
    const placed = mkOrder('NX-000038', { state: 'placed_with_supplier', supplier: { cjOrderId: 'CJ-1', placedAt: 't' } })
    await h.store.create(placed)
    const waiting = await sync(placed, h.deps)
    expect(waiting.state).toBe('placed_with_supplier')
    expect(waiting.supplier?.cjStatus).toBe('SHIPPED')
    expect(h.mails).toEqual([])
    const h2 = harness({ detail: { status: 'SHIPPED', trackNumber: 'CJPK10', logisticName: 'CJPacket Ordinary' } })
    const shipped = await sync(waiting, { ...h2.deps, store: h.store })
    expect(shipped.state).toBe('shipped')
    expect(h2.mails).toEqual(['shipped:NX-000038'])
  })
  it('cron syncs open orders and isolates one failure', async () => {
    const h = harness({ failAt: 'detail' })
    await h.store.create(mkOrder('NX-000035', { state: 'placed_with_supplier', supplier: { cjOrderId: 'CJ-1', placedAt: 't' } }))
    await h.store.create(mkOrder('NX-000036', { state: 'placed_with_supplier', supplier: { cjOrderId: 'CJ-2', placedAt: 't' } }))
    const r = await runCron(h.deps)
    expect(r.errors.length).toBe(2)
    expect(r.synced).toBe(0)
    expect(h.calls.filter((c) => c === 'detail').length).toBe(2)   // the second order was still attempted
    expect(await h.deps.store.get('NX-000036')).toMatchObject({ state: 'placed_with_supplier' })
  })
})
