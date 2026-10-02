# Trend ingestion worker — design

Date: 2026-10-02 · Status: for review · Scope: NEXUS storefront prototype

## Goal

Replace the hand-typed trend numbers in the storefront with scores computed from real, free, terms-of-use-compliant public data, produced by a small worker that runs on a schedule and writes one JSON file the storefront reads.

Success looks like: `npm run ingest` finishes in under two minutes, writes `public/trends.json` with a score for every product in the catalogue, and the published storefront shows those scores (tiles, sparklines, movers board, "Trends refreshed … ago") with no code change per run.

## Non-goals

- No scraping of TikTok, Google Trends, Amazon or any site that forbids it. Paid and keyed sources (YouTube Data API, SerpApi/Glimpse, supplier APIs) are designed for but not built now.
- No database. The output is a file; Postgres `trend_points` arrives with the production backend.
- No merchandising controls (pin, suppress) yet.

## Architecture

```
nexus/
  worker/
    src/
      index.ts          CLI entry: ingest [--dry] [--only wikipedia,reddit,hackernews]
      types.ts          Source, DailySeries, ProductScore, TrendsFile
      terms.ts          per-product search terms, Wikipedia article, mover label
      sources/
        wikipedia.ts    Wikimedia REST pageviews, per article, daily
        hackernews.ts   HN Algolia search_by_date, story points per term, daily
        reddit.ts       reddit.com/search.json, posts per term, daily
      fetch.ts          fetch with timeout, retry, spacing, User-Agent
      score.ts          growth, normalisation, weighting, labels, series, movers
      write.ts          atomic write of trends.json, keeps last good file
    test/
      fixtures/*.json   recorded responses
      sources.test.ts   each adapter against its fixture
      score.test.ts     scoring against hand-checked numbers
  public/trends.json    the output (served by Vite; published next to the page)
  src/lib/trends.ts     storefront loader + hook
  .github/workflows/ingest.yml   daily run, commits the JSON
```

The worker is TypeScript on Node 22, run with `tsx`, tested with `vitest`. It shares the catalogue (`src/lib/data.ts`) so product ids stay in one place.

## Data contract

### Source adapter

```ts
interface Source {
  id: 'wikipedia' | 'hackernews' | 'reddit'
  weight: number                         // 0.40, 0.25, 0.35
  floor: number                          // minimum prior-week volume used in growth maths
  fetchDaily(product: ProductTerms, days: 14): Promise<DailySeries | null>
}
type DailySeries = { source: Source['id']; days: { date: string; value: number }[] } // 14 days, oldest first, ending yesterday (UTC)
```

`null` means the source had nothing usable for that product (no article, zero hits, request failed after retries). It is not an error.

### Per-product terms (`terms.ts`)

| Product | Wikipedia article | Search terms | Mover label |
| --- | --- | --- | --- |
| beam-4k | Video projector | laser projector, portable projector | Laser projectors |
| beam-mini | Handheld projector | mini projector, pocket projector | Pocket projectors |
| loop-ring | Smart ring | smart ring, sleep tracking ring | Smart rings |
| aether-magpack | Solar charger | solar power bank, magsafe power bank | Solar power banks |
| specs-air | Smartglasses | smart glasses, AI glasses | Smart glasses |
| nimbus-orbit | IP camera | indoor security camera, matter camera | Indoor cameras |
| nimbus-glow | LED strip light | LED strip lights, smart light strip | Smart light strips |
| drift-one | Electric kick scooter | electric scooter, e-scooter | E-scooters |
| pulse-open | Open-ear headphones | open ear earbuds, clip on earbuds | Open-ear buds |
| echo-pin | Voice recorder | AI voice recorder, AI note taker | AI recorders |
| flux-mini | 3D printing | desktop 3D printer, mini 3D printer | Desk 3D printers |
| nimbus-robo | Robotic vacuum cleaner | robot vacuum, robot mop | Robot vacuums |
| luma-mask | Light therapy | LED face mask, red light mask | LED masks |
| halo-screen | Projection screen | ALR projector screen, projector screen | Projector screens |
| aether-cube-100 | GaN charger | GaN charger, 100W charger | GaN chargers |
| snap-tag | Bluetooth tracker | bluetooth tracker, item tracker | Finder tags |
| nimbus-hub | Matter (standard) | matter hub, thread border router | Matter hubs |
| snap-case | MagSafe | magsafe case android, magnetic phone case | Magnetic cases |
| plug-adapter | AC power plugs and sockets | travel adapter | Travel adapters |

Terms are plain, generic phrases. No real brand or product names, so no competitor's product is measured by accident.

### Output (`trends.json`)

