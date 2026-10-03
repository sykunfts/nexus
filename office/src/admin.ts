/* The merchant's endpoints: bearer token, no CORS, read the queue, retry a stuck order, record a refund. */
import { json, OfficeError } from './errors'
import { fulfil } from './fulfil'
import { health } from './health'
import { notifySummary } from './notify'
import type { Ctx } from './office'
import { transition, type OrderState } from './orders'
import { constantTimeEqual } from './stripe'

export { constantTimeEqual }

const STATES: OrderState[] = ['paid', 'placed_with_supplier', 'shipped', 'delivered', 'needs_attention', 'refunded']
/* fulfil() creates, confirms and pays with CJ; running it on an order CJ already holds could pay twice. */
const RETRYABLE: OrderState[] = ['paid', 'needs_attention']

function authorised(c: Ctx, request: Request): boolean {
  const header = request.headers.get('Authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  const expected = c.env.ADMIN_TOKEN ?? ''
  return expected.length > 0 && token.length > 0 && constantTimeEqual(token, expected)
}

async function readNote(request: Request): Promise<string> {
  try { const b = (await request.json()) as { note?: unknown }; return typeof b?.note === 'string' ? b.note.trim().slice(0, 500) : '' } catch { return '' }
}

export async function adminRoutes(c: Ctx, request: Request, path: string): Promise<Response> {
  if (!authorised(c, request)) throw new OfficeError(401, 'unauthorised')
  const url = new URL(request.url)
  const m = request.method
  if (m === 'GET' && path === '/admin/health') return json(await health(c))
  if (m === 'GET' && path === '/admin/notify') return json({ products: await notifySummary(c.kv) })
  if (m === 'GET' && path === '/admin/orders') {
    const raw = url.searchParams.get('state')
    const state = raw && STATES.includes(raw as OrderState) ? (raw as OrderState) : undefined
    if (raw && !state) throw new OfficeError(422, 'bad_state', 'state')
    return json({ orders: await c.store.list(state) })
  }
  const order = path.match(/^\/admin\/orders\/([^/]+)(?:\/(retry|refunded))?$/)
  if (order) {
    const id = decodeURIComponent(order[1])
    const action = order[2]
    const o = await c.store.get(id)
    if (!o) throw new OfficeError(404, 'not_found')
    if (m === 'GET' && !action) return json(o)
    if (m === 'POST' && action === 'retry') {
      if (!RETRYABLE.includes(o.state)) throw new OfficeError(409, 'bad_state', undefined, `cannot retry an order that is ${o.state}`)
      const out = await fulfil(o, c.fulfilDeps)
      c.log(`admin: retried ${id} → ${out.state}`)
      return json(out)
    }
    if (m === 'POST' && action === 'refunded') {
      const note = await readNote(request)
      const out = transition(o, 'refunded', c.now().toISOString(), note || 'refunded in Stripe')
      await c.store.save(out)
      c.log(`admin: ${id} refunded`)
      return json(out)
    }
  }
  throw new OfficeError(404, 'not_found')
}
