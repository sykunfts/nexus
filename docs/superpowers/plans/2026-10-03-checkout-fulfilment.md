# Checkout and Fulfilment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Cloudflare Worker back office (`office/`) that prices a cart, sends the customer to Stripe Checkout, turns the paid session into an order, places and pays it with CJdropshipping, syncs shipping status, emails, and answers order lookups and a token-protected merchant view; plus the shop changes (sellable gating, real checkout, confirmation, policy pages, Orders tab) and the deploy workflow.

**Architecture:** The Worker is built as `createOffice(deps)` over injected dependencies (`kv`, `fetch`, `now`, `random`) so every handler runs in plain vitest with an in-memory KV; Stripe and CJ are called with hand-written `fetch` requests (no SDKs), verified against fixtures. The shop talks to it through `src/lib/office.ts` only when `VITE_OFFICE_URL` is set; otherwise the prototype path remains.

**Tech Stack:** TypeScript strict, Cloudflare Workers (`wrangler` 3, `@cloudflare/workers-types`), KV, cron triggers, Web Crypto (HMAC for Stripe signatures), vitest, React 18 shop, GitHub Actions (`cloudflare/wrangler-action`).

**Spec:** `docs/superpowers/specs/2026-10-03-checkout-fulfilment-design.md`

## Global Constraints

- Money in the Worker is AUD numbers with two decimals in records and integer cents in Stripe payloads (`Math.round(aud * 100)`). Shipping charged = CJ line USD × rate, rounded up to the next `.95`, minimum `4.95`. Rate: ECB via frankfurter, cached in KV key `rate:usd-aud` for 24 h, fallback `1.52`.
- Only `sellable` products (`!!product.supplier`) can be quoted or sold: `422 { error: 'not_sellable', field: 'lines[<i>]' }`.
- Quantities 1–10 per line; countries from `COUNTRIES`; postcodes via `validPostcode`; email via `validEmail`.
- Stripe: `POST https://api.stripe.com/v1/checkout/sessions`, form-encoded, `Authorization: Bearer <STRIPE_SECRET_KEY>`; `mode=payment`, every line `price_data[currency]=aud`; `success_url = SITE_URL + '#/orders/confirmed?session={CHECKOUT_SESSION_ID}'`, `cancel_url = SITE_URL + '#/checkout'`, `expires_at = now + 1800`. Webhook signature: `Stripe-Signature: t=<ts>,v1=<hex>` where `v1 = HMAC-SHA256(secret, `${ts}.${rawBody}`)`, tolerance 300 s, constant-time compare.
- CJ: base `https://developers.cjdropshipping.com/api2.0/v1`; `POST /shopping/order/createOrderV2`, `PATCH /shopping/order/confirmOrder`, `POST /shopping/pay/payBalance` (fallback `/shopping/payment/payBalance` on 404), `GET /shopping/order/getOrderDetail?orderId=`, `POST /logistic/freightCalculate`. `CJ_DRY_RUN='1'` skips `payBalance`.
- Order states: `paid → placed_with_supplier → shipped → delivered`; any state → `needs_attention`; `needs_attention → placed_with_supplier` (retry) or `refunded`; `paid → refunded`. Retry policy: once per 24 h, at most 3 attempts.
- KV keys: `order:<id>`, `draft:<draftId>` (TTL 86400), `session:<stripeSessionId>`, `open:<id>`, `email:<lowercased email>:<id>`, `notify:<productId>:<sha256(email)>`, `rate:usd-aud`, `rl:<route>:<ip>:<minute>` (TTL 60), `cron:last`.
- Rate limits per IP per minute: `/checkout` and `/freight` 20, `/notify` 5, `/orders/*` 60 → `429 { error: 'rate_limited' }`.
- CORS: `Access-Control-Allow-Origin` = `SITE_URL` origin exactly (plus `http://localhost:5173` when `DEV='1'`); admin routes send no CORS headers to other origins.
- Admin: `Authorization: Bearer <ADMIN_TOKEN>`, compared with a constant-time function; `401 { error: 'unauthorised' }` otherwise.
- Logs never include email, name, address or phone.
- Copy fixed by the spec: Pay button "Pay with Stripe"; note "Charged in AUD. Card, Apple Pay and Google Pay on Stripe's secure page."; not-stocked button "Not yet stocked, tell me when"; returns wording "30-day change-of-mind returns on Australian stock; consumer guarantees on everything".
- Every new module has a test that failed first; `npm test`, `npm run typecheck`, `npm run build`, `npm run office:check` green before each commit.

## Review Focus

