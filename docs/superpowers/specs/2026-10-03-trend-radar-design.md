# Trend Radar — design

Date: 3 October 2026 · Status: approved in conversation · Scope: Build 3 of NEXUS (supersedes `2026-10-02-trend-ingestion-worker-design.md`, whose scoring and source adapters it keeps)

## Goal

Give Nick a tool that finds tech products worth listing, advertising and dropshipping from China, with real numbers behind each candidate: what is trending, what CJdropshipping can supply, what it costs to land in Australia, and what the margin is at a sensible retail price. Approving a candidate puts a draft listing into the shop. The same signals replace the shop's sample trend figures.

Success looks like: a GitHub Action runs every morning without anyone touching it, writes `data/radar.json` and `data/trends.json`, and publishes the shop and the Radar page to GitHub Pages. Nick opens the Radar, sees ranked candidates with cost, margin, freight, flags and the reason each is there, and can add one to the shop with two clicks. The shop shows "Trends from Wikipedia, Hacker News and Reddit, refreshed <date>" instead of "sample data".

## Decisions already taken (from the conversation)

- Build 3 is the Radar with the trend worker folded in; the trend worker is not a separate build.
- Runs on GitHub Actions, fully unattended. Repository `sykunfts/nexus`, public, free GitHub Pages.
- The CJ API key lives only in the repository's Actions secret `CJ_API_KEY` and in Nick's local `.env`. It is never in the repository, the built site, or the claude.ai artifact.
- The claude.ai artifact stays as a preview that Claude republishes on request; GitHub Pages is the site that updates itself.
- Later phases, written down and not built: real payment and pushing orders to CJ (Build 5); then the membership where other people use the Radar and order through Nexus.

## Non-goals

- No scraping of TikTok, Google Trends, Amazon or any site that forbids it. No paid sources.
- No database. Files in the repository are the record.
- No CJ order placement, no payment, no accounts for anyone but Nick's GitHub login.
- No copying of This Is Why I'm Broke descriptions or images: titles, links and dates from their public feed only.
- No editing of watch terms from the page; terms are a file Claude edits on request.

## Architecture

```
nexus/
  radar/                       the pipeline (TypeScript, Node 22, run with tsx)
    terms.json                 ~30 watch terms: signals to read, CJ category/keyword, shop section
    src/
      index.ts                 CLI: radar run [--dry] [--skip-cj] [--only <term,…>] [--limit N]
      types.ts                 Term, DailySeries, TermScore, Candidate, RadarFile, TrendsFile
      fetch.ts                 fetch with timeout, retries, per-host spacing, User-Agent
      sources/
        wikipedia.ts           Wikimedia REST pageviews per article, daily, 14 days
        hackernews.ts          HN Algolia search_by_date, story points per phrase, daily
        reddit.ts              reddit.com/search.json posts per phrase, daily; tolerant of 403/429
        tiwib.ts               thisiswhyimbroke.com RSS: titles, links, dates; phrase matches per day
      score.ts                 growth, z-normalisation, weights, labels, series (from the earlier spec)
      cj/
        client.ts              auth, token cache for the run, 1 request/second, typed calls
        search.ts              category-scoped product search, variant and freight fetches
        parse.ts               tolerant parsing of CJ responses into Candidate inputs
      money.ts                 ECB rate (frankfurter.app), USD→AUD, landed cost, GST, margin, pretty retail
      flags.ts                 compliance flags from name/variant/category text
      rank.ts                  Radar score and penalties
      write.ts                 atomic writes of data/radar.json and data/trends.json, carries firstSeen
      listing.ts               draft shop listing from a Candidate (used by the approval job)
    test/
      fixtures/                recorded or hand-built responses per source and CJ endpoint
      *.test.ts
  data/
    radar.json                 the Radar's data (committed by the Action)
    trends.json                per-product and per-term trend scores (committed by the Action)
    listings/<pid>.json        approved draft listings (committed by the approval job)
  scripts/
    merge-trends.mjs           data/trends.json → src/lib/trends.generated.ts
    merge-listings.mjs         data/listings/*.json → src/lib/data.listings.ts
  src/
    radar/                     the Radar page (React, same design system as the shop)
      main.tsx, RadarApp.tsx, components/…
  radar.html                   second Vite entry, served at /radar/
  .github/workflows/
    radar.yml                  daily: run pipeline, commit data, then deploy
    pages.yml                  on push to master: build, deploy dist/ to GitHub Pages
    listing.yml                on issue opened with title "list: <pid>" by the owner: write listing, commit, close
```

