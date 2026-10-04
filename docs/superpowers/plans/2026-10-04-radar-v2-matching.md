# Trend Radar v2 (matching and ranking) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Radar's picks real, on-trend products ranked by profit per sale: per-term match rules gate CJ results, a new score leads with trend heat and profit, junk novelty is hidden, and the Radar page shows profit first plus what was thrown out.

**Architecture:** Two new pure modules (`radar/src/match.ts`, `radar/src/novelty.ts`) and per-term rules in `radar/terms.json`; `searchTerm` gates CJ list results before any detail call; `rankCandidates` is rewritten around heat, profit, match and demand; `runRadar` re-checks detail names, records rejections and filters novelty; the Radar page reads the new optional fields and copes with old files.

**Tech Stack:** TypeScript (strict), Node 20 via tsx, vitest, React 18 + Tailwind 4 for the Radar page.

**Spec:** `docs/superpowers/specs/2026-10-04-radar-v2-matching-design.md` (as amended: pet words per term, ranking check restated)

## Global Constraints

- No new secrets, accounts or dependencies; `.github/workflows/*`, `office/`, `src/lib/*` (shop), `radar/src/listing.ts` and "Add to shop" do not change.
- New `RadarFile` fields are optional (`rejected?`, `noveltyHidden?`); new `Candidate` fields (`thin`, `match`) are required on new runs but the page must cope when they are absent.
- Constants exactly: `MAX_SEARCHES = 3`, `PAGE_SIZE = 50`, `PER_TERM = 3`, early stop at `PER_TERM * 3` passes, rejected cap `60`; `WEIGHT = { heat: 0.45, profit: 0.35, match: 0.10, demand: 0.10 }`, `HEAT_FULL = 300`, `PROFIT_FULL = 60`, `PROFIT_FLOOR = 20`, `DEMAND_FULL = 1000`, `CONFIDENCE = { high: 1, medium: 0.85, low: 0.6, none: 0 }`; penalties unchanged.
- Matching is whole-word and case-insensitive: an entry matches only where bounded on both sides by a character that is not a letter or digit, or by the string's edge.
- No em dash or en dash (and no Unicode minus) in any string the Radar page or `why` shows; signed numbers use `+` or a hyphen-minus.
- Suite command: `npx vitest run` (307 green before Task 1). Typecheck: `npm run typecheck`. Offline Radar: `npm run radar:dry`.
- Commits on branch `radar-v2`, one per task.

## Review Focus

1. CJ titles with typical CJ punctuation and casing ("Smart Door Lock,Fingerprint", "WIFI SMART DOOR LOCK", "Smart-Door Lock") must pass the smart-lock rules; a run-together "SmartLock" is rejected with a readable reason rather than crashing. (Task 1, `match.test.ts`)
2. A list item with an empty or missing name is rejected with `no "<first entry>"`, never thrown on. (Task 3, `cj.test.ts`)
3. A run where CJ answered but every result was rejected leaves `candidates: []` and a non-empty `rejected`; the Radar page's empty state says the products did not match and points at "Thrown out today" instead of saying CJ found nothing. (Task 6, `radar.test.tsx`)
4. A blocked novelty word inside a longer word ("Gunmetal Grey Speaker", "Sussex Tea Set", "Winery Tour Map") does not hide the item. (Task 2, `novelty.test.ts`)
5. A `radar.json` from before this build (no `thin`, `match`, `rejected`, `noveltyHidden`; unfiltered novelty) renders: thin is computed from `money.netAud`, match reads "close match", junk novelty is filtered on screen. (Task 6, `radar.test.tsx`)

---

### Task 1: Match rules and the matcher

**Files:**
- Create: `radar/src/match.ts`, `radar/test/match.test.ts`
- Modify: `radar/src/types.ts` (`Term`), `radar/terms.json` (a `match` object on all 31 terms), `radar/test/terms.test.ts`

**Interfaces:**
- Produces: `Term.match: { all: string[][]; not?: string[] }`; `export const NEVER: string[]`; `export type MatchResult = { ok: true; strength: number } | { ok: false; reason: string }`; `export function matchTitle(title: string, term: Term): MatchResult`; `export function hasEntry(text: string, entry: string): boolean` (the whole-word test, exported for `novelty.ts`).
- `matchTitle` order: `term.match.not` then `NEVER` (first hit → `has "<entry>"`), then each `all` group (first group with no hit → `no "<group[0]>"`); `strength` 1 when `hasEntry(title, term.cj.keyword)`, else 0.6. An empty or whitespace title fails on the first group.
- `hasEntry`: escape the entry for RegExp, build `(?<![\p{L}\p{N}])` + entry + `(?![\p{L}\p{N}])` with flags `iu`.
- `NEVER = ['shoes', 'jacket', 'coat', 'backpack', 'dress', 'chair', 'sofa', 'curtain', 'wig']`.

