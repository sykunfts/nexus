/*
  Catalogue model + the real catalogue.
  21 products sold today, names, prices, specs and works-with facts checked on 2 Oct 2026 at the maker's
  site or a major Australian retailer (see `sources` on each product). Prices are AUD, GST inclusive.
  Trend numbers are sample data until the trend worker writes trends.json.
  In production: products come from Medusa, trend signals from the trend-ingestion service,
  fulfilment routes from the supplier connectors.
*/
import { PHOTOS } from './photos.generated'
import { EXPANSION } from './data.expansion'

export type Visual =
  | 'projector' | 'projector-can' | 'ring' | 'powerbank' | 'glasses' | 'cam' | 'strip' | 'scooter' | 'earbuds'
  | 'pin' | 'printer' | 'robovac' | 'mask' | 'screen' | 'tag' | 'hub' | 'charger' | 'case' | 'adapter' | 'scale'
  | 'speaker' | 'lock' | 'band' | 'watch' | 'device'

export type OS = 'ios' | 'android'
export type HomeProto = 'matter' | 'thread' | 'homekit' | 'google' | 'alexa'
export type Region = 'AU' | 'NZ' | 'US' | 'CA' | 'UK' | 'EU' | 'JP'
export type PlugFamily = 'I' | 'AB' | 'G' | 'CF'
export const PLUG_FAMILY: Record<Region, PlugFamily> = { AU: 'I', NZ: 'I', US: 'AB', CA: 'AB', JP: 'AB', UK: 'G', EU: 'CF' }
export const MAINS: Record<Region, number> = { AU: 230, NZ: 230, US: 120, CA: 120, JP: 100, UK: 230, EU: 230 }
export type PortKind = 'hdmi' | 'usb-c' | 'usb-a' | 'jack' | 'dc'
export type TrackerNet = 'find-my' | 'find-hub'

export const PORT_LABEL: Record<PortKind, string> = { hdmi: 'HDMI', 'usb-c': 'USB-C', 'usb-a': 'USB-A', jack: '3.5 mm audio', dc: 'DC in' }
export const PROTO_LABEL: Record<HomeProto, string> = { matter: 'Matter', thread: 'Thread', homekit: 'Apple Home', google: 'Google Home', alexa: 'Alexa' }
export const REGION_LABEL: Record<Region, string> = {
  AU: 'Australia (Type I, 230 V)', NZ: 'New Zealand (Type I, 230 V)', US: 'United States (Type A/B, 120 V)', CA: 'Canada (Type A/B, 120 V)',
  UK: 'United Kingdom (Type G, 230 V)', EU: 'Europe (Type C/F, 230 V)', JP: 'Japan (Type A/B, 100 V)',
}

export interface Port { kind: PortKind; count: number }
export interface Requirement { anyOf: PortKind[]; label: string }

/** Typed facts the "works with your setup" engine reasons over. */
export interface CompatFacts {
  app?: OS[]                 // companion app platforms
  magnetic?: boolean         // attaches to the phone with Qi2 / MagSafe magnets
  home?: HomeProto[]         // smart-home protocols the device speaks
  needsThread?: boolean      // needs a Thread border router on the network
  plug?: Region              // plug type it ships with
  voltage?: '100-240' | '110'
  tracker?: TrackerNet       // finder network the tag joins
  provides?: Port[]          // physical inputs it offers (a projector's HDMI)
  requires?: Requirement[]   // physical ports it needs on something else
  pdOut?: number             // watts a charger supplies
  pdInMin?: number           // watts needed to charge while in use
  // facts a setup item contributes
  phone?: { os: OS; magnets: boolean; trackerNet: TrackerNet }
  hubs?: HomeProto[]         // protocols a home hub provides
  region?: Region            // where the shopper lives
  givesMagnets?: boolean     // a ring or case that adds magnets to a phone
  adapterFor?: Region        // a plug adapter that outputs this region's socket
}

export interface Variant { id: string; label: string; swatch: string; hue: number; delta?: number }
export interface Choice { id: string; label: string; sub?: string; delta: number; facts?: Partial<CompatFacts> }
export interface OptionGroup { id: string; label: string; choices: Choice[] }
export interface SpecRow { label: string; value: string; n?: number; better?: 'high' | 'low' }
export interface SpecGroup { group: string; rows: SpecRow[] }
export interface Trend { label: 'Viral' | 'Trending' | 'Rising' | 'Steady'; delta: number; series: number[]; source: string }
export type Origin = 'AU' | 'CN' | 'US' | 'EU' | 'UK'
export interface Fulfil { route: 'warehouse' | 'supplier'; origin: Origin }
export interface Rating { value: number; count: number; at: string }
export type Market = 'global' | 'AU' | 'US' | 'EU' | 'UK'
export interface PriceSource { amount: number; currency: 'USD' | 'GBP' | 'EUR' | 'JPY' | 'AUD'; at: string }

export interface Product {
  id: string
  name: string
  brand: string
  category: string
  tagline: string
  price: number               // AUD, GST inclusive, cheapest verified retailer on priceCheckedAt
  compareAt?: number          // maker's RRP when higher
  priceCheckedAt: string      // ISO date
  priceSource?: PriceSource   // the listed price when it was verified in another currency
  listedAt: string            // ISO date the product entered the catalogue
  releasedAt?: string         // ISO release date when a page stated it; "newest" sorts by this, unknown last
  market: Market              // where the listing was verified
  sources: string[]           // where the price and specs were checked
  notes?: string              // things we could not verify, shown as a note, never as a fact
  rating: Rating | null       // only where a value and a count were both visible
  throwRatio?: { value: number; source: string }   // projectors: distance ÷ image width, verified at build time
  stock: 'in' | 'low' | 'out'
  stockCount?: number
  fulfil: Fulfil
  visual: Visual
  hue: number
  photos?: string[]           // data URIs, filled by scripts/embed-photos.mjs from photos/<id>-N.jpg
  variants: Variant[]
  options?: OptionGroup[]
  badges?: string[]
  trend: Trend
  specs: SpecGroup[]
  facts: CompatFacts
  inBox?: string[]
}

export type GearKind = 'phone' | 'hub' | 'charger' | 'source' | 'region'
export interface GearItem {
  id: string
  kind: GearKind
  name: string
  detail: string
  facts: CompatFacts
  defaultOn: boolean
  deviceId?: string      // the devices.ts entry it came from, when added from the picker
}

export const PRICE_CHECKED = '2026-10-02'
export const priceCheckedText = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })

const WAREHOUSE: Fulfil = { route: 'warehouse', origin: 'AU' }
const SUPPLIER: Fulfil = { route: 'supplier', origin: 'CN' }
const SAMPLE = 'Sample data until the trend worker runs'

