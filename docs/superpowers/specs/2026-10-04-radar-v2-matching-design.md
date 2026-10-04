# Trend Radar v2: matching and ranking you can list from

Date: 4 October 2026. Build 6. Status: approved by Nick; amended while planning (pet words moved from the global list to per-term rules; the ranking check restated, see section 9).

## 1. Goal

Nick's main goal is a tool that finds products worth listing, advertising and dropshipping from China. The Radar's first real run (4 October, GitHub Actions, live CJ) proved the plumbing but not the picks: CJ's name search returned products that are not the product (a cat toy under smart locks, backpacks and a jacket under travel adapters, shoes and a TV stand under dev boards, zircon jewellery under smart rings), the ranking was dominated by CJ's "listed" count, margin did not separate anything (every candidate ~45 % because pricing targets that margin), and the novelty feed showed cannabis wine, a hip-flask scarf, knives and an adult toy.

Build 6 makes the top of the list real, on-trend products with a worthwhile profit per sale, keeps junk from reaching Nick, and shows what was thrown out and why.

What Nick said: "Fix matching and ranking" (chosen scope); "yes that's what I want from build 6" (rank on profit per sale); "Rules per term" (matching method); "Yes, write the spec".

Assumptions (Nick can correct them in review): profit floor A$20 a sale (the recommended option; he affirmed profit ranking without picking a floor); steering the watch list, history across runs and Reddit stay out of this build.

Success: replaying the 4 October candidates through the new code rejects every off-product title listed in section 7 and keeps every real one, so the 3D-printer accessories never reach the ranking and the top picks are real products from Viral terms (the projectors and the smart door lock); the five junk novelty titles are hidden; every one of the 31 terms has rules that accept its own search phrase; yesterday's `data/radar.json` still loads on the Radar page; the next scheduled run (20:00 UTC) produces the new fields without new secrets.

## 2. Scope

In: per-term match rules in `radar/terms.json`; a matcher; multi-phrase CJ search with gating before detail and freight calls; a new score and a profit floor; a novelty filter shared by the pipeline and the page; Radar page changes (profit-led cards, thin-margin group, "Thrown out today", hidden-novelty count); tests and fixtures from the real run.

Out: editing terms from the page; history or "new since yesterday"; Reddit; changes to the shop, the back office, `listing.ts` / "Add to shop", the workflows' schedule or secrets; AI classification.

## 3. Match rules

`Term` gains `match: { all: string[][]; not?: string[] }` in `radar/terms.json`:

- `all` is a list of groups. A title passes when, for every group, at least one entry occurs in it. Entries are lowercase words or phrases.
- `not` lists entries that disqualify a title for this term.
- A global list `NEVER` in `radar/src/match.ts` applies to every term: `shoes`, `jacket`, `coat`, `backpack`, `dress`, `chair`, `sofa`, `curtain`, `wig`. Pet words are not global (pet cameras and pet trackers are real products); terms where they mean junk, such as smart locks, carry `pet`, `cat`, `dog` and `toy` in their own `not`.
- Matching is case-insensitive on whole words and phrases: an entry matches only where it is bounded by a non-letter, non-digit character or the string's edge on both sides, so `gin` never matches `engine` and `3d printer` does not match `1.83D Printer`. Hyphens and spaces inside an entry match literally.

`matchTitle(title: string, term: Term): { ok: true; strength: number } | { ok: false; reason: string }` in `radar/src/match.ts`:

- `not` and `NEVER` are checked first: the first hit gives `reason: has "<entry>"`.
- Then each `all` group in order: the first group with no hit gives `reason: no "<first entry>"` (for example `no "lock"`).
- `strength` is `1` when the title contains `term.cj.keyword` as a phrase, else `0.6`.

Rules are seeded for all 31 terms (the plan carries them). Principles: the first group names the object (`lock`, `ring`, `projector`, `adapter`, `hub`); a second group, where the object word alone is ambiguous, names what makes it the tech version (`smart`, `fingerprint`, `sleep`, `gan`, `zigbee`); `not` names the look-alikes seen in real CJ results (zircon, wedding, car charger, accessories and spare parts for the 3D-printer term).

## 4. Search and gating (`radar/src/cj/search.ts`, `radar/src/run.ts`)