Rules to add to `radar/terms.json` (`all` groups separated by `|`, entries by `,`; `not` after `NOT`):

| term | all | not |
|---|---|---|
| smart-ring | ring \| smart, sleep, health, heart rate, fitness, tracker, nfc, oxygen | zircon, wedding, engagement, diamond, couple, couples, birthstone, gemstone, ring light, key ring, keyring, doorbell |
| smart-glasses | glasses, eyewear, spectacles \| smart, ai, bluetooth, audio, camera, ar, display | reading glasses, glasses case, cleaning, wine, drinking, shot glasses, magnifying |
| fitness-band | fitness, activity, sport, health \| tracker, band, bracelet | resistance band, resistance bands, yoga, elastic, headband, sweatband, exercise band, loop band, pull up |
| smartwatch | smartwatch, smart watch, watch \| smart, fitness, heart, sport, 4g, call, bluetooth, gps, health | watch strap, watch band only, replacement band, replacement strap, screen protector, protective case only, watch winder, mechanical watch, quartz watch, wall clock |
| ai-wearable | ai, voice, recorder, assistant, pin, pendant, badge \| wearable, pendant, pin, necklace, badge, clip | jewelry, jewellery, brooch, enamel pin, lapel pin, badge holder |
| open-ear-buds | open ear, open-ear, ear hook, ear-hook, earhook, bone conduction, air conduction, ear clip, clip-on, ows \| headphones, headphone, earphones, earphone, earbuds, earbud, headset, buds | ear pads, eartips, ear tips, cushion, case only |
| portable-speaker | speaker, soundbar, boombox \| bluetooth, wireless, portable, waterproof | speaker wire, speaker cable, speaker stand, speaker mount, grille, car speaker |
| indoor-camera | camera, cam, ipc \| security, indoor, surveillance, baby monitor, pet camera, wifi, wi-fi, smart home, ptz | dummy, fake, lens cap, camera bag, tripod, sticker, digital camera, film, instant camera, action camera, dashcam, dash cam |
| light-strip | strip, strips, tape, rope light, neon \| led, rgb, rgbic | strip connector, connectors, clips, power supply, controller only, aluminum channel, diffuser |
| robot-vacuum | robot, robotic \| vacuum, sweeper, sweeping, mop, mopping | filter, filters, side brush, brushes, mop pad, mop pads, dust bag, replacement, spare, parts, accessories, toy |
| window-robot | window, glass \| robot, robotic | filter, pads, replacement, accessories, toy |
| smart-lock | lock, deadbolt \| smart, fingerprint, keyless, biometric, wifi, wi-fi, bluetooth, app, digital, electronic, face recognition, facial recognition, keypad, password | pet, cat, dog, toy, padlock, bike lock, lock box, lockbox, phone case, lock screen, cable lock, gun, safe |
| matter-hub | hub, gateway, bridge \| smart home, zigbee, matter, thread, z-wave, homekit, wifi, wi-fi, tuya, alexa | usb hub, usb-c hub, type-c hub, docking, dock, laptop, ethernet |
| laser-projector | projector | lens cap, projector screen, bracket, mount, stand, remote, bulb, lamp, star projector, galaxy projector, sky projector, night light, logo projector, gobo |
| battery-projector | projector \| portable, mini, pocket, battery, handheld | lens cap, projector screen, bracket, mount, stand, remote, bulb, lamp, star projector, galaxy projector, sky projector, night light, logo projector, gobo |
| projector-screen | screen, screens \| projector, projection, movie | screen protector, phone screen, lcd screen, touch screen, monitor |
| qi2-power-bank | power bank, powerbank, battery pack, portable charger \| magnetic, magsafe, qi2, wireless | case, cable only |
| gan-charger | charger, adapter, adaptor \| gan, pd, usb c, usb-c, type-c, type c, fast charging, fast charger, 65w, 100w, 120w, 140w, multi-port | car, car charger, wireless charger, cable only, charging cable, solar |
| magnetic-charging | charger, charging stand, charging pad, charging station \| magnetic, magsafe, qi2, wireless | cable only, power bank, case |
| travel-adapter | adapter, adaptor, converter \| travel, universal, plug, worldwide, international, wall | usb to, hdmi, audio, lens, card reader, otg |
| e-scooter | scooter \| electric, e-scooter, motor, foldable | tire, tyre, tube, brake, fender, mudguard, charger, battery only, grip, grips, bag, phone holder, replacement, parts, accessories, sticker, model |
| led-mask | mask \| led, light therapy, red light, photon, infrared | sheet mask, disposable, surgical, sleep mask, eye mask, halloween, costume, party, respirator, dust mask |
| smart-scale | scale, scales \| smart, body fat, bmi, bluetooth, wifi, app, bioimpedance, composition | kitchen, luggage, jewelry, food, postal, fish, hanging, crane |
| recovery | massage gun, massager, percussion, fascia gun, muscle gun, massage \| gun, percussion, deep tissue, muscle, fascia | toy, water gun, glue gun, nail gun, heat gun |
| desk-3d-printer | 3d printer, 3d printing, 3d printers | accessories, accessory, motherboard, mainboard, board, motor, nozzle, nozzles, filament, extruder, hotend, hot end, parts, spare, night light, lamp, pen, 3d pen, model, bed, build plate, belt, fan |
| dev-board | development board, dev board, arduino, esp32, esp8266, raspberry pi, microcontroller, stm32, pico, nodemcu, mcu | case, enclosure, sticker |
| ai-recorder | recorder, recording \| voice, audio, ai, transcription, dictaphone, meeting | video recorder, dash, dvr, car, camera, tape |
| pocket-gimbal | gimbal, stabilizer, stabiliser \| camera, pocket, handheld, vlog, 4k | tripod only, mount only, replacement, case, bag |
| 360-camera | 360, panoramic \| camera, cam | selfie stick, case, lens cap, lens protector, bag, mount |
| keyboard | keyboard \| mechanical, hot-swap, hot swappable, hall effect, magnetic switch, gaming, wireless, rgb, 75%, 65% | keycaps, keycap, switches only, wrist rest, case only, cover, sticker, piano, musical, toy |
| finder-tag | tracker, tag, finder, locator \| bluetooth, find my, airtag, smart, gps, anti-lost, anti lost, key finder | fitness, sleep, watch, band, case, holder, cover, silicone, price tag, tag gun |

