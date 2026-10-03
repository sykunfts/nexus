/*
  The office itself: a router over injected dependencies, so the same code runs on Workers and in
  tests. Every handler validates, calls a pure module, and answers JSON with the shop's CORS.
*/
import { CATALOGUE, type CatalogueProduct } from './catalogue.generated'
import { createCjOffice, type CjOffice, type TokenStore } from './cj'
import { createMailer, type Mailer } from './email'
import type { Env } from './env'
import { json, OfficeError, toResponse } from './errors'
import { fulfil, runCron, type FulfilDeps } from './fulfil'
import { health } from './health'
import { getJson, putJson, type KV } from './kv'
import { buildQuote, chooseFreight, priceLines, type CartLine, type Quote } from './pricing'
import { getRate } from './rate'
import { limit, LIMITS } from './ratelimit'
import { normaliseEmail, OrderStore, transition, type OfficeOrder, type OrderState } from './orders'
import { createSession, verifyWebhook, type Draft } from './stripe'
import { adminRoutes } from './admin'
import { notifyRoute } from './notify'
import { COUNTRIES, type Country } from '../../src/lib/shipping'
import { validEmail, validPhone, validPostcode } from '../../src/lib/validate'

export interface OfficeDeps {
  kv: KV
  env: Omit<Env, 'ORDERS'>
  fetch: typeof fetch
  now: () => Date
  random: () => number
  cj?: CjOffice
  mailer?: Mailer
  catalogue?: CatalogueProduct[]
  log?: (s: string) => void
}

export interface Ctx extends Required<Pick<OfficeDeps, 'kv' | 'fetch' | 'now' | 'random' | 'cj' | 'mailer' | 'catalogue' | 'log'>> { env: Omit<Env, 'ORDERS'>; store: OrderStore; fulfilDeps: FulfilDeps }

const CHECKOUT_FIELDS = { email: 'email', postcode: 'address.postcode', country: 'address.country' }
const CJ_TOKEN_TTL_SEC = 7 * 86_400   // CJ tokens last 15 days; a stale one is replaced on the first auth error
const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null
const str = (x: unknown) => (typeof x === 'string' ? x.trim() : '')

function parseLines(raw: unknown): CartLine[] {
  if (!Array.isArray(raw)) throw new OfficeError(422, 'empty_cart', 'lines')
  return raw.map((l) => ({ productId: str(isObj(l) ? l.productId : ''), variantId: str(isObj(l) ? l.variantId : ''), qty: Number(isObj(l) ? l.qty : 0) }))
}
function parseCountry(raw: unknown): Country {
  const c = str(raw).toUpperCase()
  if (!COUNTRIES.some((x) => x.code === c)) throw new OfficeError(422, 'bad_country', CHECKOUT_FIELDS.country)
  return c as Country
}
function parseAddress(raw: unknown): Draft['address'] {
  if (!isObj(raw)) throw new OfficeError(422, 'bad_address', 'address')
  const country = parseCountry(raw.country)
  const postcode = str(raw.postcode)
  if (!validPostcode(country, postcode)) throw new OfficeError(422, 'bad_postcode', CHECKOUT_FIELDS.postcode)
  const name = str(raw.name), line1 = str(raw.line1), city = str(raw.city), phone = str(raw.phone)
  if (!name) throw new OfficeError(422, 'bad_name', 'address.name')
  if (!line1) throw new OfficeError(422, 'bad_line1', 'address.line1')
  if (!city) throw new OfficeError(422, 'bad_city', 'address.city')
  if (!validPhone(phone)) throw new OfficeError(422, 'bad_phone', 'address.phone', 'the carrier needs a phone number for the parcel')
  return { name, line1, line2: str(raw.line2) || undefined, city, region: str(raw.region) || undefined, postcode, country, phone }
}
const parseMethod = (raw: unknown): 'standard' | 'express' => (raw === 'express' ? 'express' : 'standard')

/* One freight quote for the whole cart: the sum of each line's chosen lane, under the first line's logistic name. */
async function quoteFor(c: Ctx, lines: CartLine[], country: Country, postcode: string, method: 'standard' | 'express'): Promise<Quote> {
  const priced = priceLines(lines, c.catalogue)
  const rate = await getRate(c.kv, c.fetch, c.now())
  let usd = 0, days: [number, number] = [0, 0], logisticName = '', fellBack = false
  for (const l of priced) {
    const q = await c.cj.freight(l.vid, l.qty, country, postcode)
    if (!q) throw new OfficeError(422, 'no_freight', undefined, `cannot ship ${l.name} to ${country} yet`)
    const choice = chooseFreight(q, method)
    usd += choice.usd
    days = [Math.max(days[0], choice.days[0]), Math.max(days[1], choice.days[1])]
    logisticName ||= choice.logisticName
    fellBack ||= choice.fellBack
  }
  return buildQuote(priced, { logisticName, usd, days, fellBack }, rate.usdAud, country, method)
}

