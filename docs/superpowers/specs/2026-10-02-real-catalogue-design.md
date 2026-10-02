# Real catalogue — design

Date: 2026-10-02 · Status: for review · Build 1 of 4 (catalogue → pages → worker → Trend Radar)

## Goal

Replace the 19 invented products with 21 real, currently sold products whose names, prices, specs and compatibility facts were verified today on the maker's site or a major Australian retailer, so the storefront, the works-with checker and the Trend Scout tell the truth about real devices. Photos come from Nick; every product has photo slots and renders the procedural placeholder until a photo is added.

## The products

Prices are AUD. `price` is what a shopper would pay today at the cheapest verified retailer; `compareAt` is the maker's RRP when it is higher. Route is a proposal (Sydney stock for fast movers and heavy items, supplier direct for the long tail) and is Nick's call.

| id | Product | Price (RRP) | Route | Works-with facts that matter | Source |
| --- | --- | --- | --- | --- | --- |
| xgimi-mogo-4-laser | XGIMI MoGo 4 Laser (hero) | 1,229 (1,995) | Sydney | HDMI, USB-C PD in 65 W, iOS/Android app, Google Cast, no AirPlay, AU plug | au.xgimi.com |
| xgimi-vibe-one | XGIMI Vibe One (battery) | 595 (599) | Sydney | HDMI, DC barrel (no PD), Google TV | jbhifi.com.au |
| ringconn-gen-3 | RingConn Gen 3 smart ring | 569 | Sydney | iOS 17+ / Android 10+, no subscription, sizes US 6–15, 5 finishes (+30 brushed) | jbhifi.com.au |
| oura-ring-5 | Oura Ring 5 | 649 | Sydney | iOS/Android, membership A$9.99/mo, sizes US 6–13, Gold/Stealth/Brushed/Deep Rose +150 | jbhifi.com.au |
| rayban-meta-gen-3 | Ray-Ban Meta Gen 3 Wayfarer | 679 | Sydney | iOS 17+ / Android 10+; Transitions lens +90; Wayfarer/Aviator/Zena | jbhifi.com.au, opsm.com.au |
| bose-ultra-open-2 | Bose Ultra Open Earbuds (2nd Gen) | 449 (449.95) | Sydney | iOS/Android, multipoint, IPX4 | bose.com.au |
| plaud-notepin-s | Plaud NotePin S | 239 (299) | Supplier | iOS/Android, magnetic pin, Find My; Starter plan free | au.plaud.ai |
| anker-maggo-10k | Anker MagGo Power Bank 10K Qi2 | 119.96 (149.95) | Supplier | magnetic (Qi2); needs a magnet ring on Android; 15 W wireless, 27 W USB-C, 20 W in | anker.com/au |
| aqara-camera-e1 | Aqara Camera E1 2K pan-tilt | 89 (119) | Supplier | Apple Home (HKSV), Google Home, Alexa; no Matter; USB-C 5 V, no wall adapter in box | aqarastore.com.au |
| nanoleaf-matter-strip-5m | Nanoleaf Essentials Matter Lightstrip 5 m | 129 | Supplier | Matter over Thread, needs a Thread border router; Apple/Google/Alexa; Bluetooth fallback | nanoleaf.me/en-AU, retailers |
| segway-e3-pro | Segway-Ninebot KickScooter E3 Pro | 999 (1,199) | Sydney | iOS/Android app; 25 km/h cap; state rules vary | jbhifi.com.au, segway.com.au |
| bambu-a1-mini | Bambu Lab A1 mini | 319 | Sydney | Bambu Handy iOS 13+ / Android 6+; Bambu Studio Win/mac | jbhifi.com.au |
| eufy-x10-pro-omni | eufy X10 Pro Omni | 1,299 (1,699.95) | Sydney | Google Home and Alexa only; no Matter / Apple Home | eufy.com/au |
| omnilux-contour-face | Omnilux Contour Face | 605 | Supplier | No app; corded controller; FDA-cleared, TGA-listed per stockists | omniluxled.com, AU stockists |
| elite-yard-master-2-100 | Elite Screens Yard Master 2, 100″ | 620 | Sydney | Matte white 1.1–1.3 gain; not ALR; 9.2 kg folding frame | jbhifi.com.au |
| anker-prime-100w | Anker Prime Charger 100 W GaN | 89.95 (129.95) | Sydney | pdOut 100 W (65 + 35 on two ports); AU plug | anker.com/au |
| chipolo-pop | Chipolo POP | 50 | Supplier | Apple Find My or Google Find Hub, chosen at setup (option); CR2032; IP55 | chipolo.net, theaureview.com |
| aqara-hub-m3 | Aqara Hub M3 | 297 (299) | Sydney | Matter controller + bridge, Thread border router, Zigbee; Apple/Google/Alexa; USB-C 5 V | officeworks.com.au |
| esr-halolock-ring | ESR HaloLock Universal Ring 360 (2-pack) | 26.38 | Supplier | givesMagnets: adds a steel ring so Qi2 accessories attach to Android cases | au.esrtech.com |
| sansai-au-travel-adapter | Sansai STV-017 inbound travel adapter (UK/US/EU → AU) | 12.05 | Sydney | adapterFor AU; 10 A; no USB | jbhifi.com.au |
| withings-body-smart | Withings Body Smart scale | 199 | Supplier | iOS 14+ / Android 10+; Apple Health, Health Connect | jbhifi.com.au |