- `searchTerm` searches CJ once per phrase in `[term.cj.keyword, ...term.phrases]` (lowercased, de-duplicated, at most `MAX_SEARCHES = 3`), `pageSize = 50`, with `categoryId` when the category resolves (as today). Results merge and de-duplicate by `pid`; items under `MIN_PRICE_USD` (3) are dropped as today.
- Each list item's name goes through `matchTitle`. Passing items are kept, sorted by `listedNum` descending. Searching stops early once `PER_TERM * 3` (9) items have passed.
- Failing items become `Rejected { pid: string; termId: string; name: string; reason: string }`.
- In `runRadar`, the first `PER_TERM` (3) passing items per term get detail and freight calls as today. The detail name is checked again with `matchTitle`; a failure there is rejected too and does not take a slot (the next passing item is tried).
- `RadarFile` gains `rejected?: Rejected[]` (the run's rejections, at most 60, terms in run order) and `noveltyHidden?: number`.
- CJ call budget: at most 3 searches per selected term plus the existing detail and freight calls; at one call a second this stays well inside the workflow's 30-minute limit.

## 5. Score and profit floor (`radar/src/rank.ts`)

Constants: `WEIGHT = { heat: 0.45, profit: 0.35, match: 0.10, demand: 0.10 }`, `HEAT_FULL = 300`, `PROFIT_FULL = 60`, `PROFIT_FLOOR = 20`, `DEMAND_FULL = 1000`, `CONFIDENCE = { high: 1, medium: 0.85, low: 0.6, none: 0 }`. Penalties unchanged (`heavy` 0.15, mains without an AU plug 0.25, cost under A$5 0.15, no AU freight 0.40).

- `heat = clamp01(term.delta / HEAT_FULL) × CONFIDENCE[term.confidence]` (a falling term scores 0).
- `profit = clamp01(money.netAud / PROFIT_FULL)` (`netAud` is the profit per sale at the suggested retail, after GST, card fees and landed cost).
- `match = strength` from `matchTitle` on the detail name.
- `demand = clamp01(log10(listedNum + 1) / log10(DEMAND_FULL + 1))` (absolute, no longer relative to the run's maximum).
- `score = Σ weight × part − penalties`, rounded to three places.
- `Candidate` gains `thin: boolean` (`money.netAud < PROFIT_FLOOR`) and `match: number`.
- Order: candidates that clear the floor, by score descending (ties by term delta); then thin ones, the same way.
- `why`: `"<term label> <signed delta>% on <sources>; A$<netAud> profit a sale at A$<retailAud>; <listedNum> dropshippers list it."` The signed delta uses `+` or a hyphen-minus (no en dash, no Unicode minus); `<listedNum>` uses en-US grouping; money to two decimals.

## 6. Novelty filter (`radar/src/novelty.ts`)

`isBlocked(title: string): boolean` with whole-word, case-insensitive matching against: alcohol, beer, wine, wines, vodka, whisky, whiskey, rum, gin, tequila, liquor, booze, flask; cannabis, marijuana, weed, cbd, thc, vape, vaping, cigarette, cigarettes, cigar, tobacco, nicotine, bong; weapon, weapons, knife, knives, dagger, sword, gun, guns, firearm, rifle, pistol, ammo, ammunition, crossbow, taser; sex, sexy, adult, erotic, fleshlight, dildo, vibrator, lingerie, porn.

`filterNovelty(items: NoveltyItem[]): { items: NoveltyItem[]; hidden: number }` drops blocked titles and puts items with a `termId` first, keeping feed order otherwise. The pipeline stores the filtered list and `noveltyHidden`; the Radar page applies `filterNovelty` too, so an older `radar.json` is filtered on screen. The TIWIB trend signal (titles matched to terms) is unchanged.

## 7. Fixtures from the 4 October run

Rejected (term: title → reason class):

- smart-lock: "Smart Teaser Cat Toy Electric UFO Cat Teaser Stick With Bell..." (has a pet word: the smart-lock `not` list is checked before the groups); "20000mAh Portable Charger High Capacity External Battery..." (no lock)
- travel-adapter: "Outdoor Travel Backpack Student-style Simple Design"; "High-end Waterproof Oxford Fabric Laptop Backpack..."; "Couple's Outdoor Travel Large-size Jacket For Men"
- smart-ring: "Stainless Steel Contrasting Zircon Ring"; "Alien Birthday Stone Zircon Stainless Steel Ring For Women"; "Digital Display Smart Induction Foam Dispenser For Home Use"
- dev-board: "Women's Height Increasing Round Toe Lace-up Board Shoes"; "Washed Gray Finish Fireplace TV Stand..."; "WALL MOUNTED TOOL PEG BOARD SET GARAGE STORAGE BINS..."
- matter-hub: "Aluminum Tube Musical Wind Chime For Home"; "Rechargeable Smart Sensor Soap Dispenser"; "Retro-style Study Home Computer Chair"
- desk-3d-printer: "3D printer accessories mute motherboard"; "DIY Set Of Accessories 1.83D Printer I3 Motor"; "3D Printer DIY Model Moonlight Board Two-color Touch Night Light"
- gan-charger: "Retractable Car Charger 4 in 1 Fast Car Phone Charger 120W With USB Type C Cable"

Kept: smart-lock "Aluminum Alloy Smart Door Lock With Facial Recognition And Fingerprint Recognition"; smartwatch "Children's Phone Watch Smart Positioning Call Photo", "S10 Smartwatch 4G Elderly Phone Watch", "Ten-in-One Smart Watch Set With Wireless Earbuds..."; laser-projector "Portable Home Theater Projector, Mini Projector For Bedroom Gaming Movies" (strength 0.6), "5G 4K Projector Smart HD LED WiFi Bluetooth..." (0.6); open-ear-buds "KP-113 Best-selling Wireless Bluetooth Ear-hook Headphones..."; gan-charger "100W GaN Multi-Port Charger with Built-in Retractable Type-C Cable..." , "65W USB C Type-C Adapter Charger For DELL, HP, ASUS, Lenovo, Huawei,Acer Laptop".

Novelty hidden: "Handforged Tools And Weapons", "Cannabis Infused Wine", "Cursed Kirby Fleshlight", "Scarf Hidden Flask", "Spiral Blade Knife". Kept: the other nine (for example "Sand Drawing Light Table", "Outrageously Flavored Sodas").

## 8. Radar page (`src/radar`)

- `CandidateCard`: the headline number is profit per sale (`A$<netAud> a sale`, `numeral`), with `at A$<retailAud>` beside it; the match strength shows as "exact match" or "close match" next to the term label; the money breakdown, flags and Add to shop stay.
- `RadarRail`: candidates that clear the floor first; thin ones under a heading "Under A$20 a sale" (from `PROFIT_FLOOR`), collapsed by default with a count.
- `RejectedList` (new): a `<details>` "Thrown out today (n)" listing each rejection grouped by term label: the title (plain text, never a link), the reason. Absent when `rejected` is missing or empty.
- `NoveltyRail`: shows `filterNovelty` output and, when anything was hidden, "<n> hidden (alcohol, tobacco, weapons or adult)".
- Old files: missing `thin` is computed from `money.netAud`; missing `match` reads as close match; missing `rejected` and `noveltyHidden` render nothing.
- No em or en dashes in new copy; the v3 tokens and components (`numeral`, `Tile`, 2px radius) are used.

## 9. Testing

- `radar/test/match.test.ts`: every section 7 title gets the stated verdict under its term; whole-word behaviour (`gin` vs `engine`, `3d printer` vs `1.83D Printer`); reason text format.
- `radar/test/terms.test.ts` (extend): all 31 terms have `match.all` with non-empty groups of lowercase entries; each term's `cj.keyword` passes its own rules.
- `radar/test/rank.test.ts` (rewrite for v2): under equally hot terms, a candidate with A$60 profit and 1 listing outranks one with A$12 profit and 666 listings; a falling term contributes no heat; a A$15 candidate is `thin` and sorts after a lower-scored A$25 one; `why` format with a negative delta uses a hyphen-minus.
- `radar/test/cj.test.ts` (extend): `searchTerm` queries each phrase (at most three), merges and de-duplicates, returns rejections, and stops early at nine passes.
- `radar/test/run.test.ts` (extend): a detail-name failure is rejected and the next passing item takes the slot; `rejected` is capped at 60; `noveltyHidden` counts the filtered items.
- `radar/test/novelty.test.ts`: the five hidden and nine kept titles; term-matched items first.
- `src/radar/radar.test.tsx` (extend): profit-led card, thin group, "Thrown out today", hidden-novelty line, and an old-format file (no new fields) rendering without errors.
- `npm run typecheck`, the full suite, `npm run build`, and `npm run radar:dry` (offline, `--skip-cj`) succeed.

## 10. Delivery

Branch `radar-v2` from `main`; spec and plan committed on `main`; final whole-branch review and one fix pass; merge; changed files written into Nick's `Documents\nexus` folder through the device bridge (after checking his copies match), for him to commit and push. The next scheduled run uses the new rules; Nick can also run the Radar workflow by hand from the Actions tab.
