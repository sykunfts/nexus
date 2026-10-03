# Catalogue research schema (expansion batch, 3 Oct 2026)

Output: a JSON array, one object per product, written to the file named in your brief. Nothing else in the file.

Rules (non-negotiable):
- Only products that are **on sale today** (3 Oct 2026) at the maker's site or a major retailer. If you cannot confirm it is currently sold at a visible price, omit the product entirely.
- Every number must come from a page you fetched. Record the page's domain in `sources` and the full URL of the price page in `priceSource.url`. No guessing, no "typical" values. If a spec is not on a page you read, leave it out.
- `rating` only when BOTH a value and a review count are visible on the same page; otherwise `null`.
- Anything you could not verify but that matters (water rating, HDMI version, plug style, subscription detail) goes in `notes` as prose, never as a fact.
- Prices: give the exact listed amount and currency from the page in `priceSource` (and `compareAtSource` when the maker's RRP is higher). Do not convert currencies.
- Keep taglines factual, under 140 characters, sentence case, no exclamation marks, no superlatives you did not verify.
- Use plain ASCII except for × (multiplication), ° and the en dash in ranges.

```jsonc
{
  "id": "brand-model-slug",                 // lowercase, hyphens, unique
  "name": "Model name without the brand",   // e.g. "Nebula Capsule 3 Laser"
  "brand": "Anker",
  "category": "Home cinema",                // one of: Home cinema, Audio, Wearables, Smart home, Power, Mobility, Maker, Work, Health, Accessories
  "tagline": "A 1080p laser projector with Google TV, 2.5 hours of battery and a 52 W USB-C charge.",
  "priceSource": { "amount": 549.99, "currency": "USD", "at": "amazon.com", "url": "https://..." },
  "compareAtSource": { "amount": 599.99, "currency": "USD", "at": "seenebula.com" },   // optional, only if higher than priceSource
  "rating": { "value": 4.6, "count": 2143, "at": "amazon.com" },                        // or null
  "origin": "US",            // where it would ship from if sold supplier-direct: the brand's home region: AU | CN | US | EU | UK
  "market": "global",        // where the price was verified: global | AU | US | EU | UK (use global when sold on the maker's worldwide store)
  "releasedAt": "2025-09-17",           // optional ISO date if known from a page
  "visual": "projector",     // one of: projector, projector-can, ring, powerbank, glasses, cam, strip, scooter, earbuds, pin, printer, robovac, mask, screen, tag, hub, charger, case, adapter, scale
  "hue": 24,                 // accent hue 0–360 for the procedural render
  "variants": [{ "id": "black", "label": "Black", "swatch": "#1b1b1f" }],             // colour finishes actually sold; delta (number) only for a verified surcharge
  "options": [],             // optional option groups: { "id", "label", "choices": [{ "id", "label", "sub", "delta", "facts": {} }] } for verified sizes/editions/plug variants
  "facts": {                 // works-with facts, only the ones you verified:
    "app": ["ios", "android"],
    "magnetic": true,              // attaches to a phone with Qi2/MagSafe magnets
    "home": ["homekit", "google", "alexa", "matter", "thread"],   // smart-home platforms it works with (subset)
    "needsThread": true,           // Matter over Thread only
    "plug": "US",                  // plug it ships with in the market verified: AU | NZ | US | CA | UK | EU | JP
    "voltage": "100-240",          // or "110"
    "tracker": "find-my",          // or "find-hub"; only for finder tags
    "provides": [{ "kind": "hdmi", "count": 1 }],   // kinds: hdmi, usb-c, usb-a, jack, dc
    "pdOut": 100,                  // watts a charger or bank supplies
    "pdInMin": 65,                 // watts it needs to charge while in use (projectors)
    "givesMagnets": true,          // a ring/case that adds magnets to a phone
    "adapterFor": "AU"
  },
  "inBox": ["Projector", "Remote", "65 W USB-C adapter"],   // optional, from the maker's page
  "specs": [
    { "group": "Picture", "rows": [
      { "label": "Resolution", "value": "1080p (1920 × 1080)", "n": 2073600, "better": "high" },
      { "label": "Brightness", "value": "300 ISO lumens claimed", "n": 300, "better": "high" }
    ] }
  ],                         // 4 to 10 rows; add "n" and "better" ("high" | "low") on numeric rows so compare can mark a winner
  "sources": ["seenebula.com", "amazon.com"],
  "notes": "HDMI version not stated. Water rating not published.",   // optional
  "checkedAt": "2026-10-03"
}
```

Spec row labels to reuse so compare lines up across products: Resolution, Brightness, Battery, Charging, Weight, Size, Noise, Speakers, Streaming, Wireless, Inputs, Sensors, Thickness, Water resistance, Subscription, App, Sizes, Capacity, Output, Ports, Suction, Runtime, Range, Top speed, Motor, Build volume, Speed, Camera, Storage, Platforms, Connectivity, Metrics, LEDs, Session, Warranty, Clearance.
