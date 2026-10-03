# NEXUS — trend-tech storefront and Trend Radar

Test Bench design system, a real 64-product catalogue sold worldwide, and every page working on it:
collections with filters, search, compare, an editable My setup that every works-with check reads,
six guides with live elements, account, orders, international checkout and confirmation. Static page,
browser-persisted state, no payment taken.

The **Trend Radar** (`radar.html`) is the merchant tool: a daily GitHub Action reads public trend
signals, matches rising terms to CJdropshipping stock, prices each candidate to Australia (landed
cost, suggested retail with GST, margin), flags compliance points, and ranks them. "Add to shop"
opens a prefilled GitHub issue; the listing job turns it into a draft product and the site rebuilds.
The shop's trend badges come from the same signals once the Radar has run.

Live: shop at `https://sykunfts.github.io/nexus/`, Radar at `https://sykunfts.github.io/nexus/radar.html`
(add `?demo=1` to see the layout with made-up candidates before the first run).

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
