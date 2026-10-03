# Trend Radar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A daily GitHub Action that turns public trend signals plus CJdropshipping data into a ranked, costed candidate list (`data/radar.json`) and real trend scores for the shop (`data/trends.json`), a Radar page at `/radar/`, an issue-driven approval that writes draft listings into the shop, and GitHub Pages deployment of both.

**Architecture:** A TypeScript pipeline under `radar/` (pure functions over injected `http`, `now` and `sleep`, so every stage is unit-testable from fixtures) writes two JSON files; build-time merge scripts turn them into generated TypeScript modules the shop imports; the Radar page is a second Vite entry rendering `data/radar.json`; three workflows (radar, pages, listing) run it on GitHub.

**Tech Stack:** Node 22, TypeScript strict, `tsx` for the CLI, vitest (node env; jsdom for page tests), React 18 + Tailwind 4 (shop's tokens), Vite 5 multi-entry, GitHub Actions, GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-10-03-trend-radar-design.md`

## Global Constraints

- The CJ key is read only from `process.env.CJ_API_KEY`; it never appears in a file under version control, in `dist/`, or in a test fixture.
- Sources, weights, floors: Wikipedia 0.40 / 50, Hacker News 0.20 / 5, Reddit 0.30 / 5, TIWIB 0.10 / 1. Window 14 days ending yesterday UTC. Labels: Viral ≥ 200, Trending ≥ 100, Rising ≥ 50, else Steady. `delta` clamped to [−90, 999]. Confidence: high ≥ 3 sources, medium 2, low 1, none 0.
- Money: card fee 2.9 % + A$0.30; GST 10 %; target margin 0.45; retail rounds up to the next `.95`; retail floor is landed × 1.8; fallback rate 1.52.
- Score: `0.45·trendZ + 0.35·demand + 0.20·marginHeadroom − penalties`; penalties heavy 0.15, mains without AU plug 0.25, costAud < 5 0.15, no AU freight 0.40. Heavy means `weightG > 2000`.
- CJ: base `https://developers.cjdropshipping.com/api2.0/v1`, auth `POST /authentication/getAccessToken {apiKey}`, header `CJ-Access-Token`, 1.1 s between requests, `pageSize=20`, keep `sellPrice ≥ 3`, top 3 per term by `listedNum`. Freight destinations AU/2000, US/10001, GB/SW1A 1AA (retry `UK` once if `GB` is rejected).
- HTTP: 15 s timeout, retries after 2 s and 6 s, 300 ms per-host spacing (1100 ms for the CJ host), User-Agent `NexusRadar/0.3 (+https://github.com/sykunfts/nexus)`.
- Copy: trend numbers are described as interest growth, never sales. TIWIB: titles, links, dates only.
- The published pages never fetch at runtime; all data is baked at build.
- Every new module has a test that failed before the code existed. `npm test`, `npm run typecheck`, `npm run build` green before every commit.

## Review Focus

1. A CJ product whose variant list is empty, or whose `variantSellPrice` is a string, must be skipped with a logged reason, never crash the run (Task 6 test `skips a product with no usable variant`).
2. Reddit answering 403 on every call: the run completes, Reddit shows `failed: 403` in both files, other weights renormalise, and the Radar header names it (Task 4 test `reddit 403 → null`, Task 9 test `a failed source renormalises weights and is recorded`).
3. A term whose CJ category fragment matches nothing: candidates still come from the keyword search and carry `cjScope: 'keyword'`, and the page says "keyword match" on the card (Task 6 test `falls back to keyword scope`, Task 12 test `keyword-scope candidates say so`).
4. An issue titled `list: <pid>` opened by someone who is not the repository owner must change nothing: the workflow condition excludes it and `listing.mjs` refuses when `ISSUE_AUTHOR !== REPO_OWNER` (Task 10 test `refuses an issue from another user`).
5. The rate service down: the previous file's rate is used and marked `previous`; with no previous file, 1.52 marked `fallback`; the Radar header shows the source (Task 7 test `rate falls back in order`, Task 12 test `header shows the rate source`).

---

### Task 1: Pipeline scaffold, types and watch terms

**Files:**
- Create: `radar/tsconfig.json`, `radar/src/types.ts`, `radar/terms.json`, `radar/test/terms.test.ts`
- Modify: `package.json` (devDependency `tsx@^4`, scripts `radar`, `radar:dry`), `vitest.config.ts` (include `radar/test/**/*.test.ts`), `tsconfig.json` (`include: ["src", "radar/src"]`), `.gitignore` (nothing new), `README.md` (later task)

**Interfaces:**
- Produces `radar/src/types.ts`:

```ts
export type SourceId = 'wikipedia' | 'hackernews' | 'reddit' | 'tiwib'
export type TrendLabel = 'Viral' | 'Trending' | 'Rising' | 'Steady'
export type Confidence = 'high' | 'medium' | 'low' | 'none'
export type Flag = 'battery' | 'mains' | 'radio' | 'skin' | 'kids' | 'heavy'
export type Dest = 'AU' | 'US' | 'GB'
export interface Term { id: string; label: string; section: string; wikipedia: string; phrases: string[]; cj: { category: string; keyword: string }; products: string[] }
export interface Window { from: string; to: string; days: 14 }            // ISO dates, inclusive, `to` = yesterday UTC
export interface DailySeries { source: SourceId; days: { date: string; value: number }[] }
export interface SourceStat { last7: number; prior7: number; growth: number }
export interface TermScore { id: string; label: string; section: string; delta: number; trendLabel: TrendLabel; score: number; confidence: Confidence; series: number[]; sources: Record<SourceId, SourceStat | null> }
export interface FreightLine { name: string; usd: number; days: [number, number] }
export interface FreightQuote { cheapest: FreightLine; fastest: FreightLine; lines: number }
export interface CandidateVariant { vid: string; name: string; weightG: number; priceUsd: number; auPlug: boolean; variantCount: number }
export interface Money { costAud: number; freightAud: number; landedAud: number; retailAud: number; marginPct: number; netAud: number; at2x: number; at3x: number; sectionMedianAud: number | null }
export interface Candidate { pid: string; termId: string; section: string; name: string; image: string; cjUrl: string; listedNum: number; cjScope: 'category' | 'keyword'; variant: CandidateVariant; freight: Record<Dest, FreightQuote | null>; money: Money; flags: Flag[]; score: number; firstSeen: string; why: string; stale?: boolean }
export interface NoveltyItem { title: string; link: string; date: string; termId: string | null }
export interface Rate { usdAud: number; source: 'ecb' | 'previous' | 'fallback'; date: string }
export interface RadarFile { generatedAt: string; cjGeneratedAt: string | null; rate: Rate; sources: Record<SourceId | 'cj', string>; terms: TermScore[]; candidates: Candidate[]; novelty: NoveltyItem[] }
export interface ProductTrend { delta: number; label: TrendLabel; score: number; confidence: Confidence; series: number[] }
export interface TrendsFile { generatedAt: string; window: Window; sources: Record<SourceId, string>; products: Record<string, ProductTrend>; terms: TermScore[] }
```

- Produces `radar/terms.json`: an array of `Term`, 31 entries, exactly this table (section = the shop's `Product.category`; `cj.keyword` is also the CJ search keyword; `cj.category` is the fragment matched against CJ category names):

| id | label | section | wikipedia | phrases | cj.category | products |
| --- | --- | --- | --- | --- | --- | --- |
| smart-ring | Smart rings | Wearables | Smart_ring | smart ring; sleep tracking ring | smart ring | oura-ring-5, ringconn-gen-3, ultrahuman-ring-air, samsung-galaxy-ring |
| smart-glasses | Smart glasses | Wearables | Smartglasses | smart glasses; AI glasses | smart glasses | rayban-meta-gen-3, even-realities-g2, xreal-one, meta-ray-ban-display |
| fitness-band | Fitness bands | Wearables | Activity_tracker | fitness tracker band; screenless fitness tracker | fitness tracker | whoop-5-0, garmin-index-sleep-monitor |
| smartwatch | Health watches | Wearables | Smartwatch | smartwatch ECG; health smartwatch | smart watch | withings-scanwatch-2 |
| ai-wearable | AI wearables | Wearables | Wearable_technology | AI wearable; AI pendant | wearable | bee-pioneer |
| open-ear-buds | Open-ear buds | Audio | Headphones | open ear earbuds; clip on earbuds | earphone | bose-ultra-open-2, sony-linkbuds-open, shokz-openfit-2-plus, nothing-ear-open |
| portable-speaker | Portable speakers | Audio | Wireless_speaker | portable bluetooth speaker; waterproof speaker | speaker | marshall-emberton-iii, jbl-flip-7 |
| indoor-camera | Indoor cameras | Smart home | IP_camera | indoor security camera; matter camera | camera | aqara-camera-e1, tp-link-tapo-c120 |
| light-strip | Smart lighting | Smart home | LED_strip_light | LED strip lights; smart light strip | led strip | nanoleaf-matter-strip-5m, govee-rgbic-neon-rope-light-2, nanoleaf-blocks-starter-kit, philips-hue-play-hdmi-sync-box-8k |
| robot-vacuum | Robot vacuums | Smart home | Robotic_vacuum_cleaner | robot vacuum; robot mop | vacuum | eufy-x10-pro-omni, dreame-x50-ultra, roborock-saros-10 |
| window-robot | Window robots | Smart home | Window_cleaning_robot | window cleaning robot | window cleaning | ecovacs-winbot-w2-pro-omni |
| smart-lock | Smart locks | Smart home | Smart_lock | smart lock; fingerprint door lock | smart lock | switchbot-lock-ultra, aqara-smart-lock-u300 |
| matter-hub | Matter hubs | Smart home | Matter_(standard) | matter hub; thread border router | smart home hub | aqara-hub-m3, switchbot-hub-3 |
| laser-projector | Laser projectors | Home cinema | Video_projector | laser projector; 4k projector | projector | xgimi-mogo-4-laser, anker-nebula-capsule-3-laser, dangbei-atom |
| battery-projector | Battery projectors | Home cinema | Handheld_projector | portable projector; mini projector | projector | xgimi-vibe-one, samsung-the-freestyle-plus-2026 |
| projector-screen | Projector screens | Home cinema | Projection_screen | projector screen; outdoor projector screen | projector screen | elite-yard-master-2-100 |
| qi2-power-bank | Qi2 power banks | Power | Power_bank | magsafe power bank; qi2 power bank | power bank | anker-maggo-10k, anker-prime-26k-300w-power-bank |
| gan-charger | GaN chargers | Power | Battery_charger | gan charger; 100w charger | charger | anker-prime-100w, ugreen-nexode-100w-3-port |
| magnetic-charging | Magnetic charging | Power | Qi_(standard) | qi2 charger; magsafe charger | wireless charger | belkin-boostcharge-pro-3-in-1-qi2-pad, esr-halolock-ring |
| travel-adapter | Travel adapters | Accessories | AC_power_plugs_and_sockets | travel adapter; universal travel adapter | travel adapter | sansai-au-travel-adapter |
| e-scooter | E-scooters | Mobility | Electric_kick_scooter | electric scooter; e-scooter | electric scooter | segway-e3-pro, niu-kqi-300x, segway-ninebot-kickscooter-f3 |
| led-mask | LED masks | Health | Light_therapy | LED face mask; red light mask | beauty device | omnilux-contour-face, therabody-theraface-mask, currentbody-skin-led-mask-series-3, shark-cryoglow |
| smart-scale | Smart scales | Health | Weighing_scale | smart scale; body composition scale | scale | withings-body-smart |
| recovery | Recovery gear | Health | Massage | compression boots; massage gun | massager | hyperice-normatec-elite |
| desk-3d-printer | Desk 3D printers | Maker | 3D_printing | desktop 3d printer; mini 3d printer | 3d printer | bambu-a1-mini, creality-k2 |
| dev-board | Dev boards | Maker | Single-board_computer | single board computer; hacking multitool | development board | flipper-zero, raspberry-pi-5-desktop-kit-8gb |
| ai-recorder | AI recorders | Work | Dictation_machine | AI voice recorder; AI note taker | voice recorder | plaud-notepin-s, plaud-note-pro |
| pocket-gimbal | Pocket gimbals | Work | Gimbal | pocket gimbal camera; vlog camera | gimbal | dji-osmo-pocket-3 |
| 360-camera | 360 cameras | Work | Omnidirectional_camera | 360 camera; action camera | action camera | insta360-x5 |
| keyboard | Keyboards | Work | Computer_keyboard | magnetic switch keyboard; hall effect keyboard | keyboard | keychron-k2-he |
| finder-tag | Finder tags | Accessories | Bluetooth_tracker | bluetooth tracker; item finder tag | tracker | chipolo-pop |

- [ ] **Step 1: Write the failing test** `radar/test/terms.test.ts`

```ts
import terms from '../terms.json'
import { products } from '../../src/lib/data'
it('terms are unique, complete and point at real products', () => {
  const ids = terms.map((t) => t.id)
  expect(new Set(ids).size).toBe(ids.length)
  expect(ids.length).toBe(31)
  const cats = new Set(products.map((p) => p.category))
  for (const t of terms) {
    expect(cats.has(t.section), t.id).toBe(true)
    expect(t.phrases.length).toBeGreaterThan(0)
    expect(t.cj.keyword.length).toBeGreaterThan(0)
    for (const id of t.products) expect(products.some((p) => p.id === id), `${t.id} → ${id}`).toBe(true)
  }
  const mapped = new Set(terms.flatMap((t) => t.products))
  expect(products.filter((p) => !mapped.has(p.id)).map((p) => p.id)).toEqual([])   // every product has a term
})
```

- [ ] **Step 2: Run it** — `npx vitest run radar/test/terms.test.ts` — Expected: FAIL (cannot find `../terms.json` / include pattern)
- [ ] **Step 3: Create `radar/terms.json` from the table, `radar/src/types.ts` verbatim, `radar/tsconfig.json` (`extends ../tsconfig.json`, `compilerOptions.types: ["node"]`, `include: ["src", "test"]`), add `tsx` and `@types/node` as devDependencies, scripts `"radar": "tsx radar/src/index.ts run"` and `"radar:dry": "tsx radar/src/index.ts run --dry --skip-cj"`, extend vitest `include` and root tsconfig `include`.**
- [ ] **Step 4: Run** `npx vitest run radar/test/terms.test.ts` — Expected: PASS; `npm run typecheck` clean
- [ ] **Step 5: Commit** `git add -A && git commit -m "radar: scaffold, types and 31 watch terms"`

### Task 2: HTTP with timeout, retries and per-host spacing

**Files:**
- Create: `radar/src/fetch.ts`, `radar/test/fetch.test.ts`

**Interfaces:**
- Produces:

```ts
export type Fetch = (url: string, init?: RequestInit) => Promise<Response>
export interface HttpOptions { fetch?: Fetch; sleep?: (ms: number) => Promise<void>; now?: () => number; timeoutMs?: number; retryDelays?: number[]; spacingMs?: Record<string, number>; defaultSpacingMs?: number; userAgent?: string }
export interface Http { (url: string, init?: RequestInit): Promise<Response>; json<T = unknown>(url: string, init?: RequestInit): Promise<T> }
export function createHttp(o?: HttpOptions): Http
```
Defaults from Global Constraints. Retry on network error, 429 and 5xx; return other responses as-is. `json()` throws `Error('http <status> <url>')` on `!ok`.

- [ ] **Step 1: Write failing tests**: `retries twice on 503 then succeeds` (fake fetch returns 503, 503, 200; sleeps recorded as [2000, 6000]); `spaces requests to the same host` (two calls to `https://a.test/x` with `spacingMs: { 'a.test': 1100 }` → second sleep ≥ 1100 − elapsed); `sends the user agent`; `times out` (fake fetch that never resolves until aborted; `timeoutMs: 10` → rejects with AbortError after retries).
- [ ] **Step 2: Run** `npx vitest run radar/test/fetch.test.ts` — Expected: FAIL `createHttp is not a function`
- [ ] **Step 3: Implement `createHttp`** using `AbortController` for the timeout and a per-host `lastAt` map for spacing.
- [ ] **Step 4: Run** — Expected: PASS 4/4
- [ ] **Step 5: Commit** `radar: http client with retries and spacing`

### Task 3: Window maths and the Wikipedia and Hacker News adapters

**Files:**
- Create: `radar/src/window.ts`, `radar/src/sources/wikipedia.ts`, `radar/src/sources/hackernews.ts`, `radar/test/fixtures/wikipedia.json`, `radar/test/fixtures/hackernews.json`, `radar/test/sources-a.test.ts`

**Interfaces:**
- Produces `window.ts`: `windowEnding(now: Date): Window` (to = yesterday UTC, from = to − 13 days) and `dates(w: Window): string[]` (14 ISO dates oldest first).
- Produces each adapter as `fetchDaily(term: Term, w: Window, http: Http): Promise<DailySeries | null>`; a series always has exactly 14 days in `dates(w)` order, zero-filled.
- Wikipedia: `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/<article>/daily/<from YYYYMMDD>/<to YYYYMMDD>`; 404 → `null`.
- Hacker News: one call per phrase, `https://hn.algolia.com/api/v1/search_by_date?query=<phrase>&tags=story&numericFilters=created_at_i><fromEpoch>,created_at_i<<toEpoch+86400>&hitsPerPage=1000`; value per day = sum of `points`; phrases summed.

- [ ] **Step 1: Write failing tests**: `windowEnding gives 14 days ending yesterday` (now 2026-10-04T03:00Z → to 2026-10-03, from 2026-09-20); `wikipedia parses a fixture into 14 zero-filled days` (fixture has 12 items; two missing dates read 0; total equals the fixture sum); `wikipedia 404 → null`; `hackernews sums points per day across phrases` (fixture with 3 hits, two on one day); `hackernews empty hits → series of zeros, not null`.
- [ ] **Step 2: Run** `npx vitest run radar/test/sources-a.test.ts` — Expected: FAIL (modules missing)
- [ ] **Step 3: Implement `window.ts`, `wikipedia.ts`, `hackernews.ts`; write the two fixtures by hand in the real response shapes** (Wikipedia: `{ items: [{ timestamp: 'YYYYMMDD00', views }] }`; HN: `{ hits: [{ created_at_i, points }] }`).
- [ ] **Step 4: Run** — Expected: PASS 5/5
- [ ] **Step 5: Commit** `radar: window maths, wikipedia and hacker news adapters`

### Task 4: Reddit and TIWIB adapters

**Files:**
- Create: `radar/src/sources/reddit.ts`, `radar/src/sources/tiwib.ts`, `radar/test/fixtures/reddit.json`, `radar/test/fixtures/tiwib.xml`, `radar/test/sources-b.test.ts`

**Interfaces:**
- Reddit: per phrase `https://www.reddit.com/search.json?q=<phrase>&sort=new&t=month&limit=100`; value per day = posts whose `created_utc` falls in the window; any 403/429 after retries → `null` and the adapter sets `lastError = 'failed: 403'` (exported `status(): string`).
- TIWIB: `fetchFeed(http): Promise<NoveltyItem[]>` parses `https://www.thisiswhyimbroke.com/feed/` (RSS 2.0: `item > title, link, pubDate`) with a small regex parser, no XML library; `fetchDaily(term, w, http, feed)` counts items per day whose title contains any phrase (case-insensitive, word-boundary); `matchTerm(title, terms): string | null` returns the first matching term id.

- [ ] **Step 1: Write failing tests**: `reddit counts posts per day` (fixture `data.children[].data.created_utc`); `reddit 403 → null and status says so`; `tiwib parses 15 items with titles, links and dates`; `tiwib counts phrase matches per day`; `matchTerm finds the term by phrase and returns null otherwise`.
- [ ] **Step 2: Run** `npx vitest run radar/test/sources-b.test.ts` — Expected: FAIL
- [ ] **Step 3: Implement both adapters and the fixtures** (the RSS fixture: 15 `<item>` elements with invented titles, two of which contain "smart ring" and "laser projector").
- [ ] **Step 4: Run** — Expected: PASS 5/5
- [ ] **Step 5: Commit** `radar: reddit and tiwib adapters`

### Task 5: Scoring terms and products

**Files:**
- Create: `radar/src/score.ts`, `radar/test/score.test.ts`

**Interfaces:**
- Produces:

```ts
export const WEIGHTS: Record<SourceId, number>   // 0.40 0.20 0.30 0.10
export const FLOORS: Record<SourceId, number>    // 50 5 5 1
export function growth(series: DailySeries, floor: number): SourceStat
export function scoreTerms(input: { term: Term; series: DailySeries[] }[]): TermScore[]
export function labelFor(delta: number): TrendLabel
export function productTrends(scores: TermScore[], terms: Term[]): Record<string, ProductTrend>
```
`scoreTerms` computes per-source z across all terms (sd floor 0.1), renormalised weights per term, `delta` clamped, `series` as 8 points scaled to max 100 (all zeros → eight zeros), `confidence` by source count.

- [ ] **Step 1: Write failing tests**: `growth uses the floor` (prior7 = 1, last7 = 4, floor 5 → growth 0.6); `labels at the thresholds` (49 Steady, 50 Rising, 100 Trending, 200 Viral); `weights renormalise when a source is missing` (two terms, Wikipedia only → weight 1.0, delta = round(100·growth)); `delta clamps at 999 and −90`; `series scales to 100 and all-zero stays zero`; `confidence counts sources`; `productTrends maps every product of a term to the term's trend`.
- [ ] **Step 2: Run** — Expected: FAIL
- [ ] **Step 3: Implement `score.ts`**
- [ ] **Step 4: Run** — Expected: PASS 7/7
- [ ] **Step 5: Commit** `radar: term and product scoring`

### Task 6: CJ client, parsing and search

**Files:**
- Create: `radar/src/cj/client.ts`, `radar/src/cj/parse.ts`, `radar/src/cj/search.ts`, `radar/test/fixtures/cj-categories.json`, `radar/test/fixtures/cj-list.json`, `radar/test/fixtures/cj-query.json`, `radar/test/fixtures/cj-freight.json`, `radar/test/cj.test.ts`

**Interfaces:**
- `client.ts`: `createCjClient(o: { apiKey: string; http: Http }): CjClient` with `auth(): Promise<void>` (POST getAccessToken, stores `data.accessToken`), `get<T>(path: string, params: Record<string, string | number>): Promise<T>`, `post<T>(path: string, body: unknown): Promise<T>`; both send `CJ-Access-Token`; a response with `result === false` or `code !== 200` throws `CjError(code, message)`.
- `parse.ts`:

```ts
export interface CjCategory { id: string; name: string }
export interface CjListItem { pid: string; name: string; image: string; sellPrice: number; listedNum: number; categoryName: string }
export interface CjVariant { vid: string; name: string; key: string; priceUsd: number; weightG: number }
export interface CjDetail { pid: string; name: string; images: string[]; variants: CjVariant[]; productUrl: string }
export function flattenCategories(json: unknown): CjCategory[]          // walks nested category lists, any depth
export function parseList(json: unknown): CjListItem[]                   // skips items missing pid/name/sellPrice
export function parseQuery(json: unknown): CjDetail | null              // null when no usable variant (numeric price > 0)
export function parseFreight(json: unknown): FreightQuote | null        // null when the list is empty or absent
export function pickVariant(d: CjDetail): CandidateVariant              // AU plug if name/key matches /\bAU\b|Australia/i, else cheapest
```
- `search.ts`: `resolveCategory(cats: CjCategory[], fragment: string): CjCategory | null` (case-insensitive substring; among matches the shortest name); `searchTerm(cj: CjClient, term: Term, cats: CjCategory[]): Promise<{ items: CjListItem[]; scope: 'category' | 'keyword' }>`; `fetchDetail(cj, pid): Promise<CjDetail | null>`; `fetchFreight(cj, vid: string, dest: Dest): Promise<FreightQuote | null>` (zips per Global Constraints; `GB` rejected → retry `UK`).

- [ ] **Step 1: Write failing tests**: `flattenCategories finds Projectors at depth 3`; `resolveCategory prefers the shortest match` (['Camera Bags', 'Camera'] → 'Camera'); `parseList keeps numeric prices and sorts by nothing` (fixture has one item with sellPrice "abc" → skipped); `parseQuery picks the AU plug variant`; `skips a product with no usable variant` (variants `[]` → null; variant with string price → excluded); `parseFreight marks cheapest and fastest and returns null on empty`; `falls back to keyword scope` (no category match → `get` called without `categoryId`, scope 'keyword'); `client sends the token and throws CjError on result false`.
- [ ] **Step 2: Run** `npx vitest run radar/test/cj.test.ts` — Expected: FAIL
- [ ] **Step 3: Write the four fixtures in the shapes observed on 3 October** (list: `{ result: true, data: { list: [{ pid, productNameEn, productImage, sellPrice, listedNum, categoryName }] } }`; query: `{ result: true, data: { pid, productNameEn, productImageSet: [], variants: [{ vid, variantNameEn, variantKey, variantSellPrice, variantWeight }] } }`; freight: `{ result: true, data: [{ logisticName, logisticPrice, logisticAging: "8-15" }] }`; categories: `{ result: true, data: [{ categoryFirstName, categoryFirstList: [{ categorySecondName, categorySecondList: [{ categoryId, categoryName }] }] }] }`), then implement the three modules.
- [ ] **Step 4: Run** — Expected: PASS 8/8
- [ ] **Step 5: Commit** `radar: cj client, parsing and category-scoped search`

### Task 7: Money and flags

**Files:**
- Create: `radar/src/money.ts`, `radar/src/flags.ts`, `radar/test/money.test.ts`, `radar/test/flags.test.ts`

**Interfaces:**
- `money.ts`:

```ts
export const FEE_PCT = 0.029; export const FEE_FIXED = 0.30; export const GST = 0.10; export const TARGET = 0.45; export const FALLBACK_RATE = 1.52
export function fetchRate(http: Http, previous: Rate | null, today: string): Promise<Rate>
export function pretty95(x: number): number                     // next price ending .95 at or above x
export function suggestedRetail(landedAud: number): number     // max(pretty95 of the 45 %-margin price, pretty95(landed × 1.8))
export function marginAt(retailAud: number, landedAud: number): { netAud: number; marginPct: number }
export function moneyFor(priceUsd: number, freightUsd: number | null, rate: number, sectionMedianAud: number | null): Money   // freight null → freightAud 0 and landed = cost
export function sectionMedian(products: { category: string; price: number }[], section: string): number | null
```
The 45 % price: solve `retail/1.1 − (FEE_PCT·retail + FEE_FIXED) − landed = TARGET·(retail/1.1)` for retail.
- `flags.ts`: `export const FLAG_NOTES: Record<Flag, string>` (the six notes from the spec verbatim); `flagsFor(text: string, weightG: number): Flag[]` (rules from the spec's table, case-insensitive, word-boundary where the trigger is a word).

- [ ] **Step 1: Write failing tests** (`money.test.ts`): `pretty95 rounds up to .95` (44.69 → 44.95; 44.95 → 44.95; 45 → 45.95); `suggestedRetail hits 45 % net margin` (landed 44.69 → retail where `marginAt` ≥ 0.45 and < 0.47, and ≥ pretty95(80.44)); `marginAt is 0 at breakeven`; `rate falls back in order` (http throws: previous → source 'previous' with previous rate; no previous → 1.52 'fallback'; http ok → 'ecb' with the fixture's rate and date); `sectionMedian uses the shop's prices`. (`flags.test.ts`): one case per flag, `heavy at 2001 g not 2000`, `no flags on plain text`.
- [ ] **Step 2: Run** — Expected: FAIL
- [ ] **Step 3: Implement both modules**
- [ ] **Step 4: Run** — Expected: PASS
- [ ] **Step 5: Commit** `radar: landed cost, retail, margin, rate and compliance flags`

### Task 8: Ranking, firstSeen carry-over and atomic writes

**Files:**
- Create: `radar/src/rank.ts`, `radar/src/write.ts`, `radar/test/rank.test.ts`

**Interfaces:**
- `rank.ts`: `export type Unranked = Omit<Candidate, 'score' | 'why' | 'firstSeen'>`; `rankCandidates(cands: Unranked[], terms: TermScore[], previous: RadarFile | null, today: string): Candidate[]` — score per Global Constraints (trendZ = the term's `score`, clamped to [−2, 2] and mapped to [0, 1]; demand from `listedNum` against the run's max), `why` = `"<term label> <±delta> % on <sources that returned data>; <listedNum> dropshippers list this; <margin> % margin at $<retail>."`, `firstSeen` carried from `previous.candidates` by `pid` else `today`, sorted by score desc then delta desc.
- `write.ts`: `readJson<T>(path): Promise<T | null>`, `writeAtomic(path: string, value: unknown): Promise<void>` (temp file + rename, 2-space JSON, trailing newline).

- [ ] **Step 1: Write failing tests**: `orders by score then delta`; `each penalty lowers the score by its amount` (four cases); `firstSeen carries over by pid`; `why names sources, demand and margin`; `writeAtomic leaves no temp file and round-trips` (tmp dir).
- [ ] **Step 2: Run** — Expected: FAIL
- [ ] **Step 3: Implement**
- [ ] **Step 4: Run** — Expected: PASS
- [ ] **Step 5: Commit** `radar: ranking, firstSeen and atomic writes`

### Task 9: The run: orchestration and CLI

**Files:**
- Create: `radar/src/run.ts`, `radar/src/index.ts`, `radar/test/run.test.ts`
- Create at first real run: `data/radar.json`, `data/trends.json` (the Action commits them; a hand-made `data/radar.json` and `data/trends.json` from the test's fixture output are committed in this task so the page and merge scripts have something to read)

**Interfaces:**
- `run.ts`:

```ts
export interface RunDeps { http: Http; now: () => Date; env: { CJ_API_KEY?: string }; terms: Term[]; previous: RadarFile | null; products: { id: string; category: string; price: number }[]; log: (line: string) => void; cj?: boolean; limit?: number; only?: string[] }
export function runRadar(d: RunDeps): Promise<{ radar: RadarFile; trends: TrendsFile; ok: boolean }>
```
Order: window → fetch all four sources per term (Wikipedia and HN in parallel per term; Reddit and TIWIB after; TIWIB feed fetched once) → `scoreTerms` → `productTrends` → `ok = terms with ≥ 1 source ≥ half` → if `cj` and key: categories once, then for the selected terms (Rising+ plus top 8) search/detail/freight → money, flags → `rankCandidates` → files. `--skip-cj` or no key → `sources.cj = 'skipped'`, previous candidates kept with `stale: true`, `cjGeneratedAt` from previous. A CJ failure mid-run → `sources.cj = 'failed: <msg>'`, same stale handling.
- `index.ts`: CLI `run [--dry] [--skip-cj] [--only a,b] [--limit N]`; reads `radar/terms.json`, `data/radar.json`; writes `data/*.json` unless `--dry`; exits 1 when `!ok`; prints a table of terms (label, delta, confidence) and candidates (name, retail, margin, score).

- [ ] **Step 1: Write failing tests** with a fake `http` routed by URL to the fixtures from Tasks 3–6 and a fixed `now`: `a dry run produces both files with 31 terms and every product scored`; `a failed source renormalises weights and is recorded` (Reddit route returns 403 → `sources.reddit` starts with 'failed', confidence of a term drops from high to medium); `skip-cj keeps previous candidates as stale`; `cj candidates carry money, flags, freight and score` (one term routed to the CJ fixtures → one candidate with `money.retailAud` ending in .95, `freight.AU` not null, `cjScope`); `fewer than half the terms with data → ok false`.
- [ ] **Step 2: Run** `npx vitest run radar/test/run.test.ts` — Expected: FAIL
- [ ] **Step 3: Implement `run.ts` and `index.ts`**; then `npm run radar:dry` against the live free sources (no CJ) and read the table; commit the resulting `data/trends.json` and a `data/radar.json` with `candidates: []` and `sources.cj: 'skipped'` as the seed files.
- [ ] **Step 4: Run** `npm test` — Expected: all green, including the earlier suites
- [ ] **Step 5: Commit** `radar: run orchestration, CLI and seed data files`

### Task 10: Draft listings and the approval script

**Files:**
- Create: `radar/src/listing.ts`, `radar/src/listing-cli.ts` (run by the workflow as `npm run listing`), `radar/test/listing.test.ts`, `scripts/merge-listings.mjs`, `src/lib/data.listings.ts` (generated, committed, initially `export const LISTINGS: Product[] = []`)
- Modify: `src/lib/data.ts` (`products = [...catalogue…, ...EXPANSION…, ...LISTINGS]`), `package.json` (`"merge": "node scripts/merge-trends.mjs && node scripts/merge-listings.mjs"`, `"listing": "tsx radar/src/listing-cli.ts"`)

**Interfaces:**
- `listing.ts`: `draftListing(c: Candidate, trend: ProductTrend | null, runDate: string, retailAud: number): Product` per the spec's field list (`id: 'cj-' + pid`, `fulfil: { route: 'supplier', origin: 'CN' }`, `market: 'global'`, `visual: 'device'`, `hue` = stable hash of pid mod 360, `badges: ['From the Radar']`, `specs: [{ group: 'Supplier', rows: [weight, variants, origin] }]`, `facts: { plug: auPlug ? 'AU' : undefined, voltage: '100-240' }`, `rating: null`, `stock: 'in'`, `priceCheckedAt: runDate`, `listedAt: runDate`, `sources: [cjUrl]`, `notes` = flag notes joined).
- `listing-cli.ts`: reads env `ISSUE_NUMBER`, `ISSUE_TITLE`, `ISSUE_BODY`, `ISSUE_AUTHOR`, `REPO_OWNER`; `parseIssue(title, body): { pid: string; vid: string; retailAud: number; termId: string } | null`; refuses (exit 2, prints the reason) when author ≠ owner, body invalid, pid not in `data/radar.json`, or `retailAud < landedAud`; otherwise writes `data/listings/<pid>.json` and prints `LISTING_PATH=…` and `PRODUCT_ID=…` for the workflow's closing comment.
- `merge-listings.mjs`: `data/listings/*.json` → `src/lib/data.listings.ts` exporting `LISTINGS: Product[]` (imports the `Product` type).

- [ ] **Step 1: Write failing tests**: `draftListing makes a Product that passes the catalogue rules` (unique id prefix `cj-`, variants non-empty, price = retail, origin CN, facts.plug AU when auPlug); `parseIssue reads the body and rejects garbage`; `refuses an issue from another user` (author 'mallory', owner 'sykunfts' → exit code 2 via a `decide()` function that returns `{ ok: false, reason }`); `refuses a retail below landed`; `merge-listings produces a module that type-checks` (run the script on a temp dir with one listing, import the output, assert one product).
- [ ] **Step 2: Run** — Expected: FAIL
- [ ] **Step 3: Implement**; wire `LISTINGS` into `data.ts`; run `npm run merge` to generate the empty module.
- [ ] **Step 4: Run** `npm test && npm run typecheck` — Expected: green (catalogue tests still pass with `LISTINGS = []`)
- [ ] **Step 5: Commit** `radar: draft listings, approval script, listings merge`

### Task 11: Real trends in the shop

**Files:**
- Create: `scripts/merge-trends.mjs`, `src/lib/trends.generated.ts` (generated, committed), `src/lib/trends.test.ts`
- Modify: `src/lib/data.ts` (`TREND_NOTE` → `trendNote()` string built from `TRENDS_GENERATED_AT`; `products` apply `TRENDS[p.id]` when present, else keep the sample trend and set `trend.source = 'sample'`), `src/components/Header.tsx` ("Trends: refreshed 4 Oct" / "Trends: sample data" from the same function), `src/components/Home.tsx` (rail "Moving fastest this week" = top 4 by `trend.delta` when any product has a non-sample trend), `src/lib/collections.ts` (blurbs use `trendNote()`), `src/components/Advisor.tsx` (its "taking off" line reads `trend.source`)

**Interfaces:**
- `merge-trends.mjs`: `data/trends.json` → `src/lib/trends.generated.ts` exporting `TRENDS: Record<string, { label; delta; series; source: string }>` (source = `'wikipedia+hackernews+reddit+tiwib'` filtered to the ones that were `ok`) and `TRENDS_GENERATED_AT: string | null`.
- `data.ts`: `export function trendNote(): string` — `Trend figures from <sources joined with ", " and " and ">, refreshed <d Month yyyy>.` when `TRENDS_GENERATED_AT`, else the existing sample sentence. `TREND_NOTE` stays as a constant equal to `trendNote()` so existing imports keep working.

- [ ] **Step 1: Write failing tests** (`trends.test.ts`): `merge-trends writes a module from a trends file` (temp dir; the module exports TRENDS with the product and the date); `a product with a file trend uses it, one without keeps a sample trend marked sample` (mock the generated module with `vi.mock` for one id); `trendNote names the sources and the date when present, sample wording otherwise`; in `app.test.tsx`: `the header shows the refresh date when trends are real` (mock generated module).
- [ ] **Step 2: Run** — Expected: FAIL
- [ ] **Step 3: Implement; run `npm run merge`** so the generated module reflects `data/trends.json` from Task 9.
- [ ] **Step 4: Run** `npm test && npm run typecheck && npm run build` — Expected: green
- [ ] **Step 5: Commit** `shop: real trend figures from the radar, with their date`

### Task 12: The Radar page

**Files:**
- Create: `radar.html`, `src/radar/main.tsx`, `src/radar/RadarApp.tsx`, `src/radar/lib.ts` (pure: `filterCandidates`, `sortCandidates`, `issueUrl`, `rateLabel`, `sourcesLine`), `src/radar/components/RadarHeader.tsx`, `src/radar/components/RadarRail.tsx`, `src/radar/components/CandidateCard.tsx`, `src/radar/components/MoneyStrip.tsx`, `src/radar/components/NoveltyRail.tsx`, `src/radar/lib.test.ts`, `src/radar/radar.test.tsx`, `src/radar/fixtures/radar.sample.json`
- Modify: `vite.config.ts` (inputs `index.html` + `radar.html`; `base` from `GITHUB_PAGES`; singlefile only with `FRAGMENT`), `src/index.css` (nothing new unless a token is missing), `src/components/Header.tsx` (no link to the Radar: it is Nick's tool, not a shop page)

**Interfaces:**
- `lib.ts`:

```ts
export interface RadarFilters { section: string | null; minMargin: 0 | 0.3 | 0.45; exclude: Flag[]; auPlugOnly: boolean; hideSkipped: boolean }
export type RadarSort = 'score' | 'margin' | 'trend' | 'demand' | 'newest'
export function filterCandidates(c: Candidate[], f: RadarFilters, skipped: Set<string>): Candidate[]
export function sortCandidates(c: Candidate[], s: RadarSort): Candidate[]
export function issueUrl(repo: string, c: Candidate): string      // https://github.com/<repo>/issues/new?title=list%3A+<pid>&labels=listing&body=<encoded JSON + sentence>
export function rateLabel(r: Rate): string                         // "A$1.515 per USD, ECB 4 Oct" / "…, previous run" / "…, fallback"
export function sourcesLine(s: RadarFile['sources']): string      // "Wikipedia, Hacker News, TIWIB and CJ fed this run; Reddit: blocked (403)"
```
- `RadarApp` reads `import radar from '../../data/radar.json'` (build-time), keeps filters in state and skipped pids in `localStorage['nexus.radar.skipped']` (try/catch), renders header, rail, list of `CandidateCard` (expand in place), `NoveltyRail`. Card copy: trend chip `"<label> <±delta> %"`, demand `"<listedNum> dropshippers list this"`, money strip `landed → retail → margin`, cheapest AU freight `"<name>, <a>–<b> days, A$<x>"`, `"keyword match"` tag when `cjScope === 'keyword'`, `"new today"` when `firstSeen === generatedAt date`, flags as marks with `title` = note. Empty state: the terms table and the sources line. Stale banner when any candidate is stale: `"CJ data from <cjGeneratedAt>; today's run could not reach CJ."`.
- Visual: the shop's tokens and type; denser grid; the trend chip uses the shop's signal colour; follow the Test Bench spec's reading face for numbers. Use the frontend-design skill's guidance when laying it out; no new fonts.

- [ ] **Step 1: Write failing tests** (`lib.test.ts`): `filterCandidates applies margin, flags, AU plug, section and skipped`; `sortCandidates by each key`; `issueUrl carries the pid and the retail`; `rateLabel and sourcesLine wording` (the three rate sources; Reddit failed). (`radar.test.tsx`, jsdom, with `vi.mock('../../data/radar.json', () => fixture)`): `renders the candidates ranked`; `Skip hides and the toggle shows`; `header shows the rate source`; `keyword-scope candidates say so`; `Add to shop links to a prefilled issue`.
- [ ] **Step 2: Run** — Expected: FAIL
- [ ] **Step 3: Implement the page and the Vite config**; `npm run build` emits `dist/index.html` and `dist/radar.html` (two `rollupOptions.input` entries). The Radar's address is therefore `https://sykunfts.github.io/nexus/radar.html`; use it in the README, the spec's checklist and the listing workflow's closing comment.
- [ ] **Step 4: Run** `npm test && npm run typecheck && npm run build && FRAGMENT=1 npm run build && node scripts/fragment.mjs` — Expected: green; fragment still 1 style, 1 script
- [ ] **Step 5: Commit** `radar: the page`

### Task 13: Workflows, Pages config, README

**Files:**
- Create: `.github/workflows/radar.yml`, `.github/workflows/pages.yml`, `.github/workflows/listing.yml`, `radar/test/workflows.test.ts`
- Modify: `README.md` (Running it; setup checklist; the three addresses), `package.json` description, `docs/superpowers/specs/2026-10-03-trend-radar-design.md` (Radar address `/nexus/radar.html`)

**Interfaces:**
- `radar.yml`: `on: schedule: - cron: '0 20 * * *'`, `workflow_dispatch`; `concurrency: radar`; `permissions: contents: write`; steps: checkout, setup-node 22 with npm cache, `npm ci`, `npm run radar` with `env: CJ_API_KEY: ${{ secrets.CJ_API_KEY }}`, commit `data/*.json` as `Radar: $(date -u +%F)` when changed (git config user `nexus-radar[bot]`), push.
- `pages.yml`: `on: push: branches: [master]`, `workflow_run: workflows: [Trend Radar] types: [completed]`; `permissions: pages: write, id-token: write, contents: read`; steps: checkout, setup-node, `npm ci`, `npm run merge`, `GITHUB_PAGES=1 npm run build`, `actions/configure-pages`, `actions/upload-pages-artifact` (`path: dist`), `actions/deploy-pages`.
- `listing.yml`: `on: issues: types: [opened]`; `if: startsWith(github.event.issue.title, 'list:') && github.event.issue.user.login == github.repository_owner`; `permissions: contents: write, issues: write`; steps: checkout, setup-node, `npm ci`, `npm run listing` with `ISSUE_NUMBER/TITLE/BODY/AUTHOR/REPO_OWNER` from the event, commit `data/listings` as `Listing: <pid> (#<n>)`, push, close the issue with a comment via `gh issue close --comment` using `GITHUB_TOKEN`; on refusal (exit 2) comment the reason and leave the issue open.

- [ ] **Step 1: Write failing test** `workflows.test.ts`: parses the three YAML files with a tiny YAML reader (`js-yaml` devDependency) and asserts: radar cron `0 20 * * *`, env uses `secrets.CJ_API_KEY`, pages triggers on push and workflow_run, listing's `if` contains `github.repository_owner`, every `npm run <x>` referenced exists in `package.json` scripts.
- [ ] **Step 2: Run** — Expected: FAIL (files missing)
- [ ] **Step 3: Write the workflows and the README section**
- [ ] **Step 4: Run** `npm test` — Expected: PASS
- [ ] **Step 5: Commit** `radar: github workflows, pages deploy, readme`

### Task 14: Screenshots and the handover bundle

**Files:**
- Modify: `shot.py` (scenarios `radar-desktop`, `radar-expanded`, `radar-filter-margin`, `radar-mobile` against `dist/radar.html`), `scripts/fragment.mjs` (unchanged; verify)
- Create: `scripts/bundle.sh` (zip the repository including `.git`, excluding `node_modules`, `dist`, `shots`, `.env*`)

- [ ] **Step 1: Add the four scenarios** (desktop 1440×900 asserts ≥ 1 card and the sources line; expanded clicks the first card and asserts the money table; filter sets 45 % and asserts the count ≤ before; mobile 390×820 asserts no horizontal scroll).
- [ ] **Step 2: Run** `npm run build && python3 shot.py` — Expected: exit 0, no horizontal scroll on any shot, crawl 0 dead
- [ ] **Step 3: Look at `shots/radar-desktop.png` and `shots/radar-mobile.png`** with the Read tool; fix layout faults found; re-run.
- [ ] **Step 4: Write `scripts/bundle.sh`**; run it; confirm the zip has no `.env` and has `.git` (`unzip -l`).
- [ ] **Step 5: Commit** `radar: screenshots and handover bundle`