The pipeline shares `src/lib/data.ts` (catalogue ids, categories) and `src/lib/shipping.ts` (zones) so nothing is spelt twice.

## Watch terms (`radar/terms.json`)

Each term:

```json
{
  "id": "smart-ring",
  "label": "Smart rings",
  "section": "Wearables",
  "wikipedia": "Smart_ring",
  "phrases": ["smart ring", "sleep tracking ring"],
  "cj": { "category": "smart ring", "keyword": "smart ring" },
  "products": ["oura-ring-5", "ringconn-gen-3", "ultrahuman-ring-air", "samsung-galaxy-ring"]
}
```

`products` maps the term to the catalogue products whose trend badge it drives; a product with no term keeps a neutral "Steady" with `confidence: none`. `cj.category` is a fragment matched case-insensitively against the names in CJ's `/product/getCategory` tree (578 categories, fetched once per run); the first match's id scopes the search. When nothing matches, `keyword` alone is used and the candidate carries `cjScope: "keyword"` so the Radar can say the match is looser. The projectors category (`0AC6B44A-12CC-456F-831F-54064C77D303`) was confirmed in the 3 October probe.

The first list has about 30 terms across the shop's sections: smart rings, smart glasses, fitness bands, sleep tech, open-ear buds, portable speakers, indoor cameras, light strips, robot vacuums, window robots, smart locks, Matter hubs, laser projectors, battery projectors, projector screens, Qi2 power banks, GaN chargers, magnetic charging, travel adapters, e-scooters, LED face masks, smart scales, recovery devices, desk 3D printers, dev boards and multitools, AI recorders, pocket gimbals, 360 cameras, magnetic-switch keyboards, finder tags. Phrases are generic; no brand names, so no competitor's product is measured by accident.

## Signals and trend scoring

Sources, weights and floors as in the earlier spec, plus TIWIB:

| Source | Weight | Floor | Series value per day |
| --- | --- | --- | --- |
| Wikipedia | 0.40 | 50 views | page views of the term's article |
| Hacker News | 0.20 | 5 points | sum of story points for stories matching a phrase |
| Reddit | 0.30 | 5 posts | posts matching a phrase (site-wide search) |
| TIWIB | 0.10 | 1 item | feed items whose title matches a phrase |

Window 14 days ending yesterday (UTC). `growth = (last7 − prior7) / max(prior7, floor)`; per-source z across all terms; `score = Σ w·z` with weights renormalised over the sources that returned data; `delta = round(100·Σ w·growth)` clamped to [−90, 999]; labels Viral ≥ 200, Trending ≥ 100, Rising ≥ 50, else Steady; `series` 8 points scaled to max 100; `confidence` by number of sources (high 3+, medium 2, low 1, none 0).

Reddit refuses many data-centre addresses. A 403 or 429 after retries marks the source `failed` for the run; weights renormalise; the run goes on. The Radar shows which sources fed each run.

TIWIB's 15 latest items are also kept as `novelty[]` in `radar.json` (title, link, date, matched term or null) and shown as a small attributed rail. Nothing else from their site is fetched.

## CJ search, variants and freight

For every term whose label is Rising or better, plus the top 8 terms by score regardless of label (so a quiet week still produces candidates), the pipeline:

1. `GET /product/list?categoryId=<id>&productNameEn=<keyword>&pageNum=1&pageSize=20` (keyword only when no category). Keeps items with `sellPrice ≥ 3 USD` and sorts by `listedNum` descending. Takes the top 3 not already seen as candidates this run.
2. `GET /product/query?pid=<pid>` for each: variants with `vid`, `variantNameEn`, `variantKey`, `variantSellPrice`, `variantWeight` (grams), images. Picks the AU-plug variant when any variant name or key mentions `AU`; else the cheapest variant; records whether an AU plug exists.
3. `POST /logistic/freightCalculate` with `{ startCountryCode: 'CN', endCountryCode, zip, products: [{ quantity: 1, vid }] }` for AU (zip 2000), US (10001) and the UK (`GB`, zip SW1A 1AA; if CJ rejects `GB` the client retries once with `UK` and records which worked). Keeps every returned line (name, price USD, days range) and marks the cheapest and the fastest. An empty result for a destination is recorded as `null` (some heavy items return none), never as zero.

Rate: one request per second with a 1.1 s spacer; auth once per run with `POST /authentication/getAccessToken { apiKey }`, header `CJ-Access-Token`. Budget is about 400 requests, around 8 minutes. The job's timeout is 30 minutes. A CJ failure after retries ends the CJ part for that run; trends are still written, and `radar.json` keeps the previous candidates with `stale: true` and the previous `generatedAt` in `cjGeneratedAt`.

