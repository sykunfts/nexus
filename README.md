# NEXUS — trend-tech storefront and Trend Radar

Test Bench design system (v3: oversized display type, product-of-the-week on a bench slab, big mono numerals, one bento and one ledger on the home page), a real 64-product catalogue sold worldwide, and every page working on it:
collections with filters, search, compare, an editable My setup that every works-with check reads,
six guides with live elements, account, orders, international checkout and confirmation. Static page,
browser-persisted state, no payment taken until the back office below is configured.

The **Trend Radar** (`radar.html`) is the merchant tool: a daily GitHub Action reads public trend
signals, matches rising terms to CJdropshipping stock, prices each candidate to Australia (landed
cost, suggested retail with GST, margin), flags compliance points, and ranks them. "Add to shop"
opens a prefilled GitHub issue; the listing job turns it into a draft product and the site rebuilds.
The shop's trend badges come from the same signals once the Radar has run.

Live: shop at `https://sykunfts.github.io/nexus/`, Radar at `https://sykunfts.github.io/nexus/radar.html`
(add `?demo=1` to see the layout with made-up candidates before the first run).

The **back office** (`office/`) is a Cloudflare Worker that turns the prototype into a shop that takes
money: Stripe's hosted checkout for payment, the order placed and paid with CJdropshipping by itself,
status synced every two hours, customer emails through Resend once a domain exists, and an Orders tab
on the Radar page (`radar.html#orders`) for everything needing a hand. Until it is deployed and the
build points at it, the shop stays the prototype and takes no payment. Setup is under [Back office](#back-office).

## Run it

```bash
npm install
npm run dev              # Vite dev server
npm test                 # vitest: routes, catalogue engine, collections, shipping, orders, validation, devices, store
npm run typecheck        # tsc --noEmit
npm run build            # dist/index.html (shop) + dist/radar.html (Radar), relative assets
FRAGMENT=1 npm run build && npm run fragment   # single-file shop → ../nexus-marketplace.html (the claude.ai artifact)
npm run merge            # data/trends.json + data/listings/*.json → src/lib/*.generated / data.listings.ts
npm run radar            # the pipeline: needs CJ_API_KEY in the environment (or .env) for candidates
npm run radar:dry        # trends only, prints the tables, writes nothing
npm run photos           # photos/<id>-N.jpg → src/lib/photos.generated.ts (data URIs)
npm run research:merge   # research/expansion-*.json → src/lib/data.expansion.ts
python3 shot.py          # Playwright screenshots of every page + a link crawl (needs the build)
```

## Running the Radar on GitHub (one-time setup)

1. Push this repository to `sykunfts/nexus` (public).
2. Settings → Secrets and variables → Actions → New repository secret: name `CJ_API_KEY`, value the key from CJ's developer page. The key never goes into the repository.
3. Settings → Pages → Build and deployment → Source: **GitHub Actions**.
4. Actions → **Trend Radar** → Run workflow. About ten minutes later the shop and the Radar are live at the addresses above. It then runs by itself every day at 20:00 UTC (6 or 7 am Sydney).
5. Leave Issues enabled: approving a candidate works through an issue the Radar fills in for you. Only issues opened by the repository owner are acted on.

Where the pieces live: `radar/` (pipeline, TypeScript, tests in `radar/test`), `radar/terms.json` (the 31 watch terms),
`data/radar.json` and `data/trends.json` (written by the Action), `data/listings/` (approved drafts),
`src/radar/` (the page), `.github/workflows/` (`radar.yml` daily run, `pages.yml` deploy, `listing.yml` approvals).
The first run's log lists any term that returned no Wikipedia data; those article titles are the ones to rename in `radar/terms.json`.

Stack: React 18, TypeScript, Tailwind CSS 4 (CSS-first tokens in `src/styles/globals.css`),
Framer Motion 11, Lucide React, Zustand 5 (+ persist), Three.js + @react-three/fiber + @react-three/drei, vitest.

## Back office

What it does once configured: only Radar listings (products with a supplier) can be added to the cart;
every other product shows "Not yet stocked, tell me when" and collects an email. The checkout asks the
Worker for a live freight quote from CJ for the address, then sends the shopper to Stripe's hosted page.
When Stripe's webhook confirms the payment the Worker writes the order to KV, creates and confirms the CJ
order, pays it from the CJ wallet (unless `CJ_DRY_RUN` is `1`), and emails the confirmation. A cron every
two hours reads CJ's status and marks orders shipped (with the tracking number and a 17track link) or
delivered; anything that fails lands in a needs-attention queue, emails you, and is retried once a day
(three times at most). The Orders tab shows the queue first with Retry and Mark refunded, the full
list, the tell-me-when emails, and a health strip.

Where the pieces live: `office/src` (the Worker: `office.ts` router, `pricing.ts`, `cj.ts`, `stripe.ts`,
`orders.ts`, `fulfil.ts`, `email.ts`, `admin.ts`), `office/test` (vitest, no network), `office/wrangler.toml`,
`scripts/merge-office.mjs` (the catalogue the Worker prices from, generated at build), `src/lib/office.ts`
(the shop's client), `src/radar/components/OrdersTab.tsx`, `.github/workflows/office.yml` (deploy).
Prices are never trusted from the browser; the Worker prices every line from its own copy of the catalogue.

Returns, as decided: 30-day change-of-mind returns on Australian stock; consumer guarantees on everything;
supplier-direct items from China have no change-of-mind returns. The policy pages are under `#/policies/`.

### Setup checklist (one-time, about an hour)

1. Cloudflare: free account → Workers & Pages → create a KV namespace `nexus-orders` (note its id → repository variable `KV_NAMESPACE_ID`) → API token with "Edit Cloudflare Workers" → repository secrets `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.
2. Stripe: account in test mode → Developers → API keys → `STRIPE_SECRET_KEY` secret; after the first deploy, Developers → Webhooks → add `<OFFICE_URL>/stripe/webhook` for the events `checkout.session.completed` and `checkout.session.async_payment_succeeded` → `STRIPE_WEBHOOK_SECRET` secret.
3. Repository variables: `OFFICE_URL` (the Worker's URL after the first deploy, e.g. `https://nexus-office.<account>.workers.dev`), `KV_NAMESPACE_ID`.
4. `ADMIN_TOKEN`: any long random string, as a repository secret; the same string unlocks the Orders tab.
5. CJ: top up the wallet before the first real order; `CJ_DRY_RUN` variable `1` until then (it is `1` in `office/wrangler.toml`; change it there).
6. Domain and email, when ready: Resend account → verify the domain → `RESEND_API_KEY` secret, `FROM_EMAIL`, `ADMIN_EMAIL` and `EMAIL_ENABLED=1` variables (in `office/wrangler.toml`). Before the domain is verified Resend only delivers from `onboarding@resend.dev` to the address the Resend account was opened with, so for the needs-attention emails to reach you in the meantime set `FROM_EMAIL = "onboarding@resend.dev"` and `ADMIN_EMAIL` to that account address.
7. Going live: ABN and bank account into Stripe → swap the two Stripe secrets for live keys → set `CJ_DRY_RUN` to `0`.

Order of operations the first time: steps 1, 3 (`KV_NAMESPACE_ID` only) and 4, then create the secrets the
deploy step lists even where you have no value yet (the deploy action refuses to run with a listed secret
unset): `STRIPE_WEBHOOK_SECRET = whsec_placeholder` and `RESEND_API_KEY = unset` are safe placeholders (webhooks
are rejected and emails fail quietly until the real values replace them), and `CJ_API_KEY` is the Radar's key.
Then Actions → **Deploy the office** → Run workflow. Its last step prints the Worker URL: put it in `OFFICE_URL`, add the Stripe
webhook (step 2), then run **Publish to GitHub Pages** so the shop is built against the Worker. The
Worker deploys again by itself whenever `office/`, the catalogue or a listing changes. Secrets exist only
in GitHub and Cloudflare; `office/.dev.vars` is for local `wrangler dev` and is git-ignored.

Local checks: `npm run office:test` (the Worker's suite, no network), `npm run office:check` (bundles
the Worker without deploying), `npm run typecheck` (shop and Worker).

## Routes

| Hash | Page |
| --- | --- |
| `#/` | Home |
| `#/c/<slug>?f=…&sort=…` | Collection (category or saved query), filters and sort in the hash |
| `#/search?q=…` | Search results |
| `#/p/<id>` | Product |
| `#/compare?ids=a,b` | Compare up to four |
| `#/setup` | My setup (editable devices, region) |
| `#/guides`, `#/guides/<slug>` | Guides |
| `#/how-we-pick` | How we pick |
| `#/account`, `#/orders`, `#/orders/<id>` | Account and orders |
| `#/checkout`, `#/orders/<id>/confirmed` | Checkout and confirmation |
| `#/orders/confirmed?session=<id>` | Confirmation when returning from Stripe (office builds) |
| `#/policies/<terms\|privacy\|shipping-returns\|contact>` | Policy pages (drafts pending review) |

## Layout

```
src/
  styles/globals.css        design tokens (@theme), ruled sheet utilities, motion rules
  lib/data.ts               catalogue model, the 21 hand-verified products, default gear, nav
  lib/data.expansion.ts     generated: 43 verified worldwide products (scripts/merge-research.mjs)
  lib/routes.ts             typed hash routes + filter serialisation
  lib/catalog.ts            query engine: filters, sort, facets, similar
  lib/collections.ts        saved queries for every menu and footer item
  lib/compat.ts             works-with engine (app, magnets, finder, home/Thread, plug family, inputs, power)
  lib/shipping.ts           countries, zones, ETA and rate matrix per origin, tax by destination
  lib/currency.ts           display currency formatting (AUD base)
  lib/orders.ts             order lines, shipments split by origin, totals, time-derived status
  lib/validate.ts           address (per-country postcodes, AU state check), card (Luhn, expiry), email
  lib/devices.ts            devices a shopper can add to My setup, each with a source
  lib/guides.ts             guide registry
  lib/store.ts              Zustand store with persist: route, gear, cart, account, orders, searches
  pages/                    CollectionPage, ComparePage, SetupPage, CheckoutPage, ConfirmedPage,
                            AccountPage, OrdersPage, GuidesPage, HowWePickPage, NotFoundPage
  components/               Header, MegaMenu, PredictiveSearch, FilterRail, AddressForm, ProductCard,
                            ProductPage, ProductCanvas, ProductVisual (+ ProductImage), CartDrawer,
                            QuickView, Advisor, Home, FlipBoard, ui, guides/*
  App.tsx                   route → page, hash sync, toasts, compare tray, mobile tab bar, footer
research/                   SCHEMA.md + expansion-*.json from the research agents
scripts/                    embed-photos.mjs, merge-research.mjs, fragment.mjs, cj-probe.mjs
docs/superpowers/           specs and plans
```

## Dropping into Next.js 15 (App Router)

- Copy `src/styles/globals.css` as `app/globals.css`; keep `@import "tailwindcss"` and the `@theme` block.
- `lib/*` is framework-free. `compat.ts` runs unchanged in a Route Handler, Server Action or Web Worker.
- Components that use hooks/motion are Client Components: add `'use client'` at the top of
  `Header`, `PredictiveSearch`, `ProductCard`, `ProductPage`, `CartDrawer`, `QuickView`, `Advisor`, `ProductCanvas`.
- Replace `useStore.go()` with `next/link` / `useRouter`, and `ProductVisual` with `next/image` AVIF renders.
- Load the canvas with `next/dynamic(() => import('./ProductCanvas'), { ssr: false })` and `useGLTF` for a Draco GLB
  whose nodes carry `explode_offset` and `spec_key` in extras.
- Cart mutations in `store.ts` map 1:1 to Server Actions (`addLine`, `setQuantity`, `setCurrency`) returning the cart snapshot.
- The Advisor's `plan()` becomes a Claude tool-calling route (Vercel AI SDK `useChat`); keep `solve()` server-side so prices
  never come from the model.