const PLUG_OPTIONS: OptionGroup = {
  id: 'plug',
  label: 'Plug type',
  choices: [
    { id: 'AU', label: 'AU', sub: 'Type I', delta: 0, facts: { plug: 'AU' } },
    { id: 'US', label: 'US', sub: 'Type A/B', delta: 0, facts: { plug: 'US' } },
    { id: 'EU', label: 'EU', sub: 'Type C/F', delta: 0, facts: { plug: 'EU' } },
    { id: 'UK', label: 'UK', sub: 'Type G', delta: 0, facts: { plug: 'UK' } },
  ],
}

const sizes = (from: number, to: number): OptionGroup => ({
  id: 'size',
  label: 'Size (free sizing kit ships first)',
  choices: Array.from({ length: to - from + 1 }, (_, i) => ({ id: String(from + i), label: `US ${from + i}`, delta: 0 })),
})

const BLACK = { id: 'black', label: 'Black', swatch: '#1b1b1f' }
const WHITE = { id: 'white', label: 'White', swatch: '#e8e8ec' }

const catalogue: Omit<Product, 'photos' | 'listedAt' | 'market'>[] = [
  /* ---------------- Home cinema ---------------- */
  {
    id: 'xgimi-mogo-4-laser',
    name: 'MoGo 4 Laser',
    brand: 'XGIMI',
    category: 'Home cinema',
    tagline: 'A can-sized triple-laser 1080p projector with Google TV, a 2.5-hour battery and a stand that swivels 360°.',
    price: 1229,
    compareAt: 1995,
    priceCheckedAt: PRICE_CHECKED,
    sources: ['au.xgimi.com', 'jbhifi.com.au'],
    notes: 'HDMI version is not stated on the AU listing. No AirPlay; use Google Cast or HDMI from an iPhone.',
    rating: { value: 4.47, count: 17, at: 'au.xgimi.com' },
    throwRatio: { value: 1.2, source: 'https://au.xgimi.com/products/mogo-4-laser' },
    stock: 'in',
    fulfil: WAREHOUSE,
    visual: 'projector-can',
    hue: 24,
    badges: ['Trending'],
    trend: { label: 'Trending', delta: 140, series: [12, 14, 13, 18, 24, 31, 40, 52], source: SAMPLE },
    variants: [{ id: 'silver', label: 'Silver', swatch: '#c9ccd3', hue: 24 }],
    options: [PLUG_OPTIONS],
    facts: {
      app: ['ios', 'android'],
      provides: [{ kind: 'hdmi', count: 1 }, { kind: 'usb-a', count: 1 }, { kind: 'usb-c', count: 1 }],
      pdInMin: 65,
      plug: 'AU',
      voltage: '100-240',
    },
    inBox: ['MoGo 4 Laser', 'Remote with voice control', '65 W USB-C power adapter (plug type as selected)', 'Quick-start guide'],
    specs: [
      { group: 'Picture', rows: [
        { label: 'Light source', value: 'Triple laser (red, green, blue), DLP' },
        { label: 'Resolution', value: '1080p (1920 × 1080)', n: 1920 * 1080, better: 'high' },
        { label: 'Brightness', value: '550 ISO lumens claimed', n: 550, better: 'high' },
        { label: 'Focus', value: 'ToF autofocus, auto keystone, obstacle avoidance' },
      ] },
      { group: 'Sound and smart', rows: [
        { label: 'Speakers', value: '2 × 6 W, Harman Kardon', n: 12, better: 'high' },
        { label: 'Streaming', value: 'Google TV, Netflix native, Google Cast; no AirPlay' },
        { label: 'Wireless', value: 'Wi-Fi 5, Bluetooth 5.1' },
        { label: 'Inputs', value: 'HDMI (ARC), USB-A, USB-C power in' },
      ] },
      { group: 'Power and body', rows: [
        { label: 'Battery', value: '71.28 Wh, up to 2.5 h in Eco', n: 2.5, better: 'high' },
        { label: 'Charging', value: '65 W USB-C PD (accepts 65 to 150 W)', n: 65, better: 'high' },
        { label: 'Weight', value: '1.32 kg', n: 1.32, better: 'low' },
        { label: 'Size', value: '207.6 × 96.5 × 96.5 mm' },
        { label: 'Noise', value: '≤ 28 dB at 1 m claimed', n: 28, better: 'low' },
      ] },
    ],
  },
  {
    id: 'xgimi-vibe-one',
    name: 'Vibe One',
    brand: 'XGIMI',
    category: 'Home cinema',
    tagline: 'A 1080p LCD battery projector with Google TV for the bedroom wall, in Cloud Ash or Blue Spark.',
    price: 595,
    compareAt: 599,
    priceCheckedAt: PRICE_CHECKED,
    sources: ['jbhifi.com.au', 'au.xgimi.com'],
    notes: 'HDMI version and the full port list are not stated on the AU listing.',
    rating: null,
    throwRatio: { value: 1.3, source: 'https://www.projectorcentral.com/xgimi-vibe_one_battery_powered.htm' },
    stock: 'in',
    fulfil: WAREHOUSE,
    visual: 'projector',
    hue: 200,
    trend: { label: 'Steady', delta: 12, series: [20, 21, 19, 22, 23, 22, 24, 23], source: SAMPLE },
    variants: [
      { id: 'cloud-ash', label: 'Cloud Ash', swatch: '#b9bcc3', hue: 200 },
      { id: 'blue-spark', label: 'Blue Spark', swatch: '#3b5fa8', hue: 215 },
    ],
    options: [PLUG_OPTIONS],
    facts: { app: ['ios', 'android'], provides: [{ kind: 'hdmi', count: 1 }, { kind: 'dc', count: 1 }], plug: 'AU', voltage: '100-240' },
    inBox: ['Vibe One', 'Remote', '65 W DC power adapter (plug type as selected)', 'Quick-start guide'],
    specs: [
      { group: 'Picture', rows: [
        { label: 'Light source', value: 'LED, LCD' },
        { label: 'Resolution', value: '1080p (1920 × 1080)', n: 1920 * 1080, better: 'high' },
        { label: 'Brightness', value: '250 ISO lumens claimed', n: 250, better: 'high' },
        { label: 'Focus', value: 'Autofocus, auto keystone' },
      ] },
      { group: 'Sound and smart', rows: [
        { label: 'Speakers', value: '2 × 3 W, JBL', n: 6, better: 'high' },
        { label: 'Streaming', value: 'Google TV, Netflix native, Google Cast' },
        { label: 'Inputs', value: 'HDMI, DC in' },
      ] },
      { group: 'Power and body', rows: [
        { label: 'Battery', value: '38.48 Wh, about 1.2 h', n: 1.2, better: 'high' },
        { label: 'Charging', value: '65 W DC adapter, no USB-C PD', n: 0, better: 'high' },
        { label: 'Weight', value: '1.4 kg', n: 1.4, better: 'low' },
      ] },
    ],
  },
  {
    id: 'elite-yard-master-2-100',
    name: 'Yard Master 2, 100″',
    brand: 'Elite Screens',
    category: 'Home cinema',
    tagline: 'A 100-inch 16:9 outdoor frame screen in matte white that folds into its bag at 9.2 kg.',
    price: 620,
    priceCheckedAt: PRICE_CHECKED,
    sources: ['jbhifi.com.au', 'elitescreens.com'],
    rating: null,
    stock: 'in',
    fulfil: WAREHOUSE,
    visual: 'screen',
    hue: 24,
    trend: { label: 'Steady', delta: 18, series: [18, 19, 18, 20, 21, 20, 22, 22], source: SAMPLE },
    variants: [{ id: 'matte-white', label: 'Matte white', swatch: '#e8e8ec', hue: 24 }],
    facts: {},
    inBox: ['Frame, legs and ground stakes', 'CineWhite screen material', 'Carry bag'],
    specs: [
      { group: 'Screen', rows: [
        { label: 'Size', value: '100″ 16:9, 221 × 124.5 cm viewing area', n: 100, better: 'high' },
        { label: 'Material', value: 'CineWhite matte white, 1.1 gain; not ALR, so dim the lights' },
        { label: 'Weight', value: '9.2 kg', n: 9.2, better: 'low' },
        { label: 'Packed', value: '102 × 20 × 28 cm' },
        { label: 'Model', value: 'OMS100H2' },
      ] },
    ],
  },

  /* ---------------- Wearables ---------------- */
  {
    id: 'ringconn-gen-3',
    name: 'Gen 3 smart ring',
    brand: 'RingConn',
    category: 'Wearables',
    tagline: 'A 2.3 mm titanium ring that tracks sleep, heart rate and HRV for up to 14 days a charge, with no subscription.',
    price: 569,
    priceCheckedAt: PRICE_CHECKED,
    sources: ['jbhifi.com.au', 'ringconn.com'],
    rating: null,
    stock: 'in',
    fulfil: WAREHOUSE,
    visual: 'ring',
    hue: 40,
    badges: ['Viral'],
    trend: { label: 'Viral', delta: 212, series: [8, 9, 12, 15, 22, 30, 38, 61], source: SAMPLE },
    variants: [
      { id: 'matte-black', label: 'Matte Black', swatch: '#1b1b1f', hue: 40 },
      { id: 'future-silver', label: 'Future Silver', swatch: '#c9ccd3', hue: 40 },
      { id: 'royal-gold', label: 'Royal Gold', swatch: '#d8b25c', hue: 40 },
      { id: 'brushed-silver', label: 'Brushed Silver', swatch: '#b8bcc4', hue: 40, delta: 30 },
      { id: 'brushed-rose-gold', label: 'Brushed Rose Gold', swatch: '#d9a79a', hue: 40, delta: 30 },
    ],
    options: [sizes(6, 15)],
    facts: { app: ['ios', 'android'] },
    inBox: ['Ring', 'Charging case', 'USB-C cable', 'Sizing kit (ships first)'],
    specs: [
      { group: 'Ring', rows: [
        { label: 'Battery', value: 'Up to 14 days', n: 14, better: 'high' },
        { label: 'Thickness', value: '2.3 mm', n: 2.3, better: 'low' },
        { label: 'Water resistance', value: 'IP68, 10 ATM (100 m)', n: 100, better: 'high' },
        { label: 'Subscription', value: 'None' },
        { label: 'App', value: 'iOS 17+, Android 10+' },
        { label: 'Sizes', value: 'US 6 to 15' },
      ] },
    ],
  },
  {
    id: 'oura-ring-5',
    name: 'Ring 5',
    brand: 'Oura',
    category: 'Wearables',
    tagline: 'The best-known smart ring: 6 to 9 days a charge, 2.28 mm thin, with a membership for the full readouts.',
    price: 649,
    priceCheckedAt: PRICE_CHECKED,
    sources: ['jbhifi.com.au', 'ouraring.com'],
    notes: 'Oura shows a 4.93 rating with no visible review count, so no rating is shown here.',
    rating: null,
    stock: 'in',
    fulfil: WAREHOUSE,
    visual: 'ring',
    hue: 40,
    trend: { label: 'Trending', delta: 105, series: [14, 15, 17, 19, 22, 26, 31, 38], source: SAMPLE },
    variants: [
      { id: 'silver', label: 'Silver', swatch: '#c9ccd3', hue: 40 },
      { id: 'black', label: 'Black', swatch: '#1b1b1f', hue: 40 },
      { id: 'gold', label: 'Gold', swatch: '#d8b25c', hue: 40, delta: 150 },
      { id: 'stealth', label: 'Stealth', swatch: '#3a3a40', hue: 40, delta: 150 },
      { id: 'brushed-silver', label: 'Brushed Silver', swatch: '#b8bcc4', hue: 40, delta: 150 },
      { id: 'deep-rose', label: 'Deep Rose', swatch: '#c9897a', hue: 40, delta: 150 },
    ],
    options: [sizes(6, 13)],
    facts: { app: ['ios', 'android'] },
    inBox: ['Ring', 'Charger', 'USB-C cable', 'Sizing kit (ships first)'],
    specs: [
      { group: 'Ring', rows: [
        { label: 'Battery', value: '6 to 9 days', n: 9, better: 'high' },
        { label: 'Thickness', value: '2.28 mm', n: 2.28, better: 'low' },
        { label: 'Water resistance', value: '100 m', n: 100, better: 'high' },
        { label: 'Subscription', value: 'Membership, A$9.99 a month or A$109.99 a year, billed by Oura' },
        { label: 'App', value: 'iOS and Android' },
        { label: 'Sizes', value: 'US 6 to 13' },
      ] },
    ],
  },
  {
    id: 'rayban-meta-gen-3',
    name: 'Meta Gen 3',
    brand: 'Ray-Ban',
    category: 'Wearables',
    tagline: 'Glasses with a 12 MP camera, 3K video, open-ear audio and Meta AI, released 23 September 2026.',
    price: 679,
    priceCheckedAt: PRICE_CHECKED,
    sources: ['jbhifi.com.au', 'opsm.com.au', 'meta.com'],
    notes: 'Water rating for Gen 3 not published at listing time. Frame price differences are unverified, so every frame is shown at the Wayfarer price.',
    rating: null,
    stock: 'in',
    fulfil: WAREHOUSE,
    visual: 'glasses',
    hue: 200,
    badges: ['New'],
    trend: { label: 'Trending', delta: 180, series: [10, 12, 15, 14, 20, 28, 36, 44], source: SAMPLE },
    variants: [
      { id: 'shiny-black', label: 'Shiny Black', swatch: '#1b1b1f', hue: 200 },
      { id: 'matte-black', label: 'Matte Black', swatch: '#2b2b30', hue: 200 },
    ],
    options: [
      { id: 'frame', label: 'Frame', choices: [
        { id: 'wayfarer', label: 'Wayfarer', delta: 0 },
        { id: 'aviator', label: 'Aviator', delta: 0 },
        { id: 'zena', label: 'Zena', delta: 0 },
      ] },
      { id: 'lens', label: 'Lens', choices: [
        { id: 'standard', label: 'Standard', sub: 'Clear or tinted', delta: 0 },
        { id: 'transitions', label: 'Transitions', sub: 'Darkens outdoors', delta: 90 },
      ] },
    ],
    facts: { app: ['ios', 'android'] },
    inBox: ['Glasses', 'Charging case', 'USB-C cable', 'Cleaning cloth'],
    specs: [
      { group: 'Glasses', rows: [
        { label: 'Camera', value: '12 MP ultra-wide, 3K video' },
        { label: 'Audio', value: 'Open-ear speakers, 6 microphones' },
        { label: 'Storage', value: '32 GB', n: 32, better: 'high' },
        { label: 'Battery', value: 'Up to 9 h, 50 h with the case', n: 9, better: 'high' },
        { label: 'Weight', value: '51.5 g', n: 51.5, better: 'low' },
        { label: 'Wireless', value: 'Bluetooth 5.3, Wi-Fi 6' },
        { label: 'App', value: 'Meta AI app, iOS 17+, Android 10+' },
      ] },
    ],
  },

  /* ---------------- Audio ---------------- */
  {
    id: 'bose-ultra-open-2',
    name: 'Ultra Open Earbuds (2nd Gen)',
    brand: 'Bose',
    category: 'Audio',
    tagline: 'Clip-on open earbuds: 9 hours a charge, multipoint Bluetooth 5.4, IPX4, and your ears stay open to the street.',
    price: 449,
    compareAt: 449.95,
    priceCheckedAt: PRICE_CHECKED,
    sources: ['bose.com.au'],
    rating: null,
    stock: 'in',
    fulfil: WAREHOUSE,
    visual: 'earbuds',
    hue: 330,
    trend: { label: 'Trending', delta: 120, series: [11, 12, 14, 17, 21, 26, 32, 39], source: SAMPLE },
    variants: [
      { ...BLACK, hue: 330 },
      { id: 'white-smoke', label: 'White Smoke', swatch: '#e8e8ec', hue: 330 },
      { id: 'sky-pink', label: 'Sky Pink', swatch: '#e6b7c4', hue: 330 },
      { id: 'cherry-chocolate', label: 'Cherry Chocolate', swatch: '#4a2a2c', hue: 330 },
      { id: 'olive-green', label: 'Olive Green', swatch: '#6b7b4a', hue: 330 },
    ],
    facts: { app: ['ios', 'android'] },
    inBox: ['Earbuds', 'Charging case', 'USB-C cable'],
    specs: [
      { group: 'Earbuds', rows: [
        { label: 'Battery', value: '9 h, 28.5 h with the case', n: 9, better: 'high' },
        { label: 'Bluetooth', value: '5.4, multipoint' },
        { label: 'Water resistance', value: 'IPX4' },
        { label: 'Fit', value: 'Clip-on cuff, open ear' },
      ] },
    ],
  },

  /* ---------------- Work ---------------- */
  {
    id: 'plaud-notepin-s',
    name: 'NotePin S',
    brand: 'Plaud',
    category: 'Work',
    tagline: 'A 17 g wearable recorder that transcribes 20 hours of meetings in 112 languages and sits on Apple Find My.',
    price: 239,
    compareAt: 299,
    priceCheckedAt: PRICE_CHECKED,
    sources: ['au.plaud.ai'],
    rating: { value: 4.86, count: 7, at: 'au.plaud.ai' },
    stock: 'in',
    fulfil: SUPPLIER,
    visual: 'pin',
    hue: 78,
    badges: ['Viral'],
    trend: { label: 'Viral', delta: 260, series: [6, 8, 10, 16, 24, 30, 44, 58], source: SAMPLE },
    variants: [{ id: 'cosmic-gray', label: 'Cosmic Gray', swatch: '#5a5a62', hue: 78 }],
    options: [
      { id: 'plan', label: 'Plaud plan', choices: [
        { id: 'starter', label: 'Starter', sub: 'Free plan', delta: 0 },
        { id: 'pro', label: 'Pro', sub: 'A$39.99 a month, billed by Plaud', delta: 0 },
      ] },
    ],
    facts: { app: ['ios', 'android'] },
    inBox: ['NotePin S', 'Magnetic pin', 'Clip', 'USB-C charging dock'],
    specs: [
      { group: 'Recorder', rows: [
        { label: 'Recording', value: '20 h a charge, 64 GB', n: 20, better: 'high' },
        { label: 'Transcription', value: '112 languages, speaker labels, summaries in the Plaud app' },
        { label: 'Weight', value: '17.4 g', n: 17.4, better: 'low' },
        { label: 'Finder', value: 'Apple Find My (iPhone only for finding)' },
        { label: 'App', value: 'iOS and Android' },
      ] },
    ],
  },

  /* ---------------- Power ---------------- */
  {
    id: 'anker-maggo-10k',
    name: 'MagGo Power Bank 10K (Qi2)',
    brand: 'Anker',
    category: 'Power',
    tagline: 'A 10,000 mAh Qi2 magnetic bank with a kickstand and a display: 15 W wireless to the phone, 27 W over USB-C.',
    price: 119.96,
    compareAt: 149.95,
    priceCheckedAt: PRICE_CHECKED,
    sources: ['anker.com/au'],
    rating: { value: 4.7, count: 532, at: 'anker.com/au' },
    stock: 'in',
    fulfil: SUPPLIER,
    visual: 'powerbank',
    hue: 78,
    trend: { label: 'Rising', delta: 96, series: [10, 11, 13, 14, 16, 19, 22, 26], source: SAMPLE },
    variants: [
      { id: 'black-stone', label: 'Black Stone', swatch: '#2b2b30', hue: 78 },
      { id: 'shell-white', label: 'Shell White', swatch: '#e8e8ec', hue: 78 },
      { id: 'ice-lake-blue', label: 'Ice Lake Blue', swatch: '#9fc4e8', hue: 200 },
      { id: 'buds-green', label: 'Buds Green', swatch: '#b7d39a', hue: 100 },
    ],
    facts: { magnetic: true, pdOut: 27 },
    inBox: ['Power bank', 'USB-C to USB-C cable'],
    specs: [
      { group: 'Power', rows: [
        { label: 'Capacity', value: '10,000 mAh, 38.5 Wh', n: 10000, better: 'high' },
        { label: 'Wireless', value: 'Qi2, 15 W magnetic', n: 15, better: 'high' },
        { label: 'Wired', value: '27 W USB-C out, 20 W in', n: 27, better: 'high' },
        { label: 'Weight', value: '250 g', n: 250, better: 'low' },
        { label: 'Extras', value: 'Kickstand, status display' },
        { label: 'Model', value: 'A1654' },
      ] },
    ],
  },
  {
    id: 'anker-prime-100w',
    name: 'Prime Charger 100 W (GaN)',
    brand: 'Anker',
    category: 'Power',
    tagline: 'A 170 g 100 W GaN charger with two USB-C and one USB-A: 100 W to one device or 65 + 35 W to two.',
    price: 89.95,
    compareAt: 129.95,
    priceCheckedAt: PRICE_CHECKED,
    sources: ['anker.com/au'],
    notes: 'Plug style on the AU unit (fixed or folding pins) not confirmed.',
    rating: { value: 4.8, count: 329, at: 'anker.com/au' },
    stock: 'in',
    fulfil: WAREHOUSE,
    visual: 'charger',
    hue: 78,
    trend: { label: 'Steady', delta: 22, series: [22, 23, 22, 24, 25, 25, 26, 27], source: SAMPLE },
    variants: [{ ...BLACK, hue: 78 }],
    facts: { pdOut: 100, plug: 'AU', voltage: '100-240' },
    inBox: ['Charger'],
    specs: [
      { group: 'Charger', rows: [
        { label: 'Output', value: '100 W to one port; 65 + 35 W or 65 + 24 W shared', n: 100, better: 'high' },
        { label: 'Ports', value: '2 × USB-C, 1 × USB-A' },
        { label: 'Weight', value: '170 g', n: 170, better: 'low' },
        { label: 'Model', value: 'A2688' },
      ] },
    ],
  },

  /* ---------------- Smart home ---------------- */
  {
    id: 'aqara-camera-e1',
    name: 'Camera E1',
    brand: 'Aqara',
    category: 'Smart home',
    tagline: 'A 2K pan-and-tilt indoor camera that records to Apple Home, Google Home or Alexa, with a microSD slot and no cloud fee.',
    price: 89,
    compareAt: 119,
    priceCheckedAt: PRICE_CHECKED,
    sources: ['aqarastore.com.au'],
    rating: null,
    stock: 'in',
    fulfil: SUPPLIER,
    visual: 'cam',
    hue: 200,
    trend: { label: 'Rising', delta: 62, series: [15, 16, 17, 19, 20, 22, 24, 27], source: SAMPLE },
    variants: [{ ...WHITE, hue: 200 }],
    facts: { app: ['ios', 'android'], home: ['homekit', 'google', 'alexa'] },
    inBox: ['Camera E1', 'USB-C cable (no wall adapter)', 'Mounting kit', 'Quick-start guide'],
    specs: [
      { group: 'Camera', rows: [
        { label: 'Resolution', value: '2K (2304 × 1296)', n: 2304 * 1296, better: 'high' },
        { label: 'View', value: '360° pan, 101° field of view' },
        { label: 'Storage', value: 'microSD up to 512 GB; HomeKit Secure Video with an iCloud plan' },
        { label: 'Wireless', value: 'Wi-Fi 6, 2.4 GHz only' },
        { label: 'Power', value: '5 V 2 A USB-C, adapter not included' },
        { label: 'Platforms', value: 'Apple Home, Google Home, Alexa; no Matter' },
      ] },
    ],
  },
  {
    id: 'nanoleaf-matter-strip-5m',
    name: 'Essentials Matter Lightstrip, 5 m',
    brand: 'Nanoleaf',
    category: 'Smart home',
    tagline: 'A 5 m Thread light strip, 2,200 lumens peak, 2,700 to 6,500 K and full colour, that joins your home app through Matter.',
    price: 129,
    priceCheckedAt: PRICE_CHECKED,
    sources: ['nanoleaf.me/en-AU', 'jbhifi.com.au'],
    notes: 'Looks end-of-line: gone from Nanoleaf AU, still stocked by AU retailers. The Matter-over-Wi-Fi strip is the runner-up.',
    rating: null,
    stock: 'low',
    stockCount: 6,
    fulfil: SUPPLIER,
    visual: 'strip',
    hue: 300,
    badges: ['Limited stock'],
    trend: { label: 'Rising', delta: 74, series: [14, 15, 16, 18, 20, 22, 25, 28], source: SAMPLE },
    variants: [{ ...WHITE, hue: 300 }],
    facts: { app: ['ios', 'android'], home: ['matter', 'thread'], needsThread: true, plug: 'AU', voltage: '100-240' },
    inBox: ['5 m light strip', 'Controller', 'Power adapter', 'Mounting clips'],
    specs: [
      { group: 'Light strip', rows: [
        { label: 'Brightness', value: '2,000 lm (2,200 lm peak)', n: 2000, better: 'high' },
        { label: 'Colour', value: '2,700 to 6,500 K white, full RGB' },
        { label: 'Length', value: '5 m, cuttable', n: 5, better: 'high' },
        { label: 'Lifetime', value: '25,000 h' },
        { label: 'Connectivity', value: 'Matter over Thread, Bluetooth fallback; needs a Thread border router' },
      ] },
    ],
  },
  {
    id: 'aqara-hub-m3',
    name: 'Hub M3',
    brand: 'Aqara',
    category: 'Smart home',
    tagline: 'A Matter controller and Thread border router with Zigbee, Wi-Fi, PoE and an IR blaster, for Apple Home, Google Home and Alexa.',
    price: 297,
    compareAt: 299,
    priceCheckedAt: PRICE_CHECKED,
    sources: ['officeworks.com.au', 'aqara.com'],
    rating: null,
    stock: 'in',
    fulfil: WAREHOUSE,
    visual: 'hub',
    hue: 200,
    trend: { label: 'Rising', delta: 66, series: [16, 17, 18, 19, 21, 23, 26, 29], source: SAMPLE },
    variants: [{ ...BLACK, hue: 200 }],
    facts: { app: ['ios', 'android'], home: ['matter', 'homekit', 'google', 'alexa'], hubs: ['matter', 'thread', 'homekit', 'google', 'alexa'] },
    inBox: ['Hub M3', 'USB-C cable', 'Power adapter', 'Mounting plate'],
    specs: [
      { group: 'Hub', rows: [
        { label: 'Radios', value: 'Thread, Zigbee 3.0 (up to 127 devices), dual-band Wi-Fi, Bluetooth 5.1' },
        { label: 'Wired', value: 'Ethernet with PoE' },
        { label: 'Storage', value: '8 GB eMMC, local automations', n: 8, better: 'high' },
        { label: 'Extras', value: 'IR blaster, 95 dB siren' },
        { label: 'Platforms', value: 'Matter, Apple Home, Google Home, Alexa' },
      ] },
    ],
  },
  {
    id: 'eufy-x10-pro-omni',
    name: 'X10 Pro Omni',
    brand: 'eufy',
    category: 'Smart home',
    tagline: 'A robot vacuum and mop with 8,000 Pa suction, a self-emptying, mop-washing base and Google Home or Alexa control.',
    price: 1299,
    compareAt: 1699.95,
    priceCheckedAt: PRICE_CHECKED,
    sources: ['eufy.com/au'],
    rating: null,
    stock: 'in',
    fulfil: WAREHOUSE,
    visual: 'robovac',
    hue: 200,
    trend: { label: 'Rising', delta: 52, series: [18, 18, 19, 20, 22, 23, 25, 27], source: SAMPLE },
    variants: [{ ...BLACK, hue: 200 }, { ...WHITE, hue: 200 }],
    facts: { app: ['ios', 'android'], home: ['google', 'alexa'], plug: 'AU', voltage: '100-240' },
    inBox: ['X10 Pro Omni', 'Omni station', 'Dust bag', 'Cleaning solution'],
    specs: [
      { group: 'Robot', rows: [
        { label: 'Suction', value: '8,000 Pa', n: 8000, better: 'high' },
        { label: 'Runtime', value: 'Up to 173 min (136 min mopping)', n: 173, better: 'high' },
        { label: 'Base', value: 'Auto-empty 2.5 L bag, mop wash, 45 °C drying' },
        { label: 'Water tank', value: '3 L', n: 3, better: 'high' },
        { label: 'Platforms', value: 'Google Home, Alexa; no Apple Home or Matter' },
      ] },
    ],
  },

  /* ---------------- Mobility ---------------- */
  {
    id: 'segway-e3-pro',
    name: 'KickScooter E3 Pro',
    brand: 'Segway-Ninebot',
    category: 'Mobility',
    tagline: 'A 25 km/h commuter scooter with a 368 Wh battery, up to 55 km of range in Eco and 10-inch tubeless tyres.',
    price: 999,
    compareAt: 1199,
    priceCheckedAt: PRICE_CHECKED,
    sources: ['jbhifi.com.au', 'segway.com.au'],
    notes: 'E-scooter road rules differ by state and territory; check yours before riding on public roads.',
    rating: { value: 5.0, count: 28, at: 'jbhifi.com.au' },
    stock: 'in',
    fulfil: WAREHOUSE,
    visual: 'scooter',
    hue: 78,
    trend: { label: 'Rising', delta: 58, series: [16, 17, 18, 20, 21, 23, 25, 27], source: SAMPLE },
    variants: [{ id: 'dark-grey', label: 'Dark Grey', swatch: '#2b2b30', hue: 78 }],
    facts: { app: ['ios', 'android'], plug: 'AU', voltage: '100-240' },
    inBox: ['Scooter', 'Charger', 'Tool kit', 'Quick-start guide'],
    specs: [
      { group: 'Scooter', rows: [
        { label: 'Motor', value: '400 W nominal, 800 W peak', n: 800, better: 'high' },
        { label: 'Battery', value: '368 Wh, about 7 h to charge', n: 368, better: 'high' },
        { label: 'Range', value: 'Up to 55 km Eco, 40 km Sport', n: 55, better: 'high' },
        { label: 'Top speed', value: '25 km/h', n: 25, better: 'high' },
        { label: 'Weight', value: '17.9 kg', n: 17.9, better: 'low' },
        { label: 'Tyres', value: '10″ tubeless' },
        { label: 'Water resistance', value: 'IPX5' },
        { label: 'Max load', value: '100 kg', n: 100, better: 'high' },
      ] },
    ],
  },

  /* ---------------- Maker ---------------- */
  {
    id: 'bambu-a1-mini',
    name: 'A1 mini',
    brand: 'Bambu Lab',
    category: 'Maker',
    tagline: 'A 180 mm desk 3D printer that calibrates itself, prints at up to 500 mm/s and stays under 48 dB.',
    price: 319,
    priceCheckedAt: PRICE_CHECKED,
    sources: ['jbhifi.com.au', 'bambulab.com'],
    notes: 'Retailer shows a 5.0 rating with no visible review count, so no rating is shown here.',
    rating: null,
    stock: 'in',
    fulfil: WAREHOUSE,
    visual: 'printer',
    hue: 78,
    trend: { label: 'Rising', delta: 88, series: [12, 13, 14, 16, 18, 20, 23, 26], source: SAMPLE },
    variants: [{ ...WHITE, hue: 78 }],
    options: [
      { id: 'kit', label: 'Kit', choices: [
        { id: 'printer', label: 'A1 mini', sub: 'Printer only', delta: 0 },
        { id: 'combo', label: 'A1 mini Combo', sub: 'With AMS lite, 4-colour', delta: 210 },
      ] },
    ],
    facts: { app: ['ios', 'android'], plug: 'AU', voltage: '100-240' },
    inBox: ['A1 mini', 'Spool holder', 'Sample filament', 'Tool kit'],
    specs: [
      { group: 'Printer', rows: [
        { label: 'Build volume', value: '180 × 180 × 180 mm', n: 180, better: 'high' },
        { label: 'Speed', value: 'Up to 500 mm/s', n: 500, better: 'high' },
        { label: 'Noise', value: 'Under 48 dB', n: 48, better: 'low' },
        { label: 'Weight', value: '5.5 kg', n: 5.5, better: 'low' },
        { label: 'Software', value: 'Bambu Studio (Windows, macOS); Bambu Handy (iOS 13+, Android 6+)' },
      ] },
    ],
  },

  /* ---------------- Health ---------------- */
  {
    id: 'omnilux-contour-face',
    name: 'Contour Face',
    brand: 'Omnilux',
    category: 'Health',
    tagline: 'A flexible 132-LED red and near-infrared face mask: 10-minute sessions, a corded controller and no app.',
    price: 605,
    priceCheckedAt: PRICE_CHECKED,
    sources: ['omniluxled.com', 'AU stockists'],
    notes: 'ARTG listing number not confirmed.',
    rating: { value: 4.5, count: 2243, at: 'omniluxled.com' },
    stock: 'in',
    fulfil: SUPPLIER,
    visual: 'mask',
    hue: 0,
    badges: ['Viral'],
    trend: { label: 'Viral', delta: 310, series: [5, 6, 9, 14, 20, 30, 44, 60], source: SAMPLE },
    variants: [{ ...WHITE, hue: 0 }],
    facts: {},
    inBox: ['Mask', 'Controller', 'USB cable', 'Head straps', 'Carry bag'],
    specs: [
      { group: 'Mask', rows: [
        { label: 'LEDs', value: '132, red 633 nm and near-infrared 830 nm', n: 132, better: 'high' },
        { label: 'Session', value: '10 min', n: 10, better: 'low' },
        { label: 'Control', value: 'Corded controller, no app' },
        { label: 'Warranty', value: '2 years' },
        { label: 'Clearance', value: 'FDA-cleared; TGA-listed per AU stockists' },
      ] },
    ],
  },
  {
    id: 'withings-body-smart',
    name: 'Body Smart',
    brand: 'Withings',
    category: 'Health',
    tagline: 'A Wi-Fi scale that reads weight, body fat, muscle and heart rate for up to 8 people and syncs to Apple Health or Health Connect.',
    price: 199,
    priceCheckedAt: PRICE_CHECKED,
    sources: ['jbhifi.com.au', 'withings.com'],
    notes: 'Retailer shows a 4.4 rating with no visible review count, so no rating is shown here.',
    rating: null,
    stock: 'in',
    fulfil: SUPPLIER,
    visual: 'scale',
    hue: 200,
    trend: { label: 'Rising', delta: 54, series: [17, 18, 18, 20, 21, 23, 25, 27], source: SAMPLE },
    variants: [{ ...BLACK, hue: 200 }, { ...WHITE, hue: 200 }],
    facts: { app: ['ios', 'android'] },
    inBox: ['Scale', '4 × AAA batteries', 'Quick-start guide'],
    specs: [
      { group: 'Scale', rows: [
        { label: 'Metrics', value: '8, including body fat, muscle, visceral fat and heart rate', n: 8, better: 'high' },
        { label: 'Users', value: 'Up to 8', n: 8, better: 'high' },
        { label: 'Battery', value: '4 × AAA, about 15 months' },
        { label: 'Sync', value: 'Wi-Fi and Bluetooth; Apple Health, Health Connect' },
        { label: 'App', value: 'Withings, iOS 14+, Android 10+' },
      ] },
    ],
  },

  /* ---------------- Accessories ---------------- */
  {
    id: 'chipolo-pop',
    name: 'POP',
    brand: 'Chipolo',
    category: 'Accessories',
    tagline: 'A finder tag that joins Apple Find My or Google Find Hub, chosen at setup, with a 120 dB ring and a replaceable CR2032.',
    price: 50,
    priceCheckedAt: PRICE_CHECKED,
    sources: ['chipolo.net', 'theaureview.com'],
    notes: 'Sold as singles; the 4-pack AUD price is unverified.',
    rating: null,
    stock: 'in',
    fulfil: SUPPLIER,
    visual: 'tag',
    hue: 78,
    trend: { label: 'Trending', delta: 110, series: [12, 13, 15, 18, 21, 25, 30, 36], source: SAMPLE },
    variants: [
      { ...BLACK, hue: 78 },
      { ...WHITE, hue: 78 },
      { id: 'blue', label: 'Blue', swatch: '#3b7dd8', hue: 215 },
      { id: 'green', label: 'Green', swatch: '#58b36b', hue: 130 },
      { id: 'red', label: 'Red', swatch: '#d8403b', hue: 0 },
      { id: 'yellow', label: 'Yellow', swatch: '#f0c23b', hue: 45 },
    ],
    options: [
      { id: 'network', label: 'Finder network (set once at setup)', choices: [
        { id: 'find-my', label: 'Apple Find My', sub: 'iPhone', delta: 0, facts: { tracker: 'find-my' } },
        { id: 'find-hub', label: 'Google Find Hub', sub: 'Android', delta: 0, facts: { tracker: 'find-hub' } },
      ] },
    ],
    facts: {},
    inBox: ['POP tag', 'CR2032 battery (fitted)'],
    specs: [
      { group: 'Tag', rows: [
        { label: 'Range', value: 'Up to 90 m, Bluetooth 6.0', n: 90, better: 'high' },
        { label: 'Ring', value: '120 dB', n: 120, better: 'high' },
        { label: 'Battery', value: 'CR2032, about 12 months, replaceable' },
        { label: 'Water resistance', value: 'IP55' },
        { label: 'Size', value: '38.8 × 6.6 mm' },
        { label: 'Network', value: 'Apple Find My or Google Find Hub, chosen once' },
      ] },
    ],
  },
  {
    id: 'esr-halolock-ring',
    name: 'HaloLock Universal Ring 360 (2-pack)',
    brand: 'ESR',
    category: 'Accessories',
    tagline: 'A 1 mm steel ring that sticks to any phone or case so Qi2 and MagSafe accessories snap on. Two in the pack.',
    price: 26.38,
    priceCheckedAt: PRICE_CHECKED,
    sources: ['au.esrtech.com'],
    rating: null,
    stock: 'in',
    fulfil: SUPPLIER,
    visual: 'case',
    hue: 78,
    trend: { label: 'Steady', delta: 30, series: [20, 21, 21, 22, 23, 24, 25, 26], source: SAMPLE },
    variants: [{ ...BLACK, hue: 78 }, { ...WHITE, hue: 78 }, { id: 'blue', label: 'Blue', swatch: '#3b7dd8', hue: 215 }],
    facts: { givesMagnets: true },
    inBox: ['2 rings', 'Alignment guide', 'Cleaning wipe'],
    specs: [
      { group: 'Ring', rows: [
        { label: 'Ring', value: '57 mm, about 1 mm steel' },
        { label: 'Pack', value: '2 rings with an alignment guide' },
        { label: 'Works with', value: 'Qi2 and MagSafe accessories on any phone or case' },
      ] },
    ],
  },
  {
    id: 'sansai-au-travel-adapter',
    name: 'STV-017 inbound travel adapter',
    brand: 'Sansai',
    category: 'Accessories',
    tagline: 'Turns a UK, US or EU plug into an Australian one. 10 A, no USB ports, no voltage conversion.',
    price: 12.05,
    priceCheckedAt: PRICE_CHECKED,
    sources: ['jbhifi.com.au'],
    rating: null,
    stock: 'in',
    fulfil: WAREHOUSE,
    visual: 'adapter',
    hue: 78,
    trend: { label: 'Steady', delta: 5, series: [30, 30, 31, 30, 31, 31, 32, 31], source: SAMPLE },
    variants: [{ ...WHITE, hue: 78 }],
    facts: { adapterFor: 'AU' },
    specs: [
      { group: 'Adapter', rows: [
        { label: 'Output', value: 'Type I (AU/NZ), 10 A' },
        { label: 'Input', value: 'UK, US and EU plugs' },
        { label: 'Conversion', value: 'None: a 110 V device still needs a transformer' },
      ] },
    ],
  },
]