The pipeline runs with `--skip-cj` when `CJ_API_KEY` is unset, so a fork or a local run without the key still produces trends.

## Money

- Rate: `GET https://api.frankfurter.app/latest?from=USD&to=AUD` (ECB daily). On failure, the last rate from the previous `radar.json`, else 1.52 with `rateSource: 'fallback'`.
- `costAud = variantSellPrice × rate`; `freightAud = cheapest AU line × rate`; `landedAud = costAud + freightAud`.
- Fees: 2.9 % + A$0.30 on the retail price (card processing estimate, labelled as such).
- Suggested retail: the retail at which net margin is 45 % after GST and fees, rounded up to the next price ending in .95; floor of landed × 1.8. `netAud = retail / 1.1 − fees − landedAud`; `marginPct = netAud / (retail / 1.1)`.
- Also reported: margin at 2× and 3× landed, and the shop's current median price for the same section when there is one, so Nick can see where the candidate would sit.
- Tax model stated on the page: Nexus sells as an Australian GST-registered business, so GST is charged on the sale and the low-value import threshold is a customer-side matter; duties for other destinations are shown as "on delivery", matching the shop.

## Compliance flags (`flags.ts`)

Keyword rules over name, variant names and category, each with a one-line note for Australia:

| Flag | Triggers | Note |
| --- | --- | --- |
| battery | battery, mAh, lithium, rechargeable, power bank | Lithium batteries limit the courier choices and need UN38.3 test reports from the supplier. |
| mains | plug, adapter, charger, 220V, 110V, wall | Mains devices need the RCM mark and an approved AU plug; a 110 V-only item cannot be sold here. |
| radio | bluetooth, wifi, wi-fi, 2.4G, wireless, BLE, zigbee, thread | Radio devices need ACMA compliance (RCM) and a supplier declaration. |
| skin | mask, LED therapy, facial, massage, skin | Devices used on the body attract consumer-law scrutiny of claims; avoid medical claims. |
| kids | kids, children, toy, baby | Mandatory toy safety standards apply. |
| heavy | weight > 2000 g | Freight dominates the price; check the cheapest line is a real courier. |

Flags never block; they appear on the card and in the draft listing's `notes`.

## Radar score (`rank.ts`)

```
score = 0.45 × trendZ + 0.35 × demand + 0.20 × marginHeadroom − penalties
demand        = log10(listedNum + 1) / log10(max listedNum this run + 1)
marginHeadroom = clamp((marginPct at suggested retail − 0.30) / 0.30, 0, 1)
penalties: heavy −0.15; mains without AU plug −0.25; costAud < 5 −0.15; no AU freight line −0.40
```

Candidates are sorted by score; ties by trend delta. `firstSeen` is carried from the previous file by `pid`, so the page can show "new today" and "seen 6 days".

## Output files

`data/radar.json`

```json
{
  "generatedAt": "2026-10-04T20:05:10Z",
  "cjGeneratedAt": "2026-10-04T20:05:10Z",
  "rate": { "usdAud": 1.515, "source": "ecb", "date": "2026-10-04" },
  "sources": { "wikipedia": "ok", "hackernews": "ok", "reddit": "failed: 403", "tiwib": "ok", "cj": "ok" },
  "terms": [{ "id": "smart-ring", "label": "Smart rings", "section": "Wearables", "delta": 212, "trendLabel": "Viral", "score": 1.83, "confidence": "high", "series": [8,9,12,15,22,30,38,61], "sources": { "wikipedia": {"last7": 18234, "prior7": 6102, "growth": 1.99}, "hackernews": null, "reddit": null, "tiwib": {"last7": 2, "prior7": 0, "growth": 2} } }],
  "candidates": [{
    "pid": "…", "termId": "smart-ring", "section": "Wearables", "name": "…", "image": "https://cc-west-usa.oss-us-west-1.aliyuncs.com/…", "cjUrl": "https://www.cjdropshipping.com/product/-p-….html",
    "listedNum": 1532, "variant": { "vid": "…", "name": "AU plug / Black", "weightG": 180, "priceUsd": 23.4, "auPlug": true, "variantCount": 6 },
    "freight": { "AU": { "cheapest": {"name": "CJPacket Ordinary", "usd": 6.1, "days": [8, 15]}, "fastest": {…}, "lines": 7 }, "US": {…}, "GB": null },
    "money": { "costAud": 35.45, "freightAud": 9.24, "landedAud": 44.69, "retailAud": 109.95, "marginPct": 0.46, "netAud": 46.3, "at2x": 0.31, "at3x": 0.55, "sectionMedianAud": 399 },
    "flags": ["battery", "radio"], "score": 0.71, "firstSeen": "2026-10-01", "why": "Smart rings +212 % on Wikipedia and TIWIB; 1,532 dropshippers list this; 46 % margin at $109.95."
  }],
  "novelty": [{ "title": "…", "link": "…", "date": "2026-10-03", "termId": null }]
}
```

