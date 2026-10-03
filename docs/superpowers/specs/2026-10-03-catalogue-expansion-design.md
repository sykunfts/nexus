# Catalogue expansion — design

Date: 2026-10-03 · Status: for review · Build 2b (runs alongside the pages build; data only)

## Goal

Grow the verified branded tier from 21 to about 60 real products sold today, sourced from brands and retailers worldwide rather than Australian shelves only, so every category and collection page has depth and the store reads as a global trend-tech shop. Same rules as the first catalogue: real names, verified price and specs with a source, typed works-with facts, ratings only where a value and count were visible, notes for anything unverified. The white-label tier (hundreds of items from CJ) arrives with Trend Radar and is not part of this spec.

## Selection

Roughly 40 additions, chosen for trend velocity in 2026 and spread across the seven nav sections, with no category under four products and no brand over four. Candidate pool (each confirmed as currently sold before inclusion; dropped if not):

- Cinema and audio: Samsung The Freestyle (3rd gen), Anker Nebula Capsule 3 Laser, Dangbei N2 / Atom, Yaber K3 Pro, Marshall Emberton III, Sony LinkBuds Open, Shokz OpenFit 2, Nothing Ear (open), JBL Flip 7.
- Wearables: Ultrahuman Ring Air, Samsung Galaxy Ring, Whoop 5.0, Garmin Index Sleep Monitor, Even Realities G1, Xreal One, Meta Ray-Ban Display, Bee / Limitless pendant.
- Smart home: Reolink Argus 4 Pro, SwitchBot Lock Ultra, Govee RGBIC Neon Rope Light 2, Nanoleaf Blocks, Aqara U300 lock, Dreame X50 Ultra, Roborock Saros 10, Ecovacs Winbot W2 Omni, SwitchBot Hub 3, Eve Energy (Matter).
- Power and mobility: Ugreen Nexode 100 W, Anker Prime 26K, EcoFlow River 3, Baseus Nomos, Belkin BoostCharge Pro 3-in-1 Qi2, Segway Ninebot F3 Pro, NIU KQi 300X.
- Health: Therabody TheraFace Mask, CurrentBody Skin LED Series 2, Withings ScanWatch 2, Hyperice Normatec Elite, Shark CryoGlow.
- Maker and work: Bambu Lab P2S, Creality K2, Elegoo Centauri Carbon, xTool F2 Ultra, Plaud Note Pro, Flipper Zero, Raspberry Pi 5 kit, DJI Osmo Pocket 3, Insta360 X5, Keychron K2 HE, 8BitDo Ultimate 2.

## Data

Each product follows the existing `Product` shape with these additions, shared with the pages spec:

- `priceSource?: { amount: number; currency: 'USD' | 'GBP' | 'EUR' | 'JPY' | 'AUD'; at: string }` when the verified price was not in AUD; `price` stays AUD at the snapshot rate in `currency.ts` and `priceCheckedAt` is the check date.
- `fulfil.origin` per the pages spec: branded products stocked in Sydney stay `AU`; others ship supplier-direct from the maker's region (`US`, `EU`, `UK`, or `CN` for Chinese brands such as Dreame, Roborock, Ugreen, Dangbei, Yaber, Creality, Elegoo, xTool).
- `listedAt`: the date the product entered the catalogue (3 Oct 2026 for this batch) or its release date if later than 23 Sep 2026.
- `market: 'global' | 'AU' | 'US' | 'EU' | 'UK'` for the market the listing was verified in; the collection "Available in your region" filters on it against the shopper's region (global and the shopper's own market pass).

Works-with facts are typed per product exactly as before (app platforms, magnets, home protocols and Thread, plug and voltage, ports, charger watts); a product whose plug variant for the shopper's region is not sold gets the plug option group limited to the variants that exist.

## Process

Four research subagents, one per bucket (cinema+audio+power, wearables+health, smart home, maker+work+mobility), each returning JSON in the existing schema with sources and `notes`, verifying on the maker's site plus one major retailer in the product's home market (Amazon US/UK/DE, JB Hi-Fi, Currys, MediaMarkt, Bic Camera). Prices are converted at the `currency.ts` snapshot rates. Anything unverifiable is dropped, not guessed. The 3D model and the test card stay on the MoGo 4 Laser.

## Where it shows

No page changes: the query engine, collections, compare and the Trend Scout read the larger catalogue. The nav's collection items that were trimmed for emptiness (soundbars, party speakers, e-bikes, massage guns, portable monitors and so on) come back as collections once products exist for them.