1. Stripe delivers `checkout.session.completed` twice (or Nick replays it from the dashboard): exactly one order exists and CJ is called once (Task 7 test `a duplicate webhook delivery is a no-op`).
2. The draft is gone when the webhook arrives (expired, or the Worker was redeployed with a new KV): the money is still recorded as an order in `needs_attention` with reason `draft_missing`, built from the session's line items (Task 7 test `a webhook without its draft still records the order`).
3. The customer typed `  Nick@Example.COM `: the order confirmation page and `GET /orders/:id?email=` still find the order (Task 5 test `email lookup is case- and space-insensitive`).
4. The customer chose express and CJ returns only one line: the quote falls back to the standard line and says so, never a crash or a silent upgrade charge (Task 2 test `express falls back to the cheapest line when no faster line exists`).
5. A listing is removed between adding to cart and paying: `/checkout` answers `422 not_sellable` naming the line, and the shop points at it instead of showing a blank error (Task 2 test `refuses a line that is not sellable`, Task 9 test `a not_sellable answer highlights the line`).

---

### Task 1: Office scaffold, KV fake and the generated catalogue

**Files:**
- Create: `office/wrangler.toml`, `office/tsconfig.json`, `office/src/env.ts`, `office/src/kv.ts`, `office/test/kv.test.ts`, `scripts/merge-office.mjs`, `office/src/catalogue.generated.ts` (generated, committed), `office/test/catalogue.test.ts`
- Modify: `package.json` (devDependencies `wrangler@^3.90`, `@cloudflare/workers-types@^4`; scripts `office:merge`, `office:test` = `vitest run office`, `office:check` = `wrangler deploy --dry-run --outdir .wrangler/dry --config office/wrangler.toml`, `office:deploy`), `vitest.config.ts` (include `office/test/**/*.test.ts`), `tsconfig.json` (include `office/src`, `office/test`; types add `@cloudflare/workers-types`), `.gitignore` (`.wrangler`, `office/.dev.vars`)

**Interfaces:**
- `office/src/env.ts`:

```ts
export interface Env {
  ORDERS: KVNamespace
  SITE_URL: string; FROM_EMAIL: string; EMAIL_ENABLED: string; ADMIN_EMAIL: string; CJ_DRY_RUN: string; DEV?: string
  STRIPE_SECRET_KEY: string; STRIPE_WEBHOOK_SECRET: string; CJ_API_KEY: string; RESEND_API_KEY: string; ADMIN_TOKEN: string
}
```
- `office/src/kv.ts`: `export interface KV { get(key: string): Promise<string | null>; put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>; delete(key: string): Promise<void>; list(opts: { prefix: string; limit?: number; cursor?: string }): Promise<{ keys: { name: string }[]; list_complete: boolean; cursor?: string }> }` (a subset of `KVNamespace`, so the binding satisfies it); `export class MemoryKV implements KV` with a `now: () => number` option so TTL expiry is testable; helpers `getJson<T>(kv, key)`, `putJson(kv, key, value, opts?)`.
- `scripts/merge-office.mjs`: runs `tsx` over `src/lib/data.ts` and writes `office/src/catalogue.generated.ts`: `export interface CatalogueProduct { id: string; name: string; brand: string; category: string; price: number; variants: { id: string; label: string; delta: number }[]; fulfil: { route: 'warehouse' | 'supplier'; origin: string }; supplier?: { url: string; pid: string; vid: string; costUsd: number; termId: string }; sellable: boolean }` and `export const CATALOGUE: CatalogueProduct[]`, `export const CATALOGUE_GENERATED_AT: string`.
- `office/wrangler.toml`: `name = "nexus-office"`, `main = "src/index.ts"`, `compatibility_date = "2026-09-01"`, `compatibility_flags = ["nodejs_compat"]`, `[[kv_namespaces]] binding = "ORDERS" id = "KV_NAMESPACE_ID_PLACEHOLDER"`, `[triggers] crons = ["0 */2 * * *"]`, `[vars] SITE_URL = "https://sykunfts.github.io/nexus/" FROM_EMAIL = "orders@example.com" EMAIL_ENABLED = "0" ADMIN_EMAIL = "" CJ_DRY_RUN = "1"`.

- [ ] **Step 1: Write failing tests** `kv.test.ts`: `MemoryKV round-trips, lists by prefix in order, expires with TTL` (put with `expirationTtl: 60`, advance `now` by 61 s → `get` null); `getJson returns null for missing and parses stored`. `catalogue.test.ts`: `the generated catalogue marks only products with a supplier as sellable` (every `cj-` id sellable, no branded product sellable; variants carry deltas; `CATALOGUE.length === products.length` from `src/lib/data`).
- [ ] **Step 2: Run** `npx vitest run office/test` — Expected: FAIL (modules missing / include pattern)
- [ ] **Step 3: Create the files; run `npm run office:merge`** (generates the module; with no listings merged every `sellable` is false and the test still passes on the branded rule); `npm install`.
- [ ] **Step 4: Run** `npx vitest run office/test && npm run typecheck` — Expected: PASS
- [ ] **Step 5: Commit** `office: scaffold, kv fake, generated catalogue`

### Task 2: Pricing and quotes

**Files:**
- Create: `office/src/errors.ts`, `office/src/pricing.ts`, `office/test/pricing.test.ts`