`data/trends.json`: `generatedAt`, `window`, `sources`, `products: { <productId>: { delta, label, score, confidence, series } }` and `terms` as above. The shop's generated module reads only `products` and `generatedAt`.

## The Radar page

A second entry in the same Vite app, `/radar/`, React with the shop's tokens and components (Button, Tile, ProductImage-style frame, sparkline). No router: one page with a filter rail and a ranked list; a candidate expands in place.

- Header: "Trend Radar", generated time, sources that fed the run (with "Reddit: blocked this run" when so), rate used, candidate count. A link to the shop and to the novelty rail.
- Filter rail: section (from terms), minimum margin (0 / 30 / 45 %), flags to exclude, "AU plug only", "hide skipped". Sort: score, margin, trend, demand, newest.
- Card: photo (CJ image), name, section and term, trend chip (label and delta, sparkline), listed count, landed cost → suggested retail → margin as a three-step strip, cheapest AU freight with days, flags as small marks with the note on hover and in the expanded view, "why it's here" line, firstSeen.
- Expanded: all freight lines for AU/US/GB, variant list with plug and weight, money table (cost, freight, GST, fees, net at the suggested retail, 2× and 3×), the section's median shop price, compliance notes, the CJ product link.
- Actions: Skip (localStorage set of pids, with a "Skipped (n)" toggle to show them again); Add to shop (opens `https://github.com/sykunfts/nexus/issues/new?title=list%3A+<pid>&labels=listing&body=<json>` in a new tab; the body carries `{ pid, vid, retailAud, termId }` and a sentence explaining what will happen). No other write path exists on the page.
- Empty and failed states: no candidates (first run, or CJ failed) shows the terms table and the sources' status; stale candidates show a banner with the age.
- Mobile: single column, rail as a sheet; same as the shop.

Visual direction follows the shop's Test Bench design; the Radar is the bench's instrument panel, denser than the shop, numbers in the reading face, one accent for the trend chip.

## Approval flow (`listing.yml`)

On `issues: opened` where `title` starts with `list:` and `issue.user.login == github.repository_owner`: checkout, `npm ci`, `node radar/listing.mjs <issue number>` which parses the JSON body, finds the candidate by `pid` in `data/radar.json`, writes `data/listings/<pid>.json` with the draft listing, commits with `[skip radar]`, closes the issue with a comment naming the file and the product's shop URL. Any other issue is left alone. The draft listing (`listing.ts`):

- `id`: `cj-<pid>`; `brand`: the CJ brand field when present else "Nexus Select"; `name`: the CJ name trimmed to 60 characters with the term's label as `category`'s shop section; `tagline`: generated from term label and flags; `price`: the issue's `retailAud`; `priceSource: { amount: variant USD, currency: 'USD', at: run date }`; `fulfil: { route: 'supplier', origin: 'CN' }`; `market: 'CN'`; `variants`: from CJ variants (label, hue from a stable hash, swatch grey), `stock: 'in'`; `photos`: CJ image URLs; `facts`: `plug` from the AU variant (else region of the cheapest), `battery` from the flag, `requires` empty; `sources`: the CJ product page; `notes`: the flags' notes; `trend`: from `trends.json` for the term; `listedAt`: the run date; `rating: null`.

`scripts/merge-listings.mjs` turns `data/listings/*.json` into `src/lib/data.listings.ts` at build time; `products = [...catalogue, ...EXPANSION, ...LISTINGS]`. A listing shows a "From the Radar" mark on the product page and ships supplier-direct with the CN lanes already in `shipping.ts`.

## Storefront integration

- `scripts/merge-trends.mjs` writes `src/lib/trends.generated.ts` (`TRENDS: Record<id, Trend>`, `TRENDS_GENERATED_AT`). `data.ts` applies it when building `products`: a product with an entry gets `trend` from the file; otherwise the deterministic sample stays and the product carries `trendSource: 'sample'`.
- `TREND_NOTE` becomes a function of `TRENDS_GENERATED_AT`: "Trend figures from Wikipedia, Hacker News and Reddit, refreshed 4 October 2026" when present, the sample wording otherwise. Header, Home, collection blurbs and the product page use it.
- Home's "Moving fastest this week" rail reads the top four by delta from the file when present.
- The Trend Scout's "what is taking off" answers use the same deltas.
- Build-time only: the published page never fetches at runtime, so the artifact and Pages behave the same.