Dropped from the old catalogue: the invented solar power bank (no verified Qi2 solar bank exists at retail) and the fictional "Snap Case" (replaced by the ESR ring). Added: Oura Ring 5 as the second ring so the compare table has a real pair, and the Withings scale for the health category.

### Decisions and caveats

- There is no battery-powered 4K laser portable at retail; the hero is the 1080p MoGo 4 Laser, and the copy says 1080p. The procedural 3D model keeps the projector shape; its callouts become the MoGo 4 Laser's parts (triple-laser DLP engine, 71 Wh battery, 2 × 6 W Harman Kardon speakers, Google TV board, 360° stand).
- The "Product of the week" test card cannot show "our bench" numbers for a product nobody here has measured. Its right column becomes **Independent tests**, each row linked to the review that measured it: brightness 370–390 ANSI lumens in standard mode (laurentwillen.com) against the 550 ISO claim; battery 92 min at full brightness (GameRevolution) and 1 h 53 min in Standard (Expert Reviews) against the 2.5 h Eco claim; input lag 40 ms (laurentwillen.com); boot to home 51 s (New Edge Times); fan noise under 40 dB close up (no 1 m measurement published) against ≤28 dB claimed. Rows nobody measured are left out, not invented. A footnote says the column is replaced by NEXUS bench results once a unit is tested.
- Nanoleaf's 5 m Thread kit looks end-of-line (gone from Nanoleaf's AU shop, in stock at AU retailers). Keep it, flag "limited stock", and note the Matter-over-Wi-Fi replacement as the runner-up.
- Chipolo POP sells singles at a verified A$50; the 4-pack AUD price is unverified, so the store sells singles with a quantity stepper rather than inventing a bundle price.
- Ratings: use a retailer or maker rating only where a value and count were both visible; otherwise show "No reviews yet" rather than a number. Verified: Anker Prime 4.8 (329), MagGo 4.7 (532), Omnilux 4.5 (2,243), Plaud 4.86 (7), MoGo 4 Laser 4.47 (17), Segway E3 Pro 5.0 (28). Withings 4.4 and Bambu 5.0 have no visible count: shown as "No reviews yet".
- Unverified items stay visible as notes in the product data (`notes` field) and are not shown as facts: HDMI version on both XGIMI units, AU-unit plug style on the Anker Prime, Gen 3 water rating on the Ray-Ban Meta, Omnilux ARTG number.
- Prices move; the data file carries `priceCheckedAt: 2026-10-02` and the PDP shows "Price checked 2 Oct 2026".

### My setup changes

- "Google Home (Nest Hub)" becomes "Google Home (Nest Mini)": the Nest Hub 2nd gen is a Thread border router, which would make the Thread warning wrong. The Nest Mini is not.
- "Aether Cube 65 W" becomes "Anker 65 W charger you already own" (same pdOut 65), so the MoGo 4 Laser's 65 W claim passes and a future 100 W-class product warns.

## Photos

One folder, any size, JPG or PNG, up to three per product, named `<id>-1.jpg`, `<id>-2.jpg`, `<id>-3.jpg` with the ids from the table (for example `xgimi-mogo-4-laser-1.jpg`, `chipolo-pop-2.png`). The first photo is the card and hero image; the others go in the gallery. I crop to 4:3, resize to 1200 px, convert to WebP at quality 82 (roughly 60–90 KB each) and embed them as data URIs, so the published page stays well under its 16 MB limit. Until a product has a photo it shows the procedural render.

## Data model changes

- `Product` gains `priceCheckedAt: string`, `sources: string[]`, `notes?: string`, `photos?: string[]` (data URIs, filled by a build step from `photos/`), `rating: { value: number; count: number } | null`.
- `facts.provides` kinds gain `'usb-a'` and `'dc'`; `Fulfil` unchanged.
- Trend numbers stay illustrative in the data file until build 3 writes `trends.json`; each product's `trend.source` says "illustrative" until then.

## Where it shows

Every page that reads `products` picks the change up: cards, PDP (name, price, compareAt, options, in box, specs, notes line, sources list under the specs tab), compare (two rings, two projectors), Trend Scout kits (movie night: MoGo 4 Laser + Yard Master 2 + Anker Prime; gift for a runner: Bose Ultra Open + Chipolo POP + RingConn), the works-with examples (MagGo + Pixel 9 → ESR ring; Nanoleaf + Nest Mini → Aqara Hub M3; Chipolo on Find My + Pixel 9 → switch to Find Hub; MoGo 4 Laser plug option US → switch to AU).