/* The shop's origin only (plus local dev hosts when DEV=1); the admin routes too, since the Orders tab lives on the shop's origin. */
function cors(c: Ctx, request: Request, res: Response): Response {
  const origin = request.headers.get('Origin')
  const site = new URL(c.env.SITE_URL).origin
  const allowed = [site, ...(c.env.DEV === '1' ? ['http://localhost:5173', 'http://127.0.0.1:4173', 'http://127.0.0.1:4174'] : [])]
  if (!origin || !allowed.includes(origin)) return res
  const h = new Headers(res.headers)
  h.set('Access-Control-Allow-Origin', origin)
  h.set('Access-Control-Allow-Headers', 'content-type, authorization')
  h.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  h.set('Vary', 'Origin')
  return new Response(res.body, { status: res.status, headers: h })
}

const ip = (r: Request) => r.headers.get('CF-Connecting-IP') ?? 'unknown'

async function readJson(request: Request): Promise<Record<string, unknown>> {
  try { const b = await request.json(); return isObj(b) ? b : {} } catch { throw new OfficeError(400, 'bad_json') }
}

async function handleFreight(c: Ctx, request: Request): Promise<Response> {
  const b = await readJson(request)
  const address = isObj(b.address) ? b.address : {}
  const country = parseCountry(address.country)
  const postcode = str(address.postcode)
  if (!validPostcode(country, postcode)) throw new OfficeError(422, 'bad_postcode', CHECKOUT_FIELDS.postcode)
  const q = await quoteFor(c, parseLines(b.lines), country, postcode, parseMethod(b.method))
  return json({ shipping: q.shipping, fellBack: q.shipping.fellBack, tax: q.tax, total: q.total })
}

async function handleCheckout(c: Ctx, request: Request): Promise<Response> {
  const b = await readJson(request)
  const email = str(b.email)
  if (!validEmail(email)) throw new OfficeError(422, 'bad_email', CHECKOUT_FIELDS.email)
  const address = parseAddress(b.address)
  const method = parseMethod(b.method)
  const quote = await quoteFor(c, parseLines(b.lines), address.country, address.postcode, method)
  const id = `d_${c.now().getTime().toString(36)}${Math.floor(c.random() * 1e9).toString(36)}`
  const draft: Draft = { id, email: normaliseEmail(email), address, quote, createdAt: c.now().toISOString() }
  await putJson(c.kv, `draft:${id}`, draft, { expirationTtl: 86_400 })
  const session = await createSession(c.fetch, c.env.STRIPE_SECRET_KEY, draft, c.env.SITE_URL, c.now())
  c.log(`checkout ${id}: session ${session.id}, ${quote.lines.length} line(s), total ${quote.total}`)
  return json({ url: session.url })
}

/* Both events Stripe sends for a paid session: cards complete at once, bank methods some time later. */
const PAID_EVENTS = ['checkout.session.completed', 'checkout.session.async_payment_succeeded']

/*
  Record first, fulfil after: the order and its session index are written before CJ is touched, and
  with a waitUntil the fulfilment runs after Stripe has its 200. The id comes from the session id, so a
  second delivery racing the first lands on the same record instead of a second order.
*/
async function handleWebhook(c: Ctx, request: Request, waitUntil?: (p: Promise<unknown>) => void): Promise<Response> {
  const raw = await request.text()
  const event = await verifyWebhook(raw, request.headers.get('Stripe-Signature'), c.env.STRIPE_WEBHOOK_SECRET, c.now())
  if (!PAID_EVENTS.includes(event.type)) return json({ received: true, ignored: event.type })
  const s = event.data.object
  if (s.payment_status !== 'paid') return json({ received: true, ignored: 'unpaid' })
  if (await c.store.bySession(s.id)) return json({ received: true, duplicate: true })
  const id = await c.store.newId(s.id)
  if ((await c.store.get(id))?.stripe.sessionId === s.id) return json({ received: true, duplicate: true })
  const draftId = s.metadata?.draftId ?? s.client_reference_id ?? ''
  const draft = draftId ? await getJson<Draft>(c.kv, `draft:${draftId}`) : null
  const at = c.now().toISOString()
  const stripe = { sessionId: s.id, paymentIntentId: s.payment_intent ?? null, paid: true, ...(draftId ? { draftId } : {}) }
  const history: OfficeOrder['history'] = [{ at, state: 'paid', note: `stripe ${s.id}` }]
  const total = Math.round(s.amount_total ?? 0) / 100
  /* Without the draft (KV not caught up, or it expired) the money is still recorded; fulfil() fills the rest in from the draft when it can be read. */
  const order: OfficeOrder = draft
    ? { id, createdAt: at, email: draft.email, address: draft.address, lines: draft.quote.lines, shipping: draft.quote.shipping, tax: draft.quote.tax, subtotal: draft.quote.subtotal, total: draft.quote.total, currency: 'AUD', stripe, state: 'paid', history }
    : { id, createdAt: at, email: normaliseEmail(s.customer_email ?? ''), address: { name: '', line1: '', city: '', postcode: '', country: 'AU' }, lines: [], shipping: { origin: 'CN', method: 'standard', logisticName: '', aud: 0, days: [0, 0], fellBack: false }, tax: { amount: 0, included: true, label: '' }, subtotal: total, total, currency: 'AUD', stripe, state: 'paid', history }
  await c.store.create(order)
  if (draft) await c.kv.delete(`draft:${draftId}`)
  c.log(`webhook: order ${id} from session ${s.id}${draft ? '' : ' (draft not readable yet)'}`)
  const run = fulfil(order, c.fulfilDeps).catch((e) => c.log(`${id}: fulfil threw ${e instanceof Error ? e.message : String(e)}`))
  if (waitUntil) waitUntil(run); else await run
  return json({ received: true, order: id })
}