**Interfaces:**
- `errors.ts`: `export class OfficeError extends Error { constructor(public status: number, public code: string, public field?: string) }`; `toResponse(e): Response` (JSON `{ error: code, field? }`).
- `pricing.ts`:

```ts
export interface CartLine { productId: string; variantId: string; qty: number }
export interface PricedLine { productId: string; variantId: string; name: string; qty: number; unitPrice: number; vid: string; origin: string }
export function priceLines(lines: CartLine[], catalogue: CatalogueProduct[]): PricedLine[]      // throws OfficeError 422 not_sellable / unknown_product / unknown_variant / bad_qty with field `lines[i]`
export function shippingAud(freightUsd: number, rate: number): number                           // ceil to .95, min 4.95
export interface FreightChoice { logisticName: string; usd: number; days: [number, number]; fellBack: boolean }
export function chooseFreight(quote: FreightQuote, method: 'standard' | 'express'): FreightChoice   // express = fastest when its days[1] < cheapest.days[1], else cheapest with fellBack true
export interface Quote { lines: PricedLine[]; subtotal: number; shipping: { origin: 'CN'; method: 'standard' | 'express'; logisticName: string; aud: number; days: [number, number]; fellBack: boolean }; tax: { amount: number; included: boolean; label: string }; total: number }
export function buildQuote(lines: PricedLine[], choice: FreightChoice, rate: number, country: Country, method: 'standard' | 'express'): Quote   // tax via taxFor(country, subtotal + shipping); total = subtotal + shipping + (included ? 0 : tax)
```
`FreightQuote` is `radar/src/types`' type; `taxFor` and `Country` from `src/lib/shipping`.

- [ ] **Step 1: Write failing tests**: `prices lines from the catalogue with variant deltas` (a fixture catalogue with one sellable product, price 95.95, variant delta 10 → unitPrice 105.95); `refuses a line that is not sellable` (OfficeError 422 `not_sellable`, field `lines[0]`); `refuses unknown product, unknown variant and qty 0 or 11`; `shippingAud rounds up to .95 with a 4.95 floor` (6.1 × 1.515 = 9.24 → 9.95; 1 × 1.5 → 4.95; 9.95 stays 9.95); `express falls back to the cheapest line when no faster line exists` (quote whose fastest equals cheapest → `fellBack true`, logisticName = cheapest); `buildQuote adds tax for GB and includes it for AU` (AU: included true, total = subtotal + shipping; GB: included false, total adds 20 %).
- [ ] **Step 2: Run** `npx vitest run office/test/pricing.test.ts` — Expected: FAIL
- [ ] **Step 3: Implement**
- [ ] **Step 4: Run** — Expected: PASS
- [ ] **Step 5: Commit** `office: pricing, freight choice and quotes`

### Task 3: CJ and rate clients for the office

**Files:**
- Create: `office/src/cj.ts`, `office/src/rate.ts`, `office/test/fixtures/cj-create.json`, `office/test/fixtures/cj-detail.json`, `office/test/cj.test.ts`

**Interfaces:**
- Consumes `createCjClient`, `CjError` from `radar/src/cj/client.ts`; `parseFreight` from `radar/src/cj/parse.ts`; `createHttp` from `radar/src/fetch.ts` (with `fetch` injected; the Worker passes `globalThis.fetch`).
- `cj.ts`:

```ts
export interface OrderForCj { id: string; email: string; address: { name: string; line1: string; line2?: string; city: string; region?: string; postcode: string; country: Country; phone?: string }; lines: { vid: string; qty: number }[]; shipping: { logisticName: string } }   // OfficeOrder (Task 5) satisfies this structurally
export interface CjOffice {
  freight(vid: string, qty: number, country: Country, zip: string): Promise<FreightQuote | null>
  createOrder(o: OrderForCj): Promise<string>                  // cjOrderId; body per spec, shippingProvince = region || city, shippingCountry = countryInfo(country).name
  confirmOrder(cjOrderId: string): Promise<void>
  payBalance(cjOrderId: string): Promise<void>                 // tries /shopping/pay/payBalance then /shopping/payment/payBalance on a 404-class CjError
  orderDetail(cjOrderId: string): Promise<{ status: string; trackNumber?: string; logisticName?: string }>
}
export function createCjOffice(o: { apiKey: string; fetch: typeof fetch; sleep?: (ms: number) => Promise<void> }): CjOffice
```
`OrderForCj` is the minimal shape this client needs; Task 5's `OfficeOrder` satisfies it.
- `rate.ts`: `getRate(kv: KV, fetchImpl: typeof fetch, now: Date): Promise<Rate>` (KV cache `rate:usd-aud` 24 h; `fetchRate` logic from `radar/src/money.ts` with `previous` = the cached value).

