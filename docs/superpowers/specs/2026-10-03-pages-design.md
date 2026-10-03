# Pages — design

Date: 2026-10-03 · Status: for review · Build 2 of 4 (catalogue → **pages** → worker → Trend Radar)

## Goal

Turn the two-page prototype (home, product) into a storefront where every link resolves and every page runs on the real catalogue: category and collection pages with filters and sort, search results, compare, My setup, guides, "How we pick", account, orders, checkout and order confirmation. It stays a static page on the existing artifact link; the browser remembers setup, cart, account and orders between visits; checkout validates and places orders but takes no payment.

Success looks like: a link-crawl test visits every mega-menu and footer link and finds no dead ends; a shopper can set up their devices, filter a category by "works with my setup", compare two rings, check out a cart that splits into a Sydney parcel and a supplier parcel, and come back tomorrow to find the order on the Orders page with its status advanced.

## Non-goals

Live trend numbers (build 3), Trend Radar (build 4), real payments, server-side anything, sign-in with a password, email sending.

## Approach

A small typed hash router of our own plus a shared catalogue query engine, with the store persisted to the browser. Ten routes do not justify a router dependency; bolting more cases onto the current `view` union is how the code would tangle. Every page, rail and nav link reads from one `query(products, filters, sort)` so a nav item like "Under $100" is a saved query, not a hand-picked list.

## Routing

`src/lib/routes.ts` owns a `Route` union, `parseRoute(hash): Route` and `formatRoute(route): string`. The store's `route` is the source of truth; the hash mirrors it (`history.replaceState` in try/catch, because the artifact frame can refuse it) and `hashchange` feeds it back. On load, a present hash is parsed; an unknown hash gives the 404 route.

| Route | Hash | Page |
| --- | --- | --- |
| home | `#/` | Home (existing) |
| collection | `#/c/<slug>?f=<filters>&sort=<sort>` | Category or saved collection |
| search | `#/search?q=<text>&f=…&sort=…` | Search results (same layout as collection) |
| product | `#/p/<id>` | Product (existing; `#<id>` still accepted) |
| compare | `#/compare?ids=a,b,c,d` | Compare |
| setup | `#/setup` | My setup |
| guides | `#/guides` | Guides index |
| guide | `#/guides/<slug>` | One guide |
| how-we-pick | `#/how-we-pick` | How we pick |
| account | `#/account` | Account |
| orders | `#/orders` | Orders |
| order | `#/orders/<id>` | One order |
| checkout | `#/checkout` | Checkout |
| confirmed | `#/orders/<id>/confirmed` | Order confirmation |
| not-found | anything else | 404 with the search box |

Filters serialise as `key:value` pairs joined by `;` (`f=route:warehouse;platform:ios;price:0-200`), so a filtered category link is shareable. `go(route)` replaces `go(view)`; the existing `{ name: 'pdp', id }` calls become `{ name: 'product', id }`.

## Catalogue query engine

`src/lib/catalog.ts`, pure and unit-tested.

```ts
interface Filters {
  category?: string          // 'Home cinema' …
  price?: [number, number]   // AUD, inclusive
  route?: 'warehouse' | 'supplier'
  brand?: string[]
  platform?: ('ios' | 'android' | 'homekit' | 'google' | 'alexa' | 'matter' | 'thread')[]  // any match
  inStock?: boolean
  badge?: ('Viral' | 'Trending' | 'Rising' | 'New' | 'Limited stock')[]
  setupItem?: string         // gear id: keep products whose compat status is ok against that one item
  worksWithSetup?: boolean   // keep products whose status is ok against the saved setup
  text?: string              // search: name, brand, category, tagline, spec values; tokenised, all tokens must match
}
type Sort = 'trending' | 'price-asc' | 'price-desc' | 'rating' | 'newest'
function query(all: Product[], f: Filters, sort: Sort, setup: GearItem[]): Product[]
function facets(all: Product[], f: Filters): Facets   // counts per option for the filter rail, computed on the result set with that facet removed
```