```json
{
  "generatedAt": "2026-10-02T20:03:11Z",
  "window": { "days": 14, "from": "2026-09-18", "to": "2026-10-01" },
  "sources": { "wikipedia": "ok", "hackernews": "ok", "reddit": "failed: 429 after 3 tries" },
  "products": {
    "loop-ring": {
      "delta": 212, "label": "Viral", "score": 1.83, "confidence": "high",
      "series": [8, 9, 12, 15, 22, 30, 38, 61],
      "sources": { "wikipedia": { "last7": 18234, "prior7": 6102, "growth": 1.99 }, "hackernews": { "last7": 41, "prior7": 12, "growth": 2.42 }, "reddit": null }
    }
  },
  "movers": [{ "productId": "luma-mask", "label": "LED masks", "delta": 310 }]
}
```

`delta` is a whole-number percent; `score` is the normalised rank score; `series` is eight integers 0–100.

## Scoring

For each product and each source that returned a series:

1. `last7` = sum of days 8–14 (the most recent week); `prior7` = sum of days 1–7.
2. `growth = (last7 − prior7) / max(prior7, floor)`. Floors: Wikipedia 50 views, Hacker News 5 points, Reddit 5 posts. The floor stops a term going from 1 to 4 hits reading as +300 %.
3. Per source, across all products: `z = (growth − mean) / max(sd, 0.1)`.

Per product:

- `score = Σ weight_s × z_s` over the sources that returned data, with weights renormalised to sum to 1.
- `delta = round(100 × Σ weight_s × growth_s)` with the same renormalised weights, clamped to [−90, 999].
- `label`: Viral when delta ≥ 200, Trending ≥ 100, Rising ≥ 50, otherwise Steady (the thresholds already in the spec doc).
- `series`: for each of the last 8 days, `Σ weight_s × (value_s,day / mean14_s)`, then scaled so the maximum across the 8 points is 100. Shows shape, not magnitude.
- `confidence`: high with three sources, medium with two, low with one, none with zero.

`movers` = the six products with the highest `delta` and confidence of at least low, one per mover label, carrying the label and delta.

## Storefront integration

- `src/lib/trends.ts` exports `loadTrends()` (fetches `trends.json` relative to the page with `cache: 'no-store'`, 4-second timeout) and `useTrend(product)` which returns the file's score for that product or the product's inline `trend` as the fallback.
- `App.tsx` calls `loadTrends()` once on mount and puts the result in the store (`trends: TrendsFile | null`).
- `ProductCard`, `ProductPage`, `MegaMenu`, `PredictiveSearch`, `QuickView` and the Trend Scout read through `useTrend`.
- `Home` builds the movers board from `trends.movers` when present, else from the inline list.
- `Header` shows "Trends refreshed 3 h ago" from `generatedAt`; "Trends: sample data" when the file is absent.

The file is served by Vite from `public/` in development and published next to the page as a supporting file for the artifact, where a relative fetch is allowed.

## Running it

- `npm run ingest` runs all sources and writes the file. `--dry` prints a table and writes nothing. `--only reddit` limits sources.
- `.github/workflows/ingest.yml`: cron `0 20 * * *` (06:00 Sydney in winter, 07:00 in summer), Node 22, `npm ci`, `npm run ingest`, commit `public/trends.json` when it changed. Manual trigger enabled.
- Future adapters follow the same `Source` interface and switch on by environment variable: `YOUTUBE_API_KEY`, `SERPAPI_KEY`, `CJ_API_KEY`.

## Error handling

- Every request: 15 s timeout, two retries with 2 s and 6 s backoff, 300 ms spacing between requests to the same host, User-Agent `NexusTrendWorker/0.1 (+https://nexus.store)`. Wikipedia and Reddit refuse requests without a User-Agent.
- A failing source is recorded in `sources` and skipped; the product's confidence drops.
- If fewer than half the products received any data, the worker exits with code 1 and does not overwrite the previous file (the last good file stays).
- The write is atomic (write to a temp file, rename).

## Testing

- `sources.test.ts`: each adapter parses a recorded fixture into a 14-day series with the right dates and totals, and returns `null` on an empty or error response.
- `score.test.ts`: growth with and without the floor, z-normalisation, weight renormalisation when a source is missing, labels at the thresholds, series scaling, movers uniqueness by label.
- Manual: `npm run ingest -- --dry` against the live APIs before the first commit of `trends.json`.

## Decisions taken

- Growth is week-over-week on a 14-day window; the storefront copy already says "7-day change".
- Hacker News counts story points, not story count, because one strong story is a better trend signal than ten dead ones.
- Reddit uses site-wide search rather than a subreddit list, so a product that trends in an unexpected community still counts.
- Numbers from the file are shown as interest growth, never as sales.