## Deploy

- `vite.config.ts`: two inputs (`index.html`, `radar.html`); `base` is `/nexus/` when `GITHUB_PAGES=1`, `./` otherwise; the singlefile plugin only when `FRAGMENT=1` (used by `scripts/fragment.mjs` for the artifact).
- `pages.yml`: on push to `master` and on `workflow_run` of the Radar: Node 22, `npm ci`, `npm run merge` (trends + listings), `npm run build` with `GITHUB_PAGES=1`, upload `dist/`, deploy with `actions/deploy-pages`. Pages source: GitHub Actions.
- `radar.yml`: `schedule: cron '0 20 * * *'` (06:00 Sydney in winter, 07:00 in summer) and `workflow_dispatch`. Runs `npm run radar`, commits `data/*.json` as "Radar: <date>" when changed; the push triggers `pages.yml`. Concurrency group `radar` so runs never overlap. `permissions: contents: write`.
- `listing.yml`: `issues: [opened]`, `permissions: contents: write, issues: write`.
- README gains a "Running it" section and the setup checklist below.

## Error handling

- Every HTTP request: 15 s timeout, two retries (2 s, 6 s), per-host spacing (300 ms general, 1.1 s CJ), User-Agent `NexusRadar/0.3 (+https://github.com/sykunfts/nexus)`.
- A source that fails is recorded and skipped; a term with no sources gets `confidence: none` and is excluded from CJ search.
- CJ auth failure (bad or expired key) ends the CJ stage with `sources.cj = "failed: auth"`; the run still writes trends and keeps the previous candidates marked stale. The workflow step prints a plain sentence pointing at the secret.
- If fewer than half the terms received any signal, the run exits 1 and writes nothing (the last good files stay). The Action then fails visibly in the Actions tab.
- Writes are atomic (temp file, rename). `firstSeen` and the previous rate are read from the existing `radar.json` before it is replaced.
- The listing job validates the body (pid present in `radar.json`, retail a number ≥ landed) and closes the issue with a reason when it is not.

## Testing

- `score.test.ts`: kept from the earlier design (growth with floor, z, renormalisation, labels, series, confidence) plus TIWIB phrase matching.
- `sources/*.test.ts`: each adapter parses a fixture into a 14-day series; empty, 403 and malformed responses give `null`.
- `cj/parse.test.ts`: list, query and freight fixtures (shapes from the 3 October probe) parse; AU variant choice; empty freight → `null`; missing fields skip the item rather than throw.
- `money.test.ts`: landed cost, suggested retail rounding (.95, floor 1.8×), margin at 45 %, fallback rate.
- `flags.test.ts`: each rule; no false positive on "wireless-free" style phrases is not attempted (documented).
- `rank.test.ts`: score ordering, each penalty, firstSeen carry-over.
- `listing.test.ts`: a candidate becomes a valid `Product` (type-checked, passes the catalogue tests: unique id, non-empty variants, photos array).
- `merge-*.test`: generated modules compile and the catalogue tests still pass with a listing present.
- Radar page: jsdom test that the page renders from a fixture `radar.json`, filters by margin, Skip hides and the toggle shows, and the Add-to-shop link carries the pid; Playwright scenarios in `shot.py` for desktop and mobile.
- Manual before the first scheduled run: `npm run radar -- --dry --limit 3` in GitHub Actions via `workflow_dispatch`, then read the log.

## Setup checklist for Nick (also in the README)

1. Repository `sykunfts/nexus`, public, pushed (GitHub Desktop the first time).
2. Settings → Secrets and variables → Actions → New repository secret: name `CJ_API_KEY`, value the key from CJ's developer page.
3. Settings → Pages → Source: GitHub Actions.
4. Actions tab → Trend Radar → Run workflow once; then the shop is at `https://sykunfts.github.io/nexus/` and the Radar at `https://sykunfts.github.io/nexus/radar/`.
5. Issues are how approvals work; leave Issues enabled.

## Later phases (not in this build)

- Build 4: Radar v2: term editing from the page (via an issue form), per-candidate notes, history view, more destinations, CJ's "sourcing request" for items not on the platform.
- Build 5: payment (Stripe) and CJ order push on paid orders; shipping confirmation back to the order page.
- Build 6: membership: accounts with roles, members browse the Radar and the newest/cheapest finds, order through Nexus, Nexus fulfils via CJ.