- [ ] **Step 1: Write the failing tests**

`radar/test/match.test.ts`: a helper `t(id)` returns the term from `terms.json`. Cases:

```ts
it('rejects the 4 October off-product titles', () => {
  const bad: [string, string][] = [
    ['smart-lock', 'Smart Teaser Cat Toy Electric UFO Cat Teaser Stick With Bell Training Pet Toys Replaceable Feather Interactive Cat Supplies Pet Supplies Pets Products'],
    ['smart-lock', '20000mAh Portable Charger High Capacity External Battery 45W PD 3.0 Fast Charging Travel Power Bank With Smart Digital Display'],
    ['travel-adapter', 'Outdoor Travel Backpack Student-style Simple Design'],
    ['travel-adapter', 'High-end Waterproof Oxford Fabric Laptop Backpack Large-capacity Travel Backpack'],
    ['travel-adapter', "Couple's Outdoor Travel Large-size Jacket For Men"],
    ['smart-ring', 'Stainless Steel Contrasting Zircon Ring'],
    ['smart-ring', 'Alien Birthday Stone Zircon Stainless Steel Ring For Women'],
    ['smart-ring', 'Digital Display Smart Induction Foam Dispenser For Home Use'],
    ['dev-board', "Women's Height Increasing Round Toe Lace-up Board Shoes"],
    ['dev-board', 'Washed Gray Finish Fireplace TV Stand,  Embossed Particle Board With Melamine Foil'],
    ['dev-board', 'WALL MOUNTED TOOL PEG BOARD SET GARAGE STORAGE BINS WORKSHOP RACK SHED ORGANISER'],
    ['matter-hub', 'Aluminum Tube Musical Wind Chime For Home'],
    ['matter-hub', 'Rechargeable Smart Sensor Soap Dispenser'],
    ['matter-hub', 'Retro-style Study Home Computer Chair'],
    ['desk-3d-printer', '3D printer accessories mute motherboard'],
    ['desk-3d-printer', 'DIY Set Of Accessories 1.83D Printer I3 Motor'],
    ['desk-3d-printer', '3D Printer DIY Model Moonlight Board Two-color Touch Night Light'],
    ['gan-charger', 'Retractable Car Charger 4 in 1 Fast Car Phone Charger 120W With USB Type C Cable'],
  ]
  for (const [id, title] of bad) expect(matchTitle(title, t(id)).ok, `${id}: ${title}`).toBe(false)
})
it('keeps the real ones, exact phrase scores 1 and the rest 0.6', () => {
  expect(matchTitle('Aluminum Alloy Smart Door Lock With Facial Recognition And Fingerprint Recognition', t('smart-lock'))).toEqual({ ok: true, strength: 0.6 })
  expect(matchTitle('Portable Home Theater Projector, Mini Projector For Bedroom Gaming Movies', t('laser-projector'))).toEqual({ ok: true, strength: 0.6 })
  expect(matchTitle('Ten-in-One Smart Watch Set With Wireless Earbuds, Multiple Watch Bands, Magnetic Charger & Protective Case', t('smartwatch'))).toEqual({ ok: true, strength: 1 })
  for (const [id, title] of [['smartwatch', "Children's Phone Watch Smart Positioning Call Photo"], ['smartwatch', 'S10 Smartwatch 4G Elderly Phone Watch'], ['laser-projector', '5G 4K Projector Smart HD LED WiFi Bluetooth H DMI USB Android Office Home Theater'], ['open-ear-buds', 'KP-113 Best-selling Wireless Bluetooth Ear-hook Headphones High-quality Audio Low Latency'], ['gan-charger', '100W GaN Multi-Port Charger with Built-in Retractable Type-C Cable - AI Smart Display UK EU Plug Adapter'], ['gan-charger', '65W USB C Type-C Adapter Charger For DELL, HP, ASUS, Lenovo, Huawei,Acer Laptop']]) expect(matchTitle(title, t(id)).ok, title).toBe(true)
})
it('says why', () => {
  expect(matchTitle('Retro-style Study Home Computer Chair', t('matter-hub'))).toEqual({ ok: false, reason: 'has "chair"' })
  expect(matchTitle('Aluminum Tube Musical Wind Chime For Home', t('matter-hub'))).toEqual({ ok: false, reason: 'no "hub"' })
  expect(matchTitle('', t('smart-lock'))).toEqual({ ok: false, reason: 'no "lock"' })
})
it('matches whole words only and tolerates CJ punctuation', () => {
  expect(hasEntry('V8 engine model', 'gin')).toBe(false)
  expect(hasEntry('DIY Set Of Accessories 1.83D Printer', '3d printer')).toBe(false)
  for (const s of ['Smart Door Lock,Fingerprint', 'WIFI SMART DOOR LOCK', 'Smart-Door Lock']) expect(matchTitle(s, t('smart-lock')).ok, s).toBe(true)
  expect(matchTitle('WiFi SmartLock Fingerprint', t('smart-lock'))).toEqual({ ok: false, reason: 'no "lock"' })
  expect(hasEntry('Wireless 75% Keyboard', '75%')).toBe(true)
})
it('pet words are per term: a pet camera is still a camera', () => {
  expect(matchTitle('WiFi Pet Camera 2K Indoor Security', t('indoor-camera')).ok).toBe(true)
})
```

