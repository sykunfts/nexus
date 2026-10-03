/* The order record, the moves it may make, and its home in KV with the indexes the handlers need. */
import { OfficeError } from './errors'
import { getJson, listAll, putJson, type KV } from './kv'
import type { PricedLine, Quote } from './pricing'
import type { Draft } from './stripe'

export type OrderState = 'paid' | 'placed_with_supplier' | 'shipped' | 'delivered' | 'needs_attention' | 'refunded'

export interface OfficeOrder {
  id: string
  createdAt: string
  email: string
  address: Draft['address']
  lines: PricedLine[]
  shipping: Quote['shipping']
  tax: Quote['tax']
  subtotal: number
  total: number
  currency: 'AUD'
  stripe: { sessionId: string; paymentIntentId: string | null; paid: boolean; draftId?: string }
  state: OrderState
  supplier?: { cjOrderId: string; cjStatus?: string; trackNumber?: string; logisticName?: string; placedAt: string; confirmedAt?: string; paidAt?: string; dryRun?: boolean }
  attention?: { reason: string; at: string; lastError: string; attempts: number; nextRetryAt: string }
  history: { at: string; state: OrderState; note?: string }[]
}

const ALLOWED: Record<OrderState, OrderState[]> = {
  paid: ['placed_with_supplier', 'needs_attention', 'refunded'],
  placed_with_supplier: ['shipped', 'delivered', 'needs_attention', 'refunded'],
  shipped: ['delivered', 'needs_attention', 'refunded'],
  delivered: ['needs_attention', 'refunded'],
  needs_attention: ['placed_with_supplier', 'shipped', 'delivered', 'refunded', 'needs_attention'],
  refunded: [],
}

export function transition(o: OfficeOrder, to: OrderState, at: string, note?: string): OfficeOrder {
  if (!ALLOWED[o.state].includes(to)) throw new OfficeError(409, 'bad_transition', undefined, `bad_transition: ${o.state} → ${to}`)
  return { ...o, state: to, history: [...o.history, { at, state: to, ...(note ? { note } : {}) }] }
}

export const normaliseEmail = (e: string) => e.trim().toLowerCase()
const fnv = (s: string) => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0 } return h }
const CLOSED: OrderState[] = ['delivered', 'refunded']

export class OrderStore {
  constructor(private kv: KV, private now: () => Date, private random: () => number) {}

  /* With a seed (the Stripe session id) the id is deterministic, so two webhook deliveries in flight write the same record. */
  async newId(seed?: string): Promise<string> {
    const base = seed !== undefined ? fnv(seed) : Math.floor(this.now().getTime() / 1000) * 31 + Math.floor(this.random() * 1_000_000)
    for (let i = 0; i < 50; i++) {
      const id = `NX-${String((base + i * 7919) % 1_000_000).padStart(6, '0')}`
      const taken = await getJson<OfficeOrder>(this.kv, `order:${id}`)
      if (!taken || (seed !== undefined && taken.stripe.sessionId === seed)) return id
    }
    throw new OfficeError(500, 'no_free_order_id')
  }

  async create(o: OfficeOrder): Promise<void> {
    await putJson(this.kv, `order:${o.id}`, o)
    await this.kv.put(`session:${o.stripe.sessionId}`, o.id)
    await this.kv.put(`email:${normaliseEmail(o.email)}:${o.id}`, '1')
    if (!CLOSED.includes(o.state)) await this.kv.put(`open:${o.id}`, '1')
  }

  async save(o: OfficeOrder): Promise<void> {
    await putJson(this.kv, `order:${o.id}`, o)
    if (CLOSED.includes(o.state)) await this.kv.delete(`open:${o.id}`)
    else await this.kv.put(`open:${o.id}`, '1')
  }

  get(id: string) { return getJson<OfficeOrder>(this.kv, `order:${id}`) }

  async bySession(sessionId: string): Promise<OfficeOrder | null> {
    const id = await this.kv.get(`session:${sessionId}`)
    return id ? this.get(id) : null
  }

  async byEmail(id: string, email: string): Promise<OfficeOrder | null> {
    const hit = await this.kv.get(`email:${normaliseEmail(email)}:${id}`)
    return hit ? this.get(id) : null
  }

  async listOpen(): Promise<OfficeOrder[]> {
    const keys = await listAll(this.kv, 'open:')
    const orders = await Promise.all(keys.map((k) => this.get(k.slice('open:'.length))))
    return orders.filter((o): o is OfficeOrder => !!o)
  }

  async list(state?: OrderState, limit = 100): Promise<OfficeOrder[]> {
    const keys = await listAll(this.kv, 'order:')
    const orders = (await Promise.all(keys.map((k) => this.get(k.slice('order:'.length))))).filter((o): o is OfficeOrder => !!o)
    return orders.filter((o) => !state || o.state === state).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit)
  }
}