- [ ] **Step 1: Write failing tests**: `createOrder sends the documented fields` (capture the request body: `orderNumber`, `shippingCustomerName`, `shippingCountryCode 'AU'`, `shippingCountry 'Australia'`, `shippingProvince 'NSW'`, `fromCountryCode 'CN'`, `logisticName`, `products[0].vid`, `products[0].quantity`; province falls back to the city for `GB` with empty region); `createOrder reads the id from data or data.orderId`; `payBalance falls back to the second path on 404`; `orderDetail maps the fixture` (status `SHIPPED`, `trackNumber`); `freight returns null on an empty list`; `getRate caches for 24 h and falls back` (two calls → one fetch; fetch failing with a cached value → `previous`; nothing cached → 1.52 `fallback`).
- [ ] **Step 2: Run** — Expected: FAIL
- [ ] **Step 3: Implement; fixtures in CJ's envelope shape** (`{ result: true, code: 200, data: "CJ-ORDER-1" }` for create; detail `{ result: true, data: { orderId, orderStatus: 'SHIPPED', trackNumber: 'CJPK123', logisticName: 'CJPacket Ordinary' } }`).
- [ ] **Step 4: Run** — Expected: PASS
- [ ] **Step 5: Commit** `office: cj order and freight client, cached rate`

### Task 4: Stripe sessions and webhook signatures

**Files:**
- Create: `office/src/stripe.ts`, `office/test/stripe.test.ts`

**Interfaces:**

```ts
export interface Draft { id: string; email: string; address: AddressInput & { country: Country }; quote: Quote; createdAt: string }
export function sessionParams(draft: Draft, siteUrl: string, nowSec: number): URLSearchParams   // the exact form body; line_items[i][price_data][currency]=aud, unit_amount in cents, product_data[name], quantity; shipping line "Shipping: <logisticName>"; tax line when !included; customer_email; client_reference_id; metadata[draftId]; success_url/cancel_url/expires_at per Global Constraints
export async function createSession(fetchImpl: typeof fetch, secretKey: string, draft: Draft, siteUrl: string, now: Date): Promise<{ id: string; url: string }>   // throws OfficeError 502 stripe_unavailable on !ok
export async function verifyWebhook(rawBody: string, signatureHeader: string | null, secret: string, now: Date): Promise<StripeEvent>   // throws OfficeError 400 bad_signature; tolerance 300 s
export interface StripeEvent { id: string; type: string; data: { object: { id: string; payment_status?: string; payment_intent?: string; client_reference_id?: string; customer_email?: string; metadata?: Record<string, string>; amount_total?: number } } }
export function sign(rawBody: string, secret: string, ts: number): Promise<string>   // test helper, exported: HMAC hex
```

- [ ] **Step 1: Write failing tests**: `sessionParams encodes lines, shipping and tax in cents` (AU draft: no tax line, `line_items[0][price_data][unit_amount]=9595`; GB draft: a tax line); `sessionParams carries the draft id and the return addresses`; `createSession returns id and url, 502 on failure`; `verifyWebhook accepts a valid signature and rejects a tampered body and a stale timestamp` (sign with `sign()`; tamper one byte; ts = now − 301).
- [ ] **Step 2: Run** — Expected: FAIL
- [ ] **Step 3: Implement with `crypto.subtle` (HMAC SHA-256) and a constant-time hex compare**
- [ ] **Step 4: Run** — Expected: PASS
- [ ] **Step 5: Commit** `office: stripe checkout sessions and webhook verification`

### Task 5: Order records, state machine and store

**Files:**
- Create: `office/src/orders.ts`, `office/test/orders.test.ts`

**Interfaces:**

```ts
export type OrderState = 'paid' | 'placed_with_supplier' | 'shipped' | 'delivered' | 'needs_attention' | 'refunded'
export interface OfficeOrder { id: string; createdAt: string; email: string; address: Draft['address']; lines: PricedLine[]; shipping: Quote['shipping']; tax: Quote['tax']; subtotal: number; total: number; currency: 'AUD'; stripe: { sessionId: string; paymentIntentId: string | null; paid: boolean }; state: OrderState; supplier?: { cjOrderId: string; cjStatus?: string; trackNumber?: string; logisticName?: string; placedAt: string; paidAt?: string; dryRun?: boolean }; attention?: { reason: string; at: string; lastError: string; attempts: number; nextRetryAt: string }; history: { at: string; state: OrderState; note?: string }[] }
export function transition(o: OfficeOrder, to: OrderState, at: string, note?: string): OfficeOrder   // throws OfficeError 409 bad_transition when not allowed
export class OrderStore {
  constructor(kv: KV, now: () => Date, random: () => number)
  newId(): Promise<string>                                   // NX- + 6 digits, retried until unused
  create(o: OfficeOrder): Promise<void>                      // writes order:, session:, email:, open:
  save(o: OfficeOrder): Promise<void>                        // order: and open: (removed when delivered/refunded)
  get(id: string): Promise<OfficeOrder | null>
  bySession(sessionId: string): Promise<OfficeOrder | null>
  byEmail(id: string, email: string): Promise<OfficeOrder | null>   // email normalised: trim + lowercase
  listOpen(): Promise<OfficeOrder[]>
  list(state?: OrderState, limit?: number): Promise<OfficeOrder[]>  // newest first
}
export const normaliseEmail = (e: string) => e.trim().toLowerCase()
```