`platform` reads `facts.app` for iOS and Android and `facts.home` for the rest. `newest` sorts by a new `listedAt: string` field on each product (ISO date; the 21 real products get the date they were added, 2026-10-02, except the Ray-Ban Meta Gen 3 which gets its release date 2026-09-23). `rating` puts rated products first by value, then unrated by trend. `trending` is `trend.delta` descending.

Collections live in `src/lib/collections.ts` as declared data: `{ slug, title, blurb, filters, sort? }`. One per nav section (category filter) and one per mega-menu item, so the whole menu is data. Examples: `under-100` → `{ price: [0, 100] }`; `works-with-iphone` → `{ setupItem: 'g-iphone' }`; `viral-right-now` → `{ badge: ['Viral'] }`; `gifts-48h` → `{ route: 'warehouse', price: [0, 300] }`; `matter-thread` → `{ platform: ['matter', 'thread'] }`. Menu items that are guides (`Ring sizing`, `Do I need a hub?`) point at guide routes instead. Every menu and footer item is either a collection slug, a guide slug or a fixed route; a build-time test asserts none is unresolved.

## Pages

**Collection and search** share `CollectionPage`. Left rail (ruled, Test Bench): facet groups as checkboxes with counts, a price band (four fixed bands, not a slider), a "Works with my setup" toggle that shows the item count it would leave, and a "Clear all" line. Top bar: result count, the sort select, and on search the query echoed as a chip. Body: the sheet grid of `ProductCard`s. Zero results: a short line, the three nearest products by text similarity, and the Trend Scout button. On mobile the rail becomes a "Filters (n)" button that opens a full-height sheet. Search also records the query in `recentSearches` (persisted, last five), which the predictive search dropdown already shows.

**Compare.** Up to four products from `compare` in the store (the tray already exists). A table with products as columns: image, name, price, route, rating, works-with status against the saved setup, then every spec row that any column has, aligned by label, winner cell marked as the specs tab already does. "Add a product" opens a picker filtered to the first product's category. Remove per column. Empty state links to Wearables and Cinema, where the real pairs are.

**My setup.** The gear list becomes editable and persisted. A short device catalogue (`src/lib/devices.ts`) of common phones (iPhone 15 to 17 line, Pixel 8 to 10, Galaxy S24 to S26), hubs (Apple TV 4K, HomePod mini, Nest Hub 2nd gen, Nest Mini, Echo 4th gen, Echo Hub, Aqara Hub M3), chargers (20, 30, 45, 65, 100 W), consoles and sources (Switch, PS5, Xbox Series X, laptop) and regions (AU, NZ, US, UK, EU). Each device's facts (magnets, finder network, Thread border router, protocols) are verified at build time against the maker's page and carry a `source`, the same rule as the product catalogue; a device whose fact cannot be verified is left out rather than guessed. Adding one picks facts from the catalogue entry; a free-text "Something else" row lets the shopper type a name and tick facts directly. Each row has the toggle the product page already uses. The page ends with "Products that work with everything here" (a collection query with `worksWithSetup`).

**Guides.** Six written for real, each a page of prose in the reading style with one or two live elements that use the catalogue: *Does it work with my phone?* (explains the seven checks, with a live demo picking a product and a phone); *Movie night, checked as a set* (throw-distance calculator: pick a projector, enter the wall distance in metres, get the picture size from the throw ratio, plus the kit from the Trend Scout); *Do I need a hub?* (Matter and Thread explained; shows the shopper's own hubs and which catalogue products need a Thread border router); *Qi2 vs MagSafe* (why the Pixel needs the ring; links the ESR ring and the MagGo); *Ring sizing* (RingConn and Oura size ranges and the sizing-kit flow); *Red vs near-infrared light* (what the Omnilux's two wavelengths do, with the caution that this is maker and research framing, not medical advice). The guides index lists these six; the remaining mega-menu guide labels link to the index. Throw ratios used by the calculator live on the two projectors as a new `throwRatio` fact, verified against XGIMI's spec pages at build time with the source recorded; a product without a verified ratio makes the calculator say "throw ratio not published" instead of guessing.

