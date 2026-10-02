# Trend Ingestion Worker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A scheduled TypeScript worker that scores every catalogue product from Wikipedia, Hacker News and Reddit public data and writes `public/trends.json`, which the storefront reads instead of its hard-coded trend numbers.

**Architecture:** `worker/` holds three source adapters behind one `Source` interface, a pure scoring module, and a CLI that writes the file atomically. The storefront gains `src/lib/trends.ts` (fetch + fallback) and a `trends` slot in the Zustand store; components read scores through `useTrend(product)`. A GitHub Actions cron runs the worker daily and commits the JSON.

**Tech Stack:** Node 22, TypeScript (strict), `tsx` to run, `vitest` to test, native `fetch`. No new runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-10-02-trend-ingestion-worker-design.md`

## Global Constraints

- Node 22; TypeScript strict; ESM (`"type": "module"` is already set).
- Sources: Wikipedia pageviews REST, Hacker News Algolia API, reddit.com `search.json` only. No other hosts.
- Every request: 15 s timeout, 2 retries with 2 s then 6 s backoff, 300 ms spacing per host, header `User-Agent: NexusTrendWorker/0.1 (+https://nexus.store)`.
- Window: 14 days ending yesterday (UTC); `last7` = days 8–14, `prior7` = days 1–7.
- Weights: wikipedia 0.40, reddit 0.35, hackernews 0.25. Floors: wikipedia 50, hackernews 5, reddit 5.
- `delta` clamped to [−90, 999]; labels Viral ≥ 200, Trending ≥ 100, Rising ≥ 50, else Steady; z-score sd floor 0.1.
- `series` = 8 integers 0–100, max scaled to 100. `movers` = 6, unique by mover label, confidence ≥ low.
- Worker exits 1 and leaves the previous file untouched when fewer than half the products received any data. Writes are atomic (temp file + rename).
- Search terms are generic phrases; no brand or product names.
- Output path `public/trends.json`; the storefront fetches it by the relative URL `trends.json`.

## Review Focus

1. Wikipedia titles with spaces or parentheses ("Matter (standard)", "AC power plugs and sockets") must be URL-encoded or the request 404s. Test in Task 3.
2. The Wikipedia API omits days with zero views; a series must still be 14 dated points aligned to the window, with zeros filled in. Test in Task 3.
3. A source where every product has the same growth gives sd = 0; the 0.1 floor must produce z = 0 for all, not NaN. Test in Task 6.
4. Reddit sometimes answers a 200 with an HTML block page; a non-JSON body must become `null`, not a crash. Test in Task 5.
5. In the published artifact `trends.json` may be missing or stale; the storefront must render the inline numbers and say "sample data", and an invalid `generatedAt` must not throw. Test in Task 8.

---

### Task 1: Worker scaffold, types and terms

**Files:**
- Create: `worker/src/types.ts`, `worker/src/terms.ts`, `worker/tsconfig.json`, `worker/test/terms.test.ts`
- Modify: `package.json` (scripts `ingest`, `test`; devDependencies `tsx`, `vitest`), `tsconfig.json` (`include` adds `worker`)

**Interfaces:**
- Produces, in `types.ts`:
  ```ts
  export type SourceId = 'wikipedia' | 'hackernews' | 'reddit'
  export interface DailyPoint { date: string; value: number }          // date = YYYY-MM-DD (UTC)
  export interface DailySeries { source: SourceId; days: DailyPoint[] }  // exactly 14, oldest first
  export interface ProductTerms { id: string; article: string; terms: string[]; moverLabel: string }
  export interface Source { id: SourceId; weight: number; floor: number; fetchDaily(product: ProductTerms, window: Window): Promise<DailySeries | null> }
  export interface Window { days: 14; from: string; to: string; dates: string[] }   // dates = the 14 YYYY-MM-DD strings
  export type Confidence = 'high' | 'medium' | 'low' | 'none'
  export type Label = 'Viral' | 'Trending' | 'Rising' | 'Steady'
  export interface SourceBreakdown { last7: number; prior7: number; growth: number }
  export interface ProductScore { delta: number; label: Label; score: number; confidence: Confidence; series: number[]; sources: Partial<Record<SourceId, SourceBreakdown | null>> }
  export interface TrendsFile { generatedAt: string; window: { days: 14; from: string; to: string }; sources: Record<SourceId, string>; products: Record<string, ProductScore>; movers: { productId: string; label: string; delta: number }[] }
  export function makeWindow(today?: Date): Window   // 14 dates ending yesterday UTC
  ```
- Produces, in `terms.ts`: `export const TERMS: ProductTerms[]` holding the 19 rows of the spec's terms table verbatim.

- [ ] **Step 1: Install dev tools and add scripts**

Run: `npm install -D tsx@4 vitest@2` then set in `package.json`: `"ingest": "tsx worker/src/index.ts"`, `"test": "vitest run"`. Add `"worker"` to `tsconfig.json` `include`. Create `worker/tsconfig.json` extending the root with `"module": "ESNext", "types": ["node"]` and install `@types/node@22`.

- [ ] **Step 2: Write the failing tests** in `worker/test/terms.test.ts`

```ts
import { products } from '../../src/lib/data'
import { TERMS } from '../src/terms'
import { makeWindow } from '../src/types'

test('every catalogue product has terms', () => {
  const ids = new Set(TERMS.map((t) => t.id))
  for (const p of products) expect(ids.has(p.id)).toBe(true)
  expect(TERMS.length).toBe(products.length)
})
test('each row has an article, 1 to 4 terms and a mover label', () => {
  for (const t of TERMS) {
    expect(t.article.length).toBeGreaterThan(0)
    expect(t.terms.length).toBeGreaterThanOrEqual(1)
    expect(t.terms.length).toBeLessThanOrEqual(4)
    expect(t.moverLabel.length).toBeGreaterThan(0)
  }
})
test('makeWindow gives 14 dates ending yesterday UTC', () => {
  const w = makeWindow(new Date('2026-10-02T09:00:00Z'))
  expect(w.dates.length).toBe(14)
  expect(w.from).toBe('2026-09-18')
  expect(w.to).toBe('2026-10-01')
  expect(w.dates[13]).toBe('2026-10-01')
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run worker/test/terms.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 4: Implement `types.ts` (interfaces above and `makeWindow`) and `terms.ts` (the spec table)**

`makeWindow` uses UTC date arithmetic only; never `toLocaleDateString`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run worker/test/terms.test.ts`
Expected: 3 passed.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json tsconfig.json worker
git commit -m "feat(worker): scaffold, types, window and per-product terms"
```

---

### Task 2: HTTP helper with timeout, retry, spacing and User-Agent

**Files:**
- Create: `worker/src/fetch.ts`, `worker/test/fetch.test.ts`

**Interfaces:**
- Produces: `export async function fetchJson<T>(url: string, opts?: { fetchImpl?: typeof fetch; timeoutMs?: number; retries?: number; backoffMs?: number[]; spacingMs?: number }): Promise<{ ok: true; data: T } | { ok: false; status: number; reason: string }>` with defaults `timeoutMs 15000`, `retries 2`, `backoffMs [2000, 6000]`, `spacingMs 300`. Spacing is per host, tracked in a module-level map. A non-JSON body returns `{ ok: false, status, reason: 'not json' }`. Tests inject `fetchImpl` and pass `backoffMs: [0, 0], spacingMs: 0`.

- [ ] **Step 1: Write the failing tests** in `worker/test/fetch.test.ts`

```ts
test('sends the User-Agent and parses JSON', async () => {
  const calls: RequestInit[] = []
  const fetchImpl = (async (_u: string, init: RequestInit) => { calls.push(init); return new Response('{"a":1}', { status: 200 }) }) as typeof fetch
  const r = await fetchJson<{ a: number }>('https://x.test/a', { fetchImpl, spacingMs: 0 })
  expect(r).toEqual({ ok: true, data: { a: 1 } })
  expect((calls[0].headers as Record<string, string>)['User-Agent']).toBe('NexusTrendWorker/0.1 (+https://nexus.store)')
})
test('retries twice on 500 then succeeds', async () => {
  let n = 0
  const fetchImpl = (async () => new Response(n++ < 2 ? 'x' : '{"ok":true}', { status: n <= 2 ? 500 : 200 })) as typeof fetch
  const r = await fetchJson('https://x.test/b', { fetchImpl, backoffMs: [0, 0], spacingMs: 0 })
  expect(r.ok).toBe(true); expect(n).toBe(3)
})
test('gives up after two retries with the last status', async () => {
  const fetchImpl = (async () => new Response('', { status: 429 })) as typeof fetch
  const r = await fetchJson('https://x.test/c', { fetchImpl, backoffMs: [0, 0], spacingMs: 0 })
  expect(r).toEqual({ ok: false, status: 429, reason: '429 after 3 tries' })
})
test('a 200 with a non-JSON body is not ok', async () => {
  const fetchImpl = (async () => new Response('<html>blocked</html>', { status: 200 })) as typeof fetch
  const r = await fetchJson('https://x.test/d', { fetchImpl, spacingMs: 0 })
  expect(r).toEqual({ ok: false, status: 200, reason: 'not json' })
})
test('times out', async () => {
  const fetchImpl = ((_u: string, init: RequestInit) => new Promise((_, rej) => init.signal!.addEventListener('abort', () => rej(new Error('aborted'))))) as unknown as typeof fetch
  const r = await fetchJson('https://x.test/e', { fetchImpl, timeoutMs: 20, retries: 0, spacingMs: 0 })
  expect(r.ok).toBe(false); expect((r as { reason: string }).reason).toMatch(/timeout/)
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run worker/test/fetch.test.ts` — Expected: FAIL, module not found.

- [ ] **Step 3: Implement `fetchJson` in `worker/src/fetch.ts`**

AbortController for the timeout; retry on network error, timeout, or status ≥ 500 or 429; do not retry on 404; spacing waits so consecutive calls to the same host are ≥ `spacingMs` apart.

- [ ] **Step 4: Run tests to verify they pass** — Run: `npx vitest run worker/test/fetch.test.ts` — Expected: 5 passed.

- [ ] **Step 5: Commit** — `git add worker && git commit -m "feat(worker): fetchJson with timeout, retry, spacing and UA"`

---

### Task 3: Wikipedia pageviews adapter

**Files:**
- Create: `worker/src/sources/wikipedia.ts`, `worker/test/fixtures/wikipedia-smart-ring.json`, `worker/test/sources.wikipedia.test.ts`

**Interfaces:**
- Produces: `export const wikipedia: Source` (`id 'wikipedia'`, `weight 0.4`, `floor 50`) and `export function wikipediaUrl(article: string, w: Window): string` returning `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/${encodeURIComponent(article.replace(/ /g, '_'))}/daily/${w.from.replace(/-/g, '')}/${w.to.replace(/-/g, '')}`.
- Consumes: `fetchJson` (Task 2) via an injectable `fetchImpl` on a module-level `setFetch(fn)` used only by tests, or by passing through `globalThis.fetch` by default.

- [ ] **Step 1: Record a fixture**

Run once: `curl -s -H 'User-Agent: NexusTrendWorker/0.1 (+https://nexus.store)' "https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/Smart_ring/daily/20260918/20261001" > worker/test/fixtures/wikipedia-smart-ring.json`. Then delete two middle days from the fixture by hand so the zero-fill path is exercised (note which dates in a `_note` key the parser ignores).

- [ ] **Step 2: Write the failing tests**

```ts
test('builds an encoded URL for titles with spaces and parentheses', () => {
  const w = makeWindow(new Date('2026-10-02T00:00:00Z'))
  expect(wikipediaUrl('Matter (standard)', w)).toBe('https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/Matter_(standard)/daily/20260918/20261001')
  expect(wikipediaUrl('AC power plugs and sockets', w)).toContain('/AC_power_plugs_and_sockets/')
})
test('parses the fixture into 14 dated points with zeros for missing days', async () => {
  setFetch(async () => new Response(fs.readFileSync('worker/test/fixtures/wikipedia-smart-ring.json', 'utf8'), { status: 200 }))
  const s = await wikipedia.fetchDaily(TERMS.find((t) => t.id === 'loop-ring')!, makeWindow(new Date('2026-10-02T00:00:00Z')))
  expect(s!.days.length).toBe(14)
  expect(s!.days[0].date).toBe('2026-09-18')
  expect(s!.days.filter((d) => d.value === 0).length).toBe(2)
  expect(s!.days.reduce((n, d) => n + d.value, 0)).toBeGreaterThan(0)
})
test('returns null on 404', async () => {
  setFetch(async () => new Response('{"type":"not_found"}', { status: 404 }))
  expect(await wikipedia.fetchDaily(TERMS[0], makeWindow())).toBeNull()
})
```

- [ ] **Step 3: Run tests to verify they fail** — Run: `npx vitest run worker/test/sources.wikipedia.test.ts` — Expected: FAIL.

- [ ] **Step 4: Implement the adapter**

Map `items[].timestamp` (`YYYYMMDD00`) to `YYYY-MM-DD`; build the 14-day series from `window.dates`, defaulting missing days to 0. `null` on any non-ok result.

- [ ] **Step 5: Run tests to verify they pass** — Expected: 3 passed.

- [ ] **Step 6: Commit** — `git commit -am "feat(worker): wikipedia pageviews adapter"` (add the fixture too).

---

### Task 4: Hacker News adapter

**Files:**
- Create: `worker/src/sources/hackernews.ts`, `worker/test/fixtures/hn-smart-ring.json`, `worker/test/sources.hackernews.test.ts`

**Interfaces:**
- Produces: `export const hackernews: Source` (`id 'hackernews'`, `weight 0.25`, `floor 5`) and `export function hnUrl(term: string, w: Window): string` = `https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent(term)}&tags=story&hitsPerPage=1000&numericFilters=created_at_i>${fromEpoch},created_at_i<${toEpochExclusive}` where `fromEpoch` is 00:00 UTC of `w.from` and `toEpochExclusive` is 00:00 UTC of the day after `w.to`.
- One request per term; a product's series is the day-by-day sum of `points` of all hits across its terms (a story matching two terms counts once, de-duplicated by `objectID`).

- [ ] **Step 1: Record a fixture** — `curl -s "$(hnUrl for 'smart ring')" > worker/test/fixtures/hn-smart-ring.json` (build the URL by hand from the formula).

- [ ] **Step 2: Write the failing tests**

```ts
test('sums story points per UTC day and de-duplicates across terms', async () => {
  setFetch(async () => new Response(fs.readFileSync('worker/test/fixtures/hn-smart-ring.json', 'utf8'), { status: 200 }))
  const s = await hackernews.fetchDaily({ id: 'x', article: '', terms: ['smart ring', 'sleep tracking ring'], moverLabel: '' }, makeWindow(new Date('2026-10-02T00:00:00Z')))
  expect(s!.days.length).toBe(14)
  const fixture = JSON.parse(fs.readFileSync('worker/test/fixtures/hn-smart-ring.json', 'utf8'))
  const expectedTotal = fixture.hits.reduce((n: number, h: { points: number }) => n + (h.points ?? 0), 0)
  expect(s!.days.reduce((n, d) => n + d.value, 0)).toBe(expectedTotal)   // same fixture served for both terms → de-dup keeps it once
})
test('returns null when every term has zero hits', async () => {
  setFetch(async () => new Response('{"hits":[],"nbHits":0}', { status: 200 }))
  expect(await hackernews.fetchDaily(TERMS[0], makeWindow())).toBeNull()
})
```

- [ ] **Step 3: Run tests to verify they fail**, **Step 4: Implement**, **Step 5: Run to verify they pass** (2 passed), **Step 6: Commit** `feat(worker): hacker news adapter`.

---

### Task 5: Reddit adapter

**Files:**
- Create: `worker/src/sources/reddit.ts`, `worker/test/fixtures/reddit-smart-ring.json`, `worker/test/sources.reddit.test.ts`

**Interfaces:**
- Produces: `export const reddit: Source` (`id 'reddit'`, `weight 0.35`, `floor 5`) and `export function redditUrl(term: string): string` = `https://www.reddit.com/search.json?q=${encodeURIComponent(term)}&sort=new&t=month&limit=100&raw_json=1`.
- A product's series is the count of posts per UTC day (`data.children[].data.created_utc`) within the window, de-duplicated by post `id` across terms; posts outside the window are ignored.

- [ ] **Step 1: Record a fixture** — `curl -s -H 'User-Agent: NexusTrendWorker/0.1 (+https://nexus.store)' "https://www.reddit.com/search.json?q=smart%20ring&sort=new&t=month&limit=100&raw_json=1" > worker/test/fixtures/reddit-smart-ring.json`. If Reddit refuses from this network, write a 12-post fixture by hand with the real response shape and say so in a `_note` key.

- [ ] **Step 2: Write the failing tests**

```ts
test('counts posts per day inside the window and ignores the rest', async () => { /* fixture with known dates; assert days.length 14 and the total equals the in-window post count */ })
test('returns null on 429', async () => { setFetch(async () => new Response('', { status: 429 })); expect(await reddit.fetchDaily(TERMS[0], makeWindow())).toBeNull() })
test('returns null on an HTML block page with status 200', async () => { setFetch(async () => new Response('<html>blocked</html>', { status: 200 })); expect(await reddit.fetchDaily(TERMS[0], makeWindow())).toBeNull() })
```

- [ ] **Step 3: Run to verify they fail**, **Step 4: Implement**, **Step 5: Run to verify they pass** (3 passed), **Step 6: Commit** `feat(worker): reddit adapter`.

---

### Task 6: Scoring

**Files:**
- Create: `worker/src/score.ts`, `worker/test/score.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export function growth(series: DailySeries, floor: number): SourceBreakdown        // last7 = days 7..13, prior7 = days 0..6
  export function zScores(values: number[]): number[]                                 // sd floor 0.1
  export function labelFor(delta: number): Label
  export function seriesFor(bySource: Partial<Record<SourceId, DailySeries>>, weights: Record<SourceId, number>): number[]   // 8 ints, max 100
  export function scoreProducts(input: Record<string, Partial<Record<SourceId, DailySeries | null>>>, sources: Pick<Source, 'id' | 'weight' | 'floor'>[]): Record<string, ProductScore>
  export function pickMovers(scores: Record<string, ProductScore>, terms: ProductTerms[]): TrendsFile['movers']
  ```

- [ ] **Step 1: Write the failing tests**

```ts
const days = (vals: number[]): DailySeries => ({ source: 'wikipedia', days: vals.map((v, i) => ({ date: `2026-09-${String(18 + i).padStart(2, '0')}`, value: v })) })
test('growth uses the floor', () => {
  expect(growth(days([1,1,1,1,1,1,1, 4,4,4,4,4,4,4]), 50)).toEqual({ last7: 28, prior7: 7, growth: (28 - 7) / 50 })
  expect(growth(days([100,100,100,100,100,100,100, 200,200,200,200,200,200,200]), 50).growth).toBeCloseTo(1)
})
test('zScores floors the sd', () => { expect(zScores([2, 2, 2])).toEqual([0, 0, 0]); expect(zScores([0, 2])[1]).toBeCloseTo(1) })
test('labels at the thresholds', () => { expect(labelFor(200)).toBe('Viral'); expect(labelFor(199)).toBe('Trending'); expect(labelFor(100)).toBe('Trending'); expect(labelFor(50)).toBe('Rising'); expect(labelFor(49)).toBe('Steady') })
test('weights renormalise when a source is missing and delta is clamped', () => {
  const s = scoreProducts({ a: { wikipedia: days([10,10,10,10,10,10,10, 110,110,110,110,110,110,110]), reddit: null }, b: { wikipedia: days([10,10,10,10,10,10,10, 10,10,10,10,10,10,10]) } },
    [{ id: 'wikipedia', weight: 0.4, floor: 50 }, { id: 'reddit', weight: 0.35, floor: 5 }])
  expect(s.a.delta).toBe(999)              // growth 700/70 = 10 → 1000 % → clamped
  expect(s.a.confidence).toBe('low'); expect(s.b.label).toBe('Steady'); expect(s.a.sources.reddit).toBeNull()
})
test('series is 8 points scaled to 100', () => {
  const out = seriesFor({ wikipedia: days([1,1,1,1,1,1,1,1,1,1,2,3,4,5]) }, { wikipedia: 1, reddit: 0, hackernews: 0 })
  expect(out.length).toBe(8); expect(Math.max(...out)).toBe(100); out.forEach((v) => expect(Number.isInteger(v)).toBe(true))
})
test('movers are six, unique by label, confidence at least low', () => { /* 8 scored products, two sharing a mover label, one with confidence none → expect 6 movers, labels unique, the none-confidence one absent, sorted by delta desc */ })
```

- [ ] **Step 2: Run to verify they fail**, **Step 3: Implement `score.ts`** (pure functions, no I/O), **Step 4: Run to verify they pass** (6 passed), **Step 5: Commit** `feat(worker): scoring`.

---

### Task 7: Writer and CLI, first real run

**Files:**
- Create: `worker/src/write.ts`, `worker/src/index.ts`, `worker/test/write.test.ts`, `public/trends.json` (output of the first run)

**Interfaces:**
- Produces: `export async function writeTrends(file: TrendsFile, path: string): Promise<void>` (write `${path}.tmp`, then `fs.rename`), and `export async function runIngest(opts: { dry: boolean; only?: SourceId[]; sources?: Source[]; out?: string; now?: Date }): Promise<{ file: TrendsFile; coverage: number; exitCode: 0 | 1 }>` where `coverage` = share of products with ≥ 1 series.
- CLI: `tsx worker/src/index.ts [--dry] [--only a,b]`; prints a table (id, delta, label, confidence) and the per-source status; exits with `exitCode`.

- [ ] **Step 1: Write the failing tests**

```ts
test('dry run writes nothing', async () => { /* fake sources returning series; out = tmp path; expect fs.existsSync(out) false and file.products has every id */ })
test('low coverage exits 1 and keeps the previous file', async () => { /* write a sentinel file; fake sources returning null for all; expect exitCode 1 and the sentinel unchanged */ })
test('writeTrends is atomic', async () => { /* after write, no .tmp remains and JSON parses with generatedAt */ })
```

- [ ] **Step 2: Run to verify they fail**, **Step 3: Implement**, **Step 4: Run to verify they pass** (3 passed).

- [ ] **Step 5: Live dry run** — Run: `npm run ingest -- --dry` — Expected: a 19-row table, each source `ok` or a reason; coverage ≥ 0.5. If Reddit fails from this network, that is acceptable; note it.

- [ ] **Step 6: Real run** — Run: `npm run ingest` — Expected: `public/trends.json` exists, `products` has 19 keys, `movers` has 6.

- [ ] **Step 7: Commit** — `git add worker public/trends.json && git commit -m "feat(worker): writer, CLI and first trends.json"`

---

### Task 8: Storefront reads the file

**Files:**
- Create: `src/lib/trends.ts`, `worker/test/trends-loader.test.ts`
- Modify: `src/lib/store.ts` (add `trends: TrendsFile | null`, `setTrends`), `src/App.tsx` (call `loadTrends()` on mount), `src/components/ProductCard.tsx`, `src/components/ProductPage.tsx`, `src/components/MegaMenu.tsx`, `src/components/PredictiveSearch.tsx`, `src/components/QuickView.tsx`, `src/components/Advisor.tsx` (read via `useTrend`), `src/components/Home.tsx` (movers from file), `src/components/Header.tsx` (refreshed text)

**Interfaces:**
- Produces, in `src/lib/trends.ts`:
  ```ts
  export type { TrendsFile } from '../../worker/src/types'
  export async function loadTrends(fetchImpl?: typeof fetch): Promise<TrendsFile | null>   // GET 'trends.json', cache 'no-store', 4 s timeout, null on any failure or invalid shape
  export function trendFor(file: TrendsFile | null, product: Product): Trend                 // file score mapped to the catalogue Trend shape, else product.trend
  export function refreshedText(generatedAt: string | undefined, now?: Date): string        // 'Trends refreshed 3 h ago' | 'Trends: sample data' (absent or unparsable)
  export function useTrend(product: Product): Trend                                          // reads store.trends, calls trendFor
  ```

- [ ] **Step 1: Write the failing tests** in `worker/test/trends-loader.test.ts`

```ts
test('loadTrends returns null on 404 and on a non-object body', async () => { /* two fetchImpl stubs */ })
test('trendFor maps a file score and falls back to the inline trend', () => { /* file with beam-4k delta 55 label Rising series of 8 → expect trend.delta 55; product not in file → expect product.trend */ })
test('refreshedText', () => {
  expect(refreshedText(undefined)).toBe('Trends: sample data')
  expect(refreshedText('not a date')).toBe('Trends: sample data')
  expect(refreshedText('2026-10-02T06:00:00Z', new Date('2026-10-02T09:10:00Z'))).toBe('Trends refreshed 3 h ago')
  expect(refreshedText('2026-10-02T09:05:00Z', new Date('2026-10-02T09:10:00Z'))).toBe('Trends refreshed 5 min ago')
})
```

- [ ] **Step 2: Run to verify they fail**, **Step 3: Implement `trends.ts`, the store slot, and switch each listed component from `product.trend` to `useTrend(product)`; `Home` uses `trends?.movers ?? trendTape.slice(0, 6)` mapped to `{ label, delta }`; `Header` shows `refreshedText(trends?.generatedAt)`**, **Step 4: Run to verify they pass** (3 passed) and `npx tsc -p tsconfig.json` is clean.

- [ ] **Step 5: Build and look** — Run: `npx vite build` and the screenshot script; the movers board and tiles must show the file's numbers (compare one product's delta to `public/trends.json`), and the header must read "Trends refreshed …".

- [ ] **Step 6: Commit** — `git commit -am "feat(storefront): read trends.json with inline fallback"`

---

### Task 9: Schedule and docs

**Files:**
- Create: `.github/workflows/ingest.yml`
- Modify: `README.md` (worker section: run, schedule, adding a keyed source)

- [ ] **Step 1: Write the workflow** — `on: schedule: cron '0 20 * * *'` and `workflow_dispatch`; `actions/checkout`, `actions/setup-node` with `node-version: 22` and npm cache, `npm ci`, `npm run ingest`, then commit `public/trends.json` with `git diff --quiet || (git config user.name "nexus-trend-worker" && git config user.email "worker@nexus.store" && git commit -am "chore: refresh trends.json" && git push)`. Permissions: `contents: write`.

- [ ] **Step 2: Validate** — Run: `npx js-yaml .github/workflows/ingest.yml > /dev/null` (install `js-yaml` as a dev dependency if absent) — Expected: no error.

- [ ] **Step 3: README** — add "Trend worker" with the three commands, the schedule, the exit-code rule, and how a `YOUTUBE_API_KEY` adapter would plug in (same `Source` interface, registered in `index.ts` when the env var is set).

- [ ] **Step 4: Commit** — `git commit -am "chore: daily ingest workflow and worker docs"`

---

### Task 10: Publish

**Files:**
- Modify: the published artifact (same URL) with `trends.json` as a supporting file; refresh the source zip in outputs.

- [ ] **Step 1: Extract the page fragment as before and publish with `files: { "trends.json": "public/trends.json" }`.**
- [ ] **Step 2: Open the live page and confirm the header reads "Trends refreshed …" and a product tile matches the JSON.**
- [ ] **Step 3: Zip the project (without `node_modules`, `dist`) to outputs and send it.**