- [ ] **Step 1: Write failing tests**: `allowed transitions only` (paid→placed ok; delivered→paid throws 409; needs_attention→placed ok; paid→refunded ok); `newId is unique against the store`; `create writes the indexes and bySession finds it`; `email lookup is case- and space-insensitive` (`'  Nick@Example.COM '`); `listOpen drops delivered and refunded`; `list is newest first and filters by state`.
- [ ] **Step 2: Run** — Expected: FAIL
- [ ] **Step 3: Implement**
- [ ] **Step 4: Run** — Expected: PASS
- [ ] **Step 5: Commit** `office: order records, state machine and store`

### Task 6: Fulfilment, status sync and email

**Files:**
- Create: `office/src/email.ts`, `office/src/fulfil.ts`, `office/test/email.test.ts`, `office/test/fulfil.test.ts`

**Interfaces:**
- `email.ts`: `interface Mailer { confirmation(o: OfficeOrder): Promise<void>; shipped(o: OfficeOrder): Promise<void>; attention(o: OfficeOrder): Promise<void> }`; `createMailer(o: { fetch: typeof fetch; apiKey: string; from: string; enabled: boolean; adminEmail: string; siteUrl: string; log: (s: string) => void }): Mailer` — `POST https://api.resend.com/emails` `{ from, to, subject, html, text }`; customer mails skipped (logged) when `!enabled`; `attention` sent whenever `adminEmail && apiKey`; never throws. Exported pure `templates.confirmation(o, siteUrl)`, `templates.shipped(o)`, `templates.attention(o, siteUrl)` → `{ subject, text, html }`; tracking link `https://t.17track.net/en#nums=<trackNumber>`.
- `fulfil.ts`:

```ts
export interface FulfilDeps { cj: CjOffice; store: OrderStore; mailer: Mailer; now: () => Date; dryRun: boolean; log: (s: string) => void }
export const MAX_ATTEMPTS = 3; export const RETRY_AFTER_MS = 86_400_000
export async function fulfil(o: OfficeOrder, d: FulfilDeps): Promise<OfficeOrder>    // create → confirm → (pay unless dryRun) → placed_with_supplier + confirmation mail; any throw → needs_attention {reason: 'cj_create_failed' | 'cj_confirm_failed' | 'cj_pay_failed', lastError, attempts+1, nextRetryAt} + attention mail; never throws
export async function sync(o: OfficeOrder, d: FulfilDeps): Promise<OfficeOrder>      // orderDetail → SHIPPED+trackNumber → shipped (+ mail); DELIVERED → delivered; CANCELLED → needs_attention 'cj_cancelled'
export async function runCron(d: FulfilDeps): Promise<{ synced: number; retried: number; errors: string[] }>   // listOpen: sync those with cjOrderId; retry fulfil for needs_attention without cjOrderId when now ≥ nextRetryAt and attempts < MAX_ATTEMPTS; one order's failure never stops the batch; writes cron:last
```

- [ ] **Step 1: Write failing tests** (`email.test.ts`): `templates carry the order id, totals and tracking link`; `disabled mode skips customer mail and still sends attention`; `a failed send resolves without throwing`. (`fulfil.test.ts`, with a fake `CjOffice` whose methods can be made to throw): `happy path places, confirms, pays and mails`; `dry run skips payBalance and marks supplier.dryRun`; `each failing step → needs_attention with its reason` (three cases, attention mail sent, attempts 1, nextRetryAt = now + 24 h); `sync moves to shipped with tracking and mails once`; `cron retries a failed order after 24 h and gives up after 3 attempts`; `cron isolates one failure`.
- [ ] **Step 2: Run** — Expected: FAIL
- [ ] **Step 3: Implement**
- [ ] **Step 4: Run** — Expected: PASS
- [ ] **Step 5: Commit** `office: fulfilment, status sync, emails`

### Task 7: Handlers: router, CORS, rate limits, notify, admin, health

**Files:**
- Create: `office/src/index.ts`, `office/src/office.ts` (`createOffice`), `office/src/notify.ts`, `office/src/admin.ts`, `office/src/ratelimit.ts`, `office/test/handlers.test.ts`

**Interfaces:**
- `office.ts`:

```ts
export interface OfficeDeps { kv: KV; env: Omit<Env, 'ORDERS'>; fetch: typeof fetch; now: () => Date; random: () => number; cj?: CjOffice; mailer?: Mailer }
export function createOffice(d: OfficeDeps): { fetch(request: Request): Promise<Response>; scheduled(): Promise<void> }
```
Routes (all JSON; `OPTIONS` answered with CORS): `POST /freight` `{ lines, address: { country, postcode }, method }` → `{ shipping, fellBack }`; `POST /checkout` (body per spec) → validates, prices, freight per CJ line (sum of lines' freight when more than one line, one logistic name), `getRate`, `buildQuote`, writes `draft:<id>` (TTL 86400), `createSession` → `{ url }`; `POST /stripe/webhook` → `verifyWebhook`, on `checkout.session.completed` + `payment_status === 'paid'`: `bySession` exists → 200; draft present → `store.create` + `fulfil`; draft missing → order from session metadata/amount with `needs_attention 'draft_missing'`; always 200 after storing; `GET /orders/:id?email=` → order or 404; `GET /orders/by-session/:sid` → order or `202 { pending: true }`; `POST /notify` → `{ productId, email }` validated, `notify:<pid>:<sha256(email)>` = `{ email, at }`; `GET /health` → `{ ok, kv, stripeMode: 'test' | 'live' | 'missing', cjAuth: boolean (one auth call, cached 1 h in KV), emailEnabled, cronLast }`; admin per spec under `/admin/*` with the token.
- `index.ts`: `export default { fetch(request, env, ctx) { return createOffice({ kv: env.ORDERS, env, fetch: globalThis.fetch, now: () => new Date(), random: Math.random }).fetch(request) }, scheduled(_, env) { … .scheduled() } }`.
- `ratelimit.ts`: `limit(kv, route, ip, perMinute, now): Promise<boolean>`.
- `admin.ts`: `constantTimeEqual(a: string, b: string): boolean`.

- [ ] **Step 1: Write failing tests** with `MemoryKV`, a fake `fetch` routed by host (api.stripe.com → session json / 200 for nothing else), fake `cj` and `mailer`: `OPTIONS and responses carry CORS for the site origin only`; `/checkout prices from the catalogue, writes a draft and returns the Stripe url`; `/checkout refuses a bad email, a bad postcode and qty 11 with the field named`; `a duplicate webhook delivery is a no-op` (same event twice → one order, `cj.createOrder` called once); `a webhook without its draft still records the order` (needs_attention `draft_missing`); `a tampered webhook is 400`; `/orders/:id needs the right email` (wrong email → 404); `/orders/by-session pending until the webhook lands`; `/notify stores once per email`; `rate limit returns 429 on the 21st call`; `admin without the token is 401, with it lists orders and retries one`; `/health reports stripe mode and cron`.
- [ ] **Step 2: Run** `npx vitest run office/test/handlers.test.ts` — Expected: FAIL
- [ ] **Step 3: Implement**; then `npm run office:check` — Expected: wrangler bundles `src/index.ts` without error (dry run, no account needed)
- [ ] **Step 4: Run** `npm run office:test && npm run typecheck` — Expected: PASS
- [ ] **Step 5: Commit** `office: handlers, webhook, notify, admin, health`

### Task 8: Shop client and sellable gating

**Files:**
- Create: `src/lib/office.ts`, `src/components/NotifyMe.tsx`
- Modify: `src/lib/data.ts` (`export const sellable = (p: Product) => !!p.supplier`), `src/components/ProductPage.tsx`, `src/components/QuickView.tsx`, `src/components/ProductCard.tsx`, `src/components/Advisor.tsx` (kits only from sellable products when the office is enabled), `src/app.test.tsx`

**Interfaces:**
- `office.ts`:

```ts
export const office = { enabled: !!import.meta.env.VITE_OFFICE_URL, url: import.meta.env.VITE_OFFICE_URL ?? '' }
export async function quoteFreight(body): Promise<{ shipping: Quote['shipping']; fellBack: boolean }>
export async function startCheckout(body): Promise<{ url: string }>          // throws OfficeClientError { code, field?, status }
export async function fetchOrder(id: string, email: string): Promise<OfficeOrder | null>
export async function fetchOrderBySession(sessionId: string): Promise<OfficeOrder | null>   // null while pending
export async function notifyMe(productId: string, email: string): Promise<void>
export const admin = { token(): string | null; setToken(t: string): void; get<T>(path: string): Promise<T>; post<T>(path: string, body?: unknown): Promise<T> }
export function toShopOrder(o: OfficeOrder): Order                           // adapter for ConfirmedPage/OrderPage; sets order.office = { state, cjOrderId?, trackNumber?, logisticName?, attention? }
```
All calls: 10 s `AbortController` timeout; non-2xx → `OfficeClientError`.
- `data.ts`: `Order` (in `orders.ts`) gains `office?: { state: OrderState; cjOrderId?: string; trackNumber?: string; logisticName?: string; attention?: string }`.
- Gating rule: `canBuy(p) = !office.enabled || sellable(p)`; when `!canBuy`, `ProductPage`/`QuickView`/`ProductCard` render `<NotifyMe productId />` (email input + button "Not yet stocked, tell me when"; on success toast "We'll email you when it's stocked."), no Add to cart; the sticky mobile bar follows the same rule.

- [ ] **Step 1: Write failing tests** (`app.test.tsx`, with `vi.stubEnv('VITE_OFFICE_URL', 'https://office.test')` and a stubbed `fetch`): `a branded product shows "Not yet stocked, tell me when" and no Add to cart when the office is enabled`; `a CJ listing shows Add to cart` (seed `LISTINGS` via `vi.doMock('./lib/data.listings', …)` with one listing carrying `supplier`); `notify posts the product id and email`; `without VITE_OFFICE_URL every product is addable` (prototype).
- [ ] **Step 2: Run** — Expected: FAIL
- [ ] **Step 3: Implement**
- [ ] **Step 4: Run** `npm test && npm run typecheck && npm run build` — Expected: PASS
- [ ] **Step 5: Commit** `shop: office client, sellable gating, tell-me-when`

### Task 9: Real checkout, confirmation and order pages

**Files:**
- Modify: `src/pages/CheckoutPage.tsx` (remove the card section and `validateCard` use; shipping step calls `quoteFreight` when `office.enabled`, shows loading / the quote / "cannot ship there yet" / "estimate, final freight confirmed at payment" on failure; review step: "Pay with Stripe" + note + policy links → `startCheckout` → `location.href = url`; `not_sellable` → the line is highlighted with "No longer available"; prototype path unchanged when `!office.enabled`), `src/lib/routes.ts` (`{ name: 'confirmed-session'; sessionId: string }` ↔ `#/orders/confirmed?session=`), `src/App.tsx`, `src/pages/ConfirmedPage.tsx` (polls `fetchOrderBySession` every 2 s up to 60 s, then the "receipt is your proof" message; renders `toShopOrder`), `src/pages/OrdersPage.tsx` (`OrderPage` asks for the email when the order is not local and `office.enabled`; shows `order.office.state`, tracking link, attention note), `src/lib/validate.ts` (keep `validateCard` for the prototype path; nothing removed), `src/app.test.tsx`, `src/lib/routes.test.ts`, `shot.py`

- [ ] **Step 1: Write failing tests**: routes `#/orders/confirmed?session=cs_1 round-trips`; app: `checkout shows the live quote and Pay with Stripe when the office is enabled` (stub `/freight`); `Pay with Stripe posts the cart and redirects` (stub `/checkout` → url; assert `location.href` assignment via a spied `assign`); `a not_sellable answer highlights the line`; `the confirmation page polls by session then shows the order`; `the order page asks for the email when the order is remote`.
- [ ] **Step 2: Run** — Expected: FAIL
- [ ] **Step 3: Implement**; add `shot.py` scenarios `checkout-pay` (page.route mocks `/freight` and `/checkout`), `confirmed-remote` (mock `/orders/by-session/*`), with `VITE_OFFICE_URL` baked by building once with the env for the scenarios (`OFFICE_SHOTS=1` builds into `dist-office/` served on port 4174).
- [ ] **Step 4: Run** `npm test && npm run typecheck && npm run build && python3 shot.py` — Expected: PASS, exit 0
- [ ] **Step 5: Commit** `shop: stripe checkout, remote confirmation and order pages`

### Task 10: Policy pages and copy

**Files:**
- Create: `src/content/policies/terms.tsx`, `privacy.tsx`, `shipping-returns.tsx`, `contact.tsx`, `src/content/policies/index.ts` (`POLICIES: { slug, title, updated, Component }[]`, `BUSINESS = { name: 'Nexus Technologies Pty Ltd (placeholder until registered)', abn: '', contactEmail: 'hello@example.com (placeholder until the domain exists)', state: 'NSW' }`), `src/pages/PoliciesPage.tsx`
- Modify: `src/lib/routes.ts` (`{ name: 'policy'; slug: string }` ↔ `#/policies/<slug>`), `src/App.tsx`, `src/lib/collections.ts` (`FOOTER` gains "Policies": Terms, Privacy, Shipping & Returns, Contact), `src/components/Home.tsx`, `src/components/CartDrawer.tsx`, `src/App.tsx` footer line (returns wording per Global Constraints), `src/pages/CheckoutPage.tsx` (agreement line under Pay), `src/lib/routes.test.ts`, `src/lib/collections.test.ts`, `src/app.test.tsx`

Content rules (the text itself is the implementer's, in the shop's plain voice, each page dated and headed with "Draft, pending professional review"): Terms (seller, AUD incl. GST, acceptance on Stripe confirmation, delivery windows are estimates, ACL guarantees not excluded, NSW law); Privacy (data collected, where held: Cloudflare KV, Stripe, CJdropshipping; browser storage; no advertising cookies; deletion by email; 7-year retention of tax records); Shipping & Returns (routes and windows from `shipping.ts` ETA table rendered live; the returns rule exactly as decided; ACL claim steps; who pays postage); Contact (`BUSINESS.contactEmail`, ABN line when set).

- [ ] **Step 1: Write failing tests**: routes round-trip `#/policies/terms`; `every FOOTER policy link resolves`; app: `each policy page renders its heading and the draft notice`; `the shipping-and-returns page lists every origin's delivery window`; `the footer no longer says "30-day returns on both routes"`; `checkout's Pay button carries the agreement line with links`.
- [ ] **Step 2: Run** — Expected: FAIL
- [ ] **Step 3: Implement**
- [ ] **Step 4: Run** `npm test && npm run build && python3 shot.py` (add `policy-shipping` desktop + mobile scenarios) — Expected: PASS
- [ ] **Step 5: Commit** `shop: policy pages and returns wording`

### Task 11: Merchant view on the Radar page

**Files:**
- Create: `src/radar/components/OrdersTab.tsx`, `src/radar/orders.test.tsx`
- Modify: `src/radar/RadarApp.tsx` (tabs "Radar" | "Orders" from `location.hash === '#orders'`; the Orders tab asks for the token when `admin.token()` is null, keeps it, then renders), `src/radar/components/RadarHeader.tsx` (tab links)

**Interfaces:** `OrdersTab` reads `admin.get('/admin/health')`, `admin.get('/admin/orders')`, `admin.get('/admin/notify')`; needs-attention orders first with `Retry` (`admin.post('/admin/orders/:id/retry')`) and `Mark refunded` (`…/refunded`, with a one-line note prompt); state chips use the shop's pass/check/fail tones; tracking links to 17track; health strip at the top (Stripe mode, CJ auth, email, last cron). Without `office.enabled` the tab says the office is not configured and links to the README section.

- [ ] **Step 1: Write failing tests** (jsdom, stubbed `fetch`): `asks for the token, then lists orders newest first with needs-attention first`; `Retry posts to the retry endpoint and refreshes`; `the health strip shows test mode and the last cron`; `without the office configured the tab explains`.
- [ ] **Step 2: Run** — Expected: FAIL
- [ ] **Step 3: Implement**
- [ ] **Step 4: Run** `npm test && npm run build && python3 shot.py` (add `radar-orders` scenario with mocked admin routes) — Expected: PASS
- [ ] **Step 5: Commit** `radar: orders tab (merchant view)`

### Task 12: Deploy workflow, configuration, README

**Files:**
- Create: `.github/workflows/office.yml`
- Modify: `.github/workflows/pages.yml` (build step `env: VITE_OFFICE_URL: ${{ vars.OFFICE_URL }}`), `office/wrangler.toml` (placeholder id), `README.md` (Build 5 section: what it does, the setup checklist from the spec verbatim, going live), `docs/superpowers/specs/2026-10-03-checkout-fulfilment-design.md` (any address or name that changed), `radar/test/workflows.test.ts`, `package.json` description

**Interfaces:** `office.yml`: `on: push: branches [main] paths: [office/**, src/lib/data.ts, src/lib/data.expansion.ts, src/lib/data.listings.ts, src/lib/shipping.ts, src/lib/orders.ts, src/lib/validate.ts, scripts/merge-office.mjs, radar/src/**]`, `workflow_run: workflows: ['Add a Radar listing'] types: [completed]`, `workflow_dispatch`; job: checkout `main`, setup-node 22, `npm ci`, `npm run merge`, `npm run office:merge`, `npm run office:test`, `sed -i "s/KV_NAMESPACE_ID_PLACEHOLDER/${{ vars.KV_NAMESPACE_ID }}/" office/wrangler.toml`, `cloudflare/wrangler-action@v3` with `apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}`, `accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}`, `workingDirectory: office`, `command: deploy`, `secrets: |` the five Worker secrets, `env:` those secrets from `${{ secrets.* }}`; a final step prints the Worker URL from the action output as the value to put in `OFFICE_URL`.

- [ ] **Step 1: Write failing tests** (`workflows.test.ts`): `office.yml deploys on main pushes to office paths, after a listing, and by hand`; `office.yml passes the five secrets and the KV id`; `pages.yml passes VITE_OFFICE_URL from vars`; `every npm script the workflows call exists`.
- [ ] **Step 2: Run** — Expected: FAIL
- [ ] **Step 3: Write the workflow, config and README section**
- [ ] **Step 4: Run** `npm test` — Expected: PASS
- [ ] **Step 5: Commit** `office: deploy workflow, pages env, readme`

### Task 13: Screenshots, bundle, artifact

**Files:**
- Modify: `shot.py` (confirm the Build 5 scenarios from Tasks 9–11 run in one pass with the office-enabled build), `scripts/bundle.sh` (exclude `.wrangler`, `office/.dev.vars`)

- [ ] **Step 1: Run** `npm run build && python3 shot.py` — Expected: exit 0, no horizontal scroll, crawl 0 dead (policy pages add links)
- [ ] **Step 2: Look at** `shots/checkout-pay.png`, `shots/confirmed-remote.png`, `shots/policy-shipping.png`, `shots/radar-orders.png` with the Read tool; fix layout faults; re-run
- [ ] **Step 3: Run** `FRAGMENT=1 npm run build && node scripts/fragment.mjs` (prototype mode: no `VITE_OFFICE_URL`) — Expected: fragment still 1 style, 1 script
- [ ] **Step 4: Run** `scripts/bundle.sh /mnt/user-data/outputs/nexus-repo.zip` — Expected: no `.env`, no `.dev.vars`
- [ ] **Step 5: Commit** `build 5: screenshots and bundle`