**How we pick.** One page: velocity gets a product onto the list; a verified price and specs keep it there; works-with facts are typed, not scraped; the independent-tests column and what replaces it; routes and what "Sydney stock" means; what we do not do (write reviews, invent bench numbers). Links to the catalogue's `sources` by product in a table.

**Account.** Email-only sign-in: enter an email, the page shows "Signed in as …" (no password, no email sent; the copy says so). Sections: saved setup (link to My setup), addresses (add, edit, default), order history (link to Orders), currency preference, "Clear my data" which wipes the persisted store. Signed-out state shows the sign-in box and what an account remembers.

**Checkout.** Steps on one page, each a ruled section that unlocks when the previous validates: contact (email), delivery address (Australian format, postcode and state validated against each other with a small table of postcode ranges), shipping per parcel (the cart's Sydney and supplier parcels appear as two shipments with their own standard or express choice and ETA), payment (card number with Luhn check, expiry, CVC, name; validated and never stored; copy says "No payment is taken in this prototype"), review (lines, both shipments, totals from the existing currency helpers), then "Place order". Guest checkout is allowed; the email becomes the account if none exists. A works-with summary runs on the review step and blocks nothing, but shows any warnings one last time.

**Confirmation.** Order number `NX-` plus six digits, both shipments with ETAs and route, the works-with summary of what was bought, "Add this setup to My setup" for anything that is a hub or charger, and a link to the order.

**Orders.** List of orders newest first with status and total; one order shows lines, shipments, and a status timeline. Status advances on a timer so the prototype feels alive: placed at order time; packed after 2 minutes; shipped after 10; delivered after 30 (Sydney) or 60 (supplier). The timeline shows the real timestamps. The timer runs on page load against stored timestamps, so it works across visits without a background task.

**404.** The search box, the six categories, and a line saying the link did not match.

## Persistence

Zustand `persist` middleware to `localStorage` under one key `nexus.v1`, with `version: 1` and a migrate function, wrapped so a blocked storage still renders (persist's `createJSONStorage` with a try/catch storage shim). Persisted: `gear` (the editable setup), `gearOn`, `cart`, `account`, `orders`, `recentSearches`, `currency`, `compare`. Not persisted: UI flags (drawers open, toasts, hovered). Nothing leaves the browser.

Order model:

```ts
interface Order {
  id: string                    // NX-123456
  placedAt: string              // ISO
  email: string
  address: Address
  lines: Line[]                 // from the cart
  shipments: { route: 'warehouse' | 'supplier'; method: ShipMethod; lineKeys: string[]; eta: [string, string]; cost: number }[]
  totals: { subtotal: number; shipping: number; tax: number; total: number; currency: Currency }
  compat: { status: 'ok' | 'warn' | 'bad'; issues: string[] }
}
```

Status is derived from `placedAt` and the route by `orderStatus(order, now)`, never stored, so it cannot drift.

## Error handling

Unknown product id → 404 route. Unknown collection slug → 404. Malformed filter string → ignored key by key, the rest applies. Blocked storage → in-memory only, with a one-line notice on Account. Checkout steps show inline field errors on blur and a summary at the top of the step on submit; nothing is silently accepted. Orders with a shipment route whose product has since left the catalogue still render from their stored line snapshot (lines carry name, price and image key at order time).

## Testing

Vitest, in `src/lib/*.test.ts`: `routes` (parse and format round-trip for every route, malformed inputs), `catalog` (each filter alone and combined, each sort, facet counts, text search tokenisation), `collections` (every menu and footer item resolves), `orders` (totals per currency, shipment split, status timeline at fixed times), `checkout` validation (postcode and state pairs, Luhn). Playwright screenshots per page at 1440 and 390 added to `shot.py`. A crawl script in `shot.py` clicks every mega-menu and footer link and asserts the 404 page never appears.

## Decisions taken

- No slider for price: four bands keep the rail ruled and keyboard-friendly.
- Facet counts are computed with the facet's own filter removed, so a checked option never shows zero for itself.
- Account has no password because a prototype with a fake password teaches a bad habit; the copy says what it is.
- Order status is a pure function of time so there is no background process to lose.
- Guide copy is written, not generated at runtime, and the only health-adjacent guide (red light) says it is not medical advice.