`radar/test/terms.test.ts` gains:

```ts
it('every term has match rules that accept its own search phrase', () => {
  for (const t of terms as Term[]) {
    expect(t.match.all.length, t.id).toBeGreaterThan(0)
    for (const g of t.match.all) { expect(g.length, t.id).toBeGreaterThan(0); for (const e of g) expect(e, t.id).toBe(e.toLowerCase()) }
    for (const e of t.match.not ?? []) expect(e, t.id).toBe(e.toLowerCase())
    expect(matchTitle(t.cj.keyword, t).ok, `${t.id} rejects its own keyword "${t.cj.keyword}"`).toBe(true)
  }
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run radar/test/match.test.ts radar/test/terms.test.ts`
Expected: match.test fails with "Cannot find module '../src/match'"; the terms case fails on `t.match` undefined.

- [ ] **Step 3: Implement `match.ts`, extend `Term`, add the rules table to `terms.json`** per Interfaces (entries lowercase, exactly as the table).

- [ ] **Step 4: Run the tests, then the suite and typecheck**

Run: `npx vitest run radar/test/match.test.ts radar/test/terms.test.ts && npx vitest run && npm run typecheck`
Expected: all pass; if a table rule makes a listed real title fail, fix the rule (not the test) and ledger the change.

- [ ] **Step 5: Commit**

```bash
git add radar/src/match.ts radar/src/types.ts radar/terms.json radar/test/match.test.ts radar/test/terms.test.ts
git commit -m "radar v2: per-term match rules and a whole-word matcher"
```

### Task 2: Novelty filter

**Files:**
- Create: `radar/src/novelty.ts`, `radar/test/novelty.test.ts`