const RELEASED_AT: Record<string, string> = { 'rayban-meta-gen-3': '2026-09-23' }
export const products: Product[] = [
  ...catalogue.map((p) => ({ ...p, photos: PHOTOS[p.id], listedAt: PRICE_CHECKED, releasedAt: RELEASED_AT[p.id], market: 'AU' as const })),
  ...EXPANSION.map((p) => ({ ...p, photos: PHOTOS[p.id] })),
]

export const byId = (id: string) => {
  const p = products.find((x) => x.id === id)
  if (!p) throw new Error(`Unknown product ${id}`)
  return p
}

/** Default "My setup": what a new shopper is assumed to own until they edit it. Checked live on every PDP and in the cart. */
export const DEFAULT_GEAR: GearItem[] = [
  { id: 'g-iphone', kind: 'phone', name: 'iPhone 16 Pro', detail: 'iOS, MagSafe (Qi2), Find My', defaultOn: true,
    facts: { phone: { os: 'ios', magnets: true, trackerNet: 'find-my' } } },
  { id: 'g-pixel', kind: 'phone', name: 'Pixel 9', detail: 'Android, Qi (no magnets), Find Hub', defaultOn: false,
    facts: { phone: { os: 'android', magnets: false, trackerNet: 'find-hub' } } },
  { id: 'g-apple-home', kind: 'hub', name: 'Apple Home (Apple TV 4K)', detail: 'Apple Home, Matter, Thread border router', defaultOn: true,
    facts: { hubs: ['homekit', 'matter', 'thread'] } },
  { id: 'g-google-home', kind: 'hub', name: 'Google Home (Nest Mini)', detail: 'Google Home, Matter, no Thread', defaultOn: false,
    facts: { hubs: ['google', 'matter'] } },
  { id: 'g-switch', kind: 'source', name: 'Nintendo Switch', detail: 'HDMI source', defaultOn: true,
    facts: { requires: [{ anyOf: ['hdmi'], label: 'an HDMI input' }] } },
  { id: 'g-region', kind: 'region', name: 'Australia, 230 V, Type I', detail: 'Plug and voltage check', defaultOn: true,
    facts: { region: 'AU' } },
  { id: 'g-charger', kind: 'charger', name: 'Anker 65 W charger', detail: 'USB-C PD charger you already own', defaultOn: true,
    facts: { pdOut: 65 } },
]

