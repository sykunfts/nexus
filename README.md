# NEXUS — trend-tech storefront prototype

Test Bench design system, a real 64-product catalogue sold worldwide, and every page working on it:
collections with filters, search, compare, an editable My setup that every works-with check reads,
six guides with live elements, account, orders, international checkout and confirmation. Static page,
browser-persisted state, no payment taken.

## Run it

```bash
npm install
npm run dev              # Vite dev server
npm test                 # vitest: routes, catalogue engine, collections, shipping, orders, validation, devices, store
npm run typecheck        # tsc --noEmit
npm run build            # single-file build in dist/
npm run fragment         # dist/index.html → ../nexus-marketplace.html (the published fragment)
npm run photos           # photos/<id>-N.jpg → src/lib/photos.generated.ts (data URIs)
npm run research:merge   # research/expansion-*.json → src/lib/data.expansion.ts
python3 shot.py          # Playwright screenshots of every page + a link crawl (needs the build)
```

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