async function handleOrder(c: Ctx, id: string, url: URL): Promise<Response> {
  const email = url.searchParams.get('email') ?? ''
  const o = email ? await c.store.byEmail(id, email) : null
  if (!o) throw new OfficeError(404, 'not_found')
  return json(o)
}

async function handleBySession(c: Ctx, sessionId: string): Promise<Response> {
  const o = await c.store.bySession(sessionId)
  return o ? json(o) : json({ pending: true }, 202)
}

export function createOffice(d: OfficeDeps) {
  const log = d.log ?? ((s: string) => console.log(s))
  const tokenStore: TokenStore = { get: () => d.kv.get('cj:token'), put: (t) => d.kv.put('cj:token', t, { expirationTtl: CJ_TOKEN_TTL_SEC }), clear: () => d.kv.delete('cj:token') }
  const cj = d.cj ?? createCjOffice({ apiKey: d.env.CJ_API_KEY, fetch: d.fetch, tokenStore })
  const mailer = d.mailer ?? createMailer({ fetch: d.fetch, apiKey: d.env.RESEND_API_KEY, from: d.env.FROM_EMAIL, enabled: d.env.EMAIL_ENABLED === '1', adminEmail: d.env.ADMIN_EMAIL, siteUrl: d.env.SITE_URL, log })
  const store = new OrderStore(d.kv, d.now, d.random)
  const c: Ctx = { kv: d.kv, env: d.env, fetch: d.fetch, now: d.now, random: d.random, cj, mailer, catalogue: d.catalogue ?? CATALOGUE, log, store, fulfilDeps: { cj, store, mailer, now: d.now, dryRun: d.env.CJ_DRY_RUN === '1', log, kv: d.kv } }

  const route = async (request: Request, waitUntil?: (p: Promise<unknown>) => void): Promise<Response> => {
    const url = new URL(request.url)
    const path = url.pathname.replace(/\/+$/, '') || '/'
    const m = request.method
    if (m === 'OPTIONS') return new Response(null, { status: 204 })
    if (path.startsWith('/admin/')) return adminRoutes(c, request, path)
    const guard = async (name: keyof typeof LIMITS) => { if (!(await limit(c.kv, name, ip(request), LIMITS[name], c.now()))) throw new OfficeError(429, 'rate_limited') }
    if (m === 'POST' && path === '/freight') { await guard('freight'); return handleFreight(c, request) }
    if (m === 'POST' && path === '/checkout') { await guard('checkout'); return handleCheckout(c, request) }
    if (m === 'POST' && path === '/stripe/webhook') return handleWebhook(c, request, waitUntil)
    if (m === 'POST' && path === '/notify') { await guard('notify'); return notifyRoute(c, request) }
    if (m === 'GET' && path.startsWith('/orders/by-session/')) { await guard('orders'); return handleBySession(c, decodeURIComponent(path.slice('/orders/by-session/'.length))) }
    if (m === 'GET' && path.startsWith('/orders/')) { await guard('orders'); return handleOrder(c, decodeURIComponent(path.slice('/orders/'.length)), url) }
    if (m === 'GET' && path === '/health') return json(await health(c))
    throw new OfficeError(404, 'not_found')
  }

  return {
    /* waitUntil is the Worker's ctx.waitUntil: work that may outlive the response (fulfilment after the webhook). */
    async fetch(request: Request, waitUntil?: (p: Promise<unknown>) => void): Promise<Response> {
      try {
        return cors(c, request, await route(request, waitUntil))
      } catch (e) {
        if (!(e instanceof OfficeError)) log(`error: ${e instanceof Error ? e.message : String(e)}`)
        return cors(c, request, toResponse(e))
      }
    },
    async scheduled(): Promise<void> {
      const result = await runCron(c.fulfilDeps)
      await putJson(c.kv, 'cron:last', { at: c.now().toISOString(), ...result })
      log(`cron: synced ${result.synced}, retried ${result.retried}, errors ${result.errors.length}`)
    },
  }
}

export { transition, type OrderState }
