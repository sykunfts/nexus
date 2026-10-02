# NEXUS — tech marketplace prototype

Obsidian design system + the three requested components (Header/mega-menu/predictive search,
Product card, Product page with sticky configurator, specs tab and live compatibility status),
plus the slide-over cart, quick-view modal, AI Advisor pane and a React Three Fiber product canvas.

## Run it

```bash
npm install
npm run dev        # Vite dev server
npm run typecheck  # tsc --noEmit
npm run build      # single-file build in dist/ (what the published prototype is)
```

Stack: React 18, TypeScript, Tailwind CSS 4 (CSS-first tokens in `src/styles/globals.css`),
Framer Motion 11, Lucide React, Zustand 5, Three.js + @react-three/fiber + @react-three/drei.

## Layout

```
src/
  styles/globals.css        design tokens (@theme), glass/micro/tnum utilities, motion rules
  lib/data.ts               catalogue model + sample products, gear, nav
  lib/compat.ts             @nexus/compat — pure compatibility engine (ports, power, bandwidth)
  lib/currency.ts           multi-currency formatting, tax estimate, shipping rates
  lib/store.ts              Zustand store (cart, view, currency, gear, compare, toasts)
  lib/parts.ts              exploded-view part manifest
  components/ui.tsx         Button, Chip, Pill, StockDot, Stars, Kbd, Toggle, Eyebrow
  components/Header.tsx     sticky glass header, hover-intent mega-menu, status indicators, currency
  components/MegaMenu.tsx   mega-menu panel with featured product
  components/PredictiveSearch.tsx  ⌘K search with typed results, keyboard nav, Advisor hand-off
  components/ProductCard.tsx       hover lift, quick-view trigger, swatches, stock, add-to-cart morph
  components/ProductPage.tsx       3-pane PDP: canvas, sticky configurator, tabs, compat report
  components/ProductCanvas.tsx     R3F 360° / exploded view with callouts (lazy-loaded)
  components/ProductVisual.tsx     procedural SVG product renders (swap for AVIF in production)
  components/CartDrawer.tsx        slide-over cart, currency, inline tax/shipping, express + one-click
  components/QuickView.tsx         quick-view dialog
  components/Advisor.tsx           AI Tech Advisor pane (scripted model turn, real budget solver + compat)
  components/Home.tsx              hero + personalised rails
  App.tsx                          shell: routing by state, toasts, compare tray, mobile tab bar
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