export interface NavColumn { title: string; items: string[] }
export interface NavSection { id: string; label: string; columns: NavColumn[]; featured: string }

export const nav: NavSection[] = [
  { id: 'trending', label: 'Trending', featured: 'ringconn-gen-3', columns: [
    { title: 'This week', items: ['Viral right now', 'Rising fast', 'New arrivals'] },
    { title: 'Collections', items: ['Under $100', 'Under $300', 'Gifts that ship in 48 h', 'Travel tech'] },
    { title: 'Guides', items: ['How we pick', 'Does it work with my phone?', 'Movie night, checked as a set'] },
  ] },
  { id: 'wearables', label: 'Wearables', featured: 'rayban-meta-gen-3', columns: [
    { title: 'Body', items: ['Smart rings', 'Smart glasses', 'Fitness bands', 'Smartwatches', 'Sleep tech'] },
    { title: 'Audio on you', items: ['Open-ear buds', 'Speakers'] },
    { title: 'Guides', items: ['Ring sizing', 'Works with iPhone', 'Works with Android'] },
  ] },
  { id: 'smart-home', label: 'Smart home', featured: 'aqara-camera-e1', columns: [
    { title: 'Devices', items: ['Cameras', 'Lighting', 'Robot vacuums', 'Locks', 'Hubs'] },
    { title: 'Platforms', items: ['Apple Home', 'Google Home', 'Alexa', 'Matter and Thread'] },
    { title: 'Guides', items: ['Do I need a hub?', 'Does it work with my phone?'] },
  ] },
  { id: 'cinema', label: 'Cinema', featured: 'xgimi-mogo-4-laser', columns: [
    { title: 'Picture', items: ['Laser projectors', 'Battery projectors', 'Outdoor screens'] },
    { title: 'Sound', items: ['Speakers', 'Open-ear buds'] },
    { title: 'Guides', items: ['Movie night, checked as a set', 'Throw distance calculator', 'Compare projectors'] },
  ] },
  { id: 'power', label: 'Power', featured: 'anker-maggo-10k', columns: [
    { title: 'Power', items: ['Power banks', 'Chargers', 'Magnetic charging', 'Travel adapters'] },
    { title: 'Mobility', items: ['E-scooters'] },
    { title: 'Guides', items: ['Qi2 vs MagSafe'] },
  ] },
  { id: 'health', label: 'Health', featured: 'omnilux-contour-face', columns: [
    { title: 'Skin and light', items: ['LED masks'] },
    { title: 'Body', items: ['Smart scales', 'Recovery', 'Health watches'] },
    { title: 'Guides', items: ['Red vs near-infrared'] },
  ] },
  { id: 'maker', label: 'Maker', featured: 'bambu-a1-mini', columns: [
    { title: 'Make', items: ['Desk 3D printers', 'Dev boards'] },
    { title: 'Work', items: ['AI recorders', 'Cameras and gimbals', 'Keyboards'] },
    { title: 'Guides', items: ['How we pick'] },
  ] },
]

export const trendingSearches = ['smart ring', 'MoGo 4 Laser', 'open-ear buds', 'LED mask', 'Matter hub', 'AI recorder']

/** Trend tape shown in the hero: category momentum over 7 days. Sample data until the trend worker runs. */
export const trendTape: { label: string; delta: number }[] = [
  { label: 'LED masks', delta: 310 },
  { label: 'AI recorders', delta: 260 },
  { label: 'Smart rings', delta: 212 },
  { label: 'Smart glasses', delta: 180 },
  { label: 'Laser projectors', delta: 140 },
  { label: 'Open-ear buds', delta: 120 },
  { label: 'Finder tags', delta: 110 },
  { label: 'Magnetic power banks', delta: 96 },
  { label: 'Desk 3D printers', delta: 88 },
  { label: 'Thread lighting', delta: 74 },
]

/** @deprecated use DEFAULT_GEAR, or the store's editable `gear`. */
export const gear = DEFAULT_GEAR