**Interfaces:**
- Consumes: `hasEntry` (Task 1).
- Produces: `export const BLOCKED: string[]` (the spec section 6 list, exactly); `export function isBlocked(title: string): boolean`; `export function filterNovelty(items: NoveltyItem[]): { items: NoveltyItem[]; hidden: number }` (drops blocked; stable order with `termId` items first).

- [ ] **Step 1: Write the failing test**

```ts
const titles = ['McLaren McL 6GT', 'PlayStation LEGO Kit', 'Outrageously Flavored Sodas', 'Handforged Tools And Weapons', 'Driftwood Dragon Statue', 'Cannabis Infused Wine', 'Cursed Kirby Fleshlight', 'Scarf Hidden Flask', 'Spiral Blade Knife', 'Sand Drawing Light Table', 'Difficult Riddles For Smart Kids', 'Diamond Octopus Tentacles Ring', 'Lilium Personal Jet Aircraft', 'License Plate Flipper']
const item = (title: string, termId: string | null = null): NoveltyItem => ({ title, link: `https://x/${title}`, date: '2026-09-30', termId })
it('hides the five junk titles and keeps the other nine', () => {
  const out = filterNovelty(titles.map((t) => item(t)))
  expect(out.hidden).toBe(5)
  expect(out.items.map((i) => i.title)).toEqual(titles.filter((t) => !['Handforged Tools And Weapons', 'Cannabis Infused Wine', 'Cursed Kirby Fleshlight', 'Scarf Hidden Flask', 'Spiral Blade Knife'].includes(t)))
})
it('does not hide a blocked word inside a longer word', () => {
  for (const t of ['Gunmetal Grey Speaker', 'Sussex Tea Set', 'Winery Tour Map']) expect(isBlocked(t), t).toBe(false)
})
it('puts items matched to a term first, otherwise keeps feed order', () => {
  const out = filterNovelty([item('A'), item('B', 'smart-ring'), item('C'), item('D', 'keyboard')])
  expect(out.items.map((i) => i.title)).toEqual(['B', 'D', 'A', 'C'])
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run radar/test/novelty.test.ts`
Expected: FAIL with "Cannot find module '../src/novelty'".

- [ ] **Step 3: Implement `novelty.ts`** per Interfaces.

- [ ] **Step 4: Run it**

Run: `npx vitest run radar/test/novelty.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add radar/src/novelty.ts radar/test/novelty.test.ts
git commit -m "radar v2: novelty filter for alcohol, tobacco, weapons and adult items"
```

### Task 3: Multi-phrase CJ search with gating

**Files:**
- Modify: `radar/src/cj/search.ts` (`searchTerm`, constants), `radar/src/types.ts` (`Rejected`)
- Test: `radar/test/cj.test.ts`

**Interfaces:**
- Consumes: `matchTitle` (Task 1).
- Produces: `export const MAX_SEARCHES = 3`; `PAGE_SIZE = 50`; `export const ENOUGH = 9`; `export interface Rejected { pid: string; termId: string; name: string; reason: string }` in `types.ts`; `searchTerm(cj, term, cats): Promise<{ items: (CjListItem & { strength: number })[]; scope: 'category' | 'keyword'; rejected: Rejected[] }>`.
- Phrases: `[term.cj.keyword, ...term.phrases]` lowercased and trimmed, de-duplicated, first `MAX_SEARCHES`. Each search: `productNameEn = phrase`, `pageNum 1`, `pageSize 50`, `categoryId` when resolved. Merge by `pid` (first seen wins), drop `sellPrice < MIN_PRICE_USD` without recording, gate the rest with `matchTitle`, stop searching once `ENOUGH` items have passed. `items` sorted by `listedNum` desc.

- [ ] **Step 1: Update and add tests in `radar/test/cj.test.ts`**

- Rewrite the existing search test's URL assertions to the new call pattern: the first search URL carries `categoryId` and `productNameEn=laser(+|%20)projector` and `pageSize=50`; the term fixture's phrases produce the next searches; the loose (`category: 'zzz'`) call's search URLs carry no `categoryId`. Items stay `['P-A1', 'P-B2']` and `rejected` contains `P-C3` ("Projector Lens Cap", reason `has "lens cap"`) if its price clears `MIN_PRICE_USD`; otherwise assert it is absent from both lists.
- New: `'gates titles, de-duplicates across phrases and stops at nine passes'`: a fake `/product/list` returns 6 distinct passing items per call with fresh pids per call; with a term of 3 phrases, exactly 2 searches happen and 12 items return (stop after reaching 9 at the end of the second search).
- New (Review Focus 2): `'a list item with no name is rejected, not thrown on'`: a list entry `{ pid: 'P-X', productNameEn: '', sellPrice: 9 }` appears in `rejected` with `reason: 'no "projector"'`.

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run radar/test/cj.test.ts`
Expected: the rewritten and new search tests fail (one search, pageSize 20, no `rejected`); the parse tests still pass.

- [ ] **Step 3: Implement the new `searchTerm`** per Interfaces.

- [ ] **Step 4: Run it**

Run: `npx vitest run radar/test/cj.test.ts`
Expected: PASS. Then `npx vitest run radar/test/run.test.ts`: failures here are expected only where `run.ts` reads `searchTerm`'s old return; Task 5 owns them. Note any in the ledger.

- [ ] **Step 5: Commit**

```bash
git add radar/src/cj/search.ts radar/src/types.ts radar/test/cj.test.ts
git commit -m "radar v2: search every term phrase, 50 results, gate titles before detail calls"
```

### Task 4: Ranking v2

**Files:**
- Modify: `radar/src/rank.ts`, `radar/src/types.ts` (`Candidate.thin`, `Candidate.match`)
- Test: `radar/test/rank.test.ts` (rewrite the score cases; keep the penalty, firstSeen and file round-trip cases)

**Interfaces:**
- Produces: `export const WEIGHT`, `HEAT_FULL`, `PROFIT_FULL`, `PROFIT_FLOOR`, `DEMAND_FULL`, `CONFIDENCE` (values in Global Constraints); `export type Unranked = Omit<Candidate, 'score' | 'why' | 'firstSeen' | 'thin'>` (so `match: number` is an input); `rankCandidates(cands, terms, previous, today): Candidate[]` with the spec section 5 formula, `thin = money.netAud < PROFIT_FLOOR`, ordering non-thin before thin, each by score then term delta.
- `why` format exactly: `` `${label} ${delta > 0 ? '+' : ''}${delta}% on ${sources}; A$${net.toFixed(2)} profit a sale at A$${retail.toFixed(2)}; ${listed.toLocaleString('en-US')} dropshippers list it.` `` with `sources` from the existing `joinNames` (or `no source`).

- [ ] **Step 1: Write the failing tests**

Test helper `base(pid, over)` gains `match: 1`. Cases:

```ts
it('profit beats listings under equally hot terms', () => {
  const hot = [term('a', 1, 300), term('b', 1, 300)]
  const big = base('big', { termId: 'a', listedNum: 1, money: { ...moneyFor(20, 6, 1.5, null), netAud: 60 } })
  const crowded = base('crowded', { termId: 'b', listedNum: 666, money: { ...moneyFor(20, 6, 1.5, null), netAud: 21 } })
  expect(rankCandidates([crowded, big], hot, null, '2026-10-04').map((c) => c.pid)).toEqual(['big', 'crowded'])
})
it('a falling term adds no heat', () => {
  const down = rankCandidates([base('x', { termId: 'd' })], [term('d', -1, -40)], null, '2026-10-04')[0]
  const flat = rankCandidates([base('y', { termId: 'f' })], [term('f', 0, 0)], null, '2026-10-04')[0]
  expect(down.score).toBeCloseTo(flat.score, 3)
})
it('thin candidates sort after ones that clear A$20, even with a higher score', () => {
  const thin = base('thin', { money: { ...moneyFor(20, 6, 1.5, null), netAud: 15 }, listedNum: 5000 })
  const ok = base('ok', { termId: 'b', money: { ...moneyFor(20, 6, 1.5, null), netAud: 25 }, listedNum: 1 })
  const out = rankCandidates([thin, ok], [term('a', 1, 300), term('b', -1, -10)], null, '2026-10-04')
  expect(out.map((c) => [c.pid, c.thin])).toEqual([['ok', false], ['thin', true]])
  expect(out[1].score).toBeGreaterThan(out[0].score)
})
it('why reads plainly with a hyphen-minus for a fall', () => {
  const c = rankCandidates([base('w', { termId: 'd' })], [term('d', -1, -12)], null, '2026-10-04')[0]
  expect(c.why).toMatch(/^d -12% on Wikipedia and Reddit; A\$\d+\.\d\d profit a sale at A\$\d+\.95; 1,000 dropshippers list it\.$/)
  expect(c.why).not.toMatch(/[–—−]/)
})
it('match strength and demand count for ten percent each', () => {
  const exact = rankCandidates([base('e', { match: 1 })], [term('a', 1, 0)], null, '2026-10-04')[0].score
  const close = rankCandidates([base('c', { match: 0.6 })], [term('a', 1, 0)], null, '2026-10-04')[0].score
  expect(exact - close).toBeCloseTo(0.04, 3)
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run radar/test/rank.test.ts`
Expected: the new cases fail (old weights, no `thin`, old `why`); the penalty and firstSeen cases may still pass.

- [ ] **Step 3: Rewrite `rankCandidates`** per Interfaces and spec section 5.

- [ ] **Step 4: Run it**

Run: `npx vitest run radar/test/rank.test.ts`
Expected: PASS, penalty cases included.

- [ ] **Step 5: Commit**

```bash
git add radar/src/rank.ts radar/src/types.ts radar/test/rank.test.ts
git commit -m "radar v2: rank on trend heat and profit per sale, A$20 floor, plain why line"
```

### Task 5: Run wiring, rejections and novelty in the file

**Files:**
- Modify: `radar/src/run.ts`, `radar/src/types.ts` (`RadarFile.rejected?`, `RadarFile.noveltyHidden?`), `radar/test/make-sample.ts`, `src/radar/fixtures/radar.sample.json` (regenerated)
- Test: `radar/test/run.test.ts`

**Interfaces:**
- Consumes: `searchTerm` (Task 3), `matchTitle` (Task 1), `filterNovelty` (Task 2), `rankCandidates`/`Unranked` (Task 4).
- Produces: in `runRadar`, per selected term: take passing items in order; for each, fetch detail; `matchTitle(detail.name, term)`; a failure pushes a `Rejected` (`reason` prefixed `detail: `) and the next item is tried until `PER_TERM` candidates are built or items run out; each `Unranked` carries `match: strength`. `rejected` = search rejections plus detail rejections, in term order, first 60. `novelty` = `filterNovelty(feed with termId)` items; `noveltyHidden` = its `hidden`. Stale previous candidates are carried as today (no re-ranking).
- `make-sample.ts` emits `thin`, `match`, three `rejected` entries (the cat toy, a backpack, the zircon ring with their reasons) and `noveltyHidden: 2`; regenerate with `npx tsx radar/test/make-sample.ts`.

- [ ] **Step 1: Write the failing tests**

- `'a detail name that fails the rules is rejected and the next item takes the slot'`: `fakeHttp` with `/product/query` returning a "Projector Lens Cap" detail for the first pid and the fixture query for the rest; `only: ['laser-projector']`; expect `radar.rejected` to contain `{ pid: <first>, reason: 'detail: has "lens cap"' }` and `radar.candidates.length` to equal the number of remaining passing items (up to 3).
- `'rejections are capped at 60'`: a `/product/list` returning 40 failing titles per call across two terms; expect `radar.rejected!.length` to be 60.
- `'novelty is filtered and the hidden count recorded'`: a feed fixture with one blocked title added; expect `radar.novelty` to exclude it and `radar.noveltyHidden` to be 1.
- Existing `'cj candidates carry money, flags, freight and score'` also asserts `typeof c.thin === 'boolean'` and `c.match` in `[0.6, 1]`.

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run radar/test/run.test.ts`
Expected: the new cases fail (no `rejected`, no `noveltyHidden`, no detail re-check).

- [ ] **Step 3: Implement** per Interfaces; update `make-sample.ts` and regenerate the sample.

- [ ] **Step 4: Run the suite, typecheck and the offline Radar**

Run: `npx vitest run && npm run typecheck && npm run radar:dry`
Expected: all pass; the dry run prints its table with no exception.

- [ ] **Step 5: Commit**

```bash
git add radar/src/run.ts radar/src/types.ts radar/test/run.test.ts radar/test/make-sample.ts src/radar/fixtures/radar.sample.json
git commit -m "radar v2: re-check detail names, record rejections, filter novelty in the file"
```

### Task 6: Radar page

**Files:**
- Create: `src/radar/components/RejectedList.tsx`
- Modify: `src/radar/components/CandidateCard.tsx`, `src/radar/components/NoveltyRail.tsx`, `src/radar/RadarApp.tsx`, `src/radar/lib.ts`
- Test: `src/radar/radar.test.tsx`

**Interfaces:**
- Consumes: `PROFIT_FLOOR` (Task 4), `filterNovelty` (Task 2), `Rejected` (Task 3), `signedPct` from `src/lib/text`.
- Produces: `export const isThin = (c: Candidate): boolean => c.thin ?? c.money.netAud < PROFIT_FLOOR` in `lib.ts`; `export const matchLabel = (c: Candidate): 'exact match' | 'close match' => c.match === 1 ? 'exact match' : 'close match'`; `noCandidatesReason(file)` returns, when `file.candidates` is empty and `file.rejected?.length`, the copy: `CJ answered, but none of its ${n} products matched the watch terms. See "Thrown out today" below.`; `RejectedList({ items, terms }: { items: Rejected[]; terms: TermScore[] })`.
- `CandidateCard`: headline `A$<netAud> a sale` (`numeral`, 26px) with `at A$<retailAud>` beside it; `matchLabel(c)` as a small tag next to the term label (replaces the old "keyword match" tag); the trend tag uses `signedPct(delta)`; the freight days use a hyphen; the money table and Add to shop unchanged.
- `RadarApp`: `visible` splits into `clear` and `thin` (`isThin`); `clear` renders as today; `thin` renders under a `<details>` whose summary is `Under A$${PROFIT_FLOOR} a sale (${thin.length})`; `RejectedList` renders after the lists when `file.rejected?.length`, with summary `Thrown out today (${n})`, grouped by term label, each item `name` as text and `reason`.
- `NoveltyRail`: renders `filterNovelty(items)`; when `hidden + (file.noveltyHidden ?? 0) > 0` (the page-side count plus the pipeline's), a line `${n} hidden (alcohol, tobacco, weapons or adult)`.

- [ ] **Step 1: Write the failing tests** in `src/radar/radar.test.tsx`

- `'cards lead with profit per sale'`: the first card shows `A$<netAud of the top sample candidate> a sale`.
- `'thin candidates sit under the A$20 group'`: the sample has at least one thin candidate; a `<summary>` reading `Under A$20 a sale (n)` exists and the thin candidate's name is inside its `<details>`.
- `'thrown out today lists rejections with reasons'`: summary `Thrown out today (3)` and the text `has "pet"` (or the reason the sample carries for the cat toy).
- `'novelty hides junk and says so'`: mount a file whose novelty includes "Cannabis Infused Wine" and `noveltyHidden: 2`; the title is absent and `3 hidden (alcohol, tobacco, weapons or adult)` is present.
- `'all products rejected explains itself'` (Review Focus 3): `{ ...sample, candidates: [], rejected: [3 entries] }` shows `CJ answered, but none of its 3 products matched the watch terms.`
- `'an old file without the new fields renders'` (Review Focus 5): delete `thin`, `match` from every candidate and `rejected`, `noveltyHidden` from the file; the page renders, thin candidates still group by `money.netAud`, cards say `close match`, no "Thrown out today".
- `'no en or em dash or unicode minus on the radar page'`: `document.body.textContent` does not match `/[–—−]/`.

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/radar/radar.test.tsx`
Expected: the new cases fail; existing cases may fail only where copy changed (update those assertions in Step 3 and ledger it).

- [ ] **Step 3: Implement** per Interfaces.

- [ ] **Step 4: Run the suite, typecheck and build**

Run: `npx vitest run && npm run typecheck && npm run build`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/radar
git commit -m "radar v2: profit-led cards, thin group, thrown out today, filtered novelty"
```

### Task 7: Replay the real run and check the page

**Files:**
- Create: `radar/test/replay.test.ts`
- Verify: Radar page screenshots via `shot.py` (radar scenarios) or a scratch Playwright script

**Interfaces:**
- Consumes: everything above.

- [ ] **Step 1: Write the replay test**

`radar/test/replay.test.ts` builds `Unranked` entries for the 30 titles in spec section 7 and the 4 October money figures (landed, retail, net, listed, weight as listed there), runs each through `matchTitle` with its term and ranks the survivors with the 4 October term deltas (smart-lock +480 medium, laser-projector +285 medium, desk-3d-printer +880 medium, smartwatch -2 low, open-ear-buds +2 low, gan-charger -11 medium). Asserts: no rejected title from section 7 survives; every kept title survives; the top two candidates are laser-projector items; the smart door lock ranks above every smartwatch, open-ear and GaN candidate; no 3D-printer title is present.

- [ ] **Step 2: Run it**

Run: `npx vitest run radar/test/replay.test.ts`
Expected: PASS. A failure means a rule or weight is off: fix the rule or weight (not the expectation) only if the spec's success line still holds, and ledger it.

- [ ] **Step 3: Look at the Radar page**

Run: `npm run build && python3 shot.py` (or the scratch script) and read the `radar-*` captures plus one of the `?demo=1` page at 1440 and 390: profit-led cards, the "Under A$20 a sale" group, "Thrown out today", the novelty hidden line, no horizontal scroll.
Expected: matches the spec section 8; fix any layout defect with a test-first change in Task 6's files.

- [ ] **Step 4: Full verification**

Run: `npx vitest run && npm run typecheck && npm run build && npm run radar:dry`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add radar/test/replay.test.ts
git commit -m "radar v2: replay the 4 October run through the new matcher and ranking"
```
