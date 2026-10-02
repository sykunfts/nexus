/*
  Catalogue model + sample data for a trend-tech dropshipping marketplace.
  In production: products come from Medusa, trend signals from the trend-ingestion service,
  fulfilment routes from the supplier connectors.
*/

export type Visual =
  | 'projector' | 'ring' | 'powerbank' | 'glasses' | 'cam' | 'strip' | 'scooter' | 'earbuds'
  | 'pin' | 'printer' | 'robovac' | 'mask' | 'screen' | 'tag' | 'hub' | 'charger' | 'case' | 'adapter'

export type OS = 'ios' | 'android'
export type HomeProto = 'matter' | 'thread' | 'homekit' | 'google' | 'alexa'
export type Region = 'AU' | 'US' | 'EU' | 'UK'
export type PortKind = 'hdmi' | 'usb-c' | 'usb-a' | 'jack'
export type TrackerNet = 'find-my' | 'find-hub'

export const PORT_LABEL: Record<PortKind, string> = { hdmi: 'HDMI', 'usb-c': 'USB-C', 'usb-a': 'USB-A', jack: '3.5 mm audio' }
export const PROTO_LABEL: Record<HomeProto, string> = { matter: 'Matter', thread: 'Thread', homekit: 'Apple Home', google: 'Google Home', alexa: 'Alexa' }
export const REGION_LABEL: Record<Region, string> = { AU: 'Australia (Type I, 240 V)', US: 'United States (Type A/B, 120 V)', EU: 'Europe (Type C/F, 230 V)', UK: 'United Kingdom (Type G, 230 V)' }

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
  givesMagnets?: boolean     // a case that adds a magnet ring to a phone
  adapterFor?: Region        // a plug adapter that outputs this region's socket
}

export interface Variant { id: string; label: string; swatch: string; hue: number }
export interface Choice { id: string; label: string; sub?: string; delta: number; facts?: Partial<CompatFacts> }
export interface OptionGroup { id: string; label: string; choices: Choice[] }
export interface SpecRow { label: string; value: string; n?: number; better?: 'high' | 'low' }
export interface SpecGroup { group: string; rows: SpecRow[] }
export interface Trend { label: 'Viral' | 'Trending' | 'Rising' | 'Steady'; delta: number; series: number[]; source: string }
export interface Fulfil { route: 'warehouse' | 'supplier'; from: string; eta: string; days: [number, number] }

export interface Product {
  id: string
  name: string
  brand: string
  category: string
  tagline: string
  price: number
  compareAt?: number
  rating: number
  reviews: number
  stock: 'in' | 'low' | 'out'
  stockCount?: number
  fulfil: Fulfil
  visual: Visual
  hue: number
  variants: Variant[]
  options?: OptionGroup[]
  badges?: string[]
  trend: Trend
  specs: SpecGroup[]
  facts: CompatFacts
  inBox?: string[]
}

export interface GearItem {
  id: string
  name: string
  detail: string
  facts: CompatFacts
  defaultOn: boolean
}

const WAREHOUSE: Fulfil = { route: 'warehouse', from: 'Sydney warehouse', eta: '2–4 days', days: [2, 4] }
const SUPPLIER: Fulfil = { route: 'supplier', from: 'partner supplier', eta: '8–12 days', days: [8, 12] }
const SUPPLIER_SLOW: Fulfil = { route: 'supplier', from: 'partner supplier', eta: '10–15 days', days: [10, 15] }

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

export const products: Product[] = [
  {
    id: 'beam-4k',
    name: 'Beam 4K',
    brand: 'Halo',
    category: 'Home cinema',
    tagline: 'A portable triple-laser 4K projector that throws a 100-inch picture from 2.6 m and runs 2.5 hours on battery.',
    price: 699,
    compareAt: 849,
    rating: 4.8,
    reviews: 2184,
    stock: 'in',
    fulfil: WAREHOUSE,
    visual: 'projector',
    hue: 24,
    badges: ['Trending'],
    trend: { label: 'Trending', delta: 140, series: [12, 14, 13, 18, 24, 31, 40, 52], source: 'Search + social, 7 days' },
    variants: [
      { id: 'graphite', label: 'Graphite', swatch: '#2b2b30', hue: 24 },
      { id: 'lunar', label: 'Lunar', swatch: '#c9ccd3', hue: 200 },
    ],
    options: [
      {
        id: 'edition',
        label: 'Edition',
        choices: [
          { id: 'std', label: 'Beam 4K', sub: '1,200 ISO lumens, 65 W', delta: 0, facts: { pdInMin: 65 } },
          { id: 'pro', label: 'Beam 4K Pro', sub: '2,000 ISO lumens, Dolby Vision, 100 W', delta: 200, facts: { pdInMin: 100 } },
        ],
      },
      PLUG_OPTIONS,
      {
        id: 'bundle',
        label: 'Bundle',
        choices: [
          { id: 'none', label: 'Projector only', delta: 0 },
          { id: 'screen', label: '+ Halo Screen 100″', sub: 'ALR screen, save $50', delta: 199 },
          { id: 'travel', label: '+ Travel case & Cube 100 W', sub: 'save $30', delta: 89 },
        ],
      },
    ],
    facts: {
      app: ['ios', 'android'],
      provides: [{ kind: 'hdmi', count: 1 }, { kind: 'usb-c', count: 1 }, { kind: 'jack', count: 1 }],
      pdInMin: 65,
      plug: 'AU',
      voltage: '100-240',
    },
    inBox: ['Beam 4K', '65 W USB-C power adapter (plug type as selected)', 'Remote with voice', 'Lens cloth'],
    specs: [
      { group: 'Picture', rows: [
        { label: 'Light source', value: 'Triple-laser DLP, 25,000 h' },
        { label: 'Resolution', value: '4K UHD (3840 × 2160)', n: 3840 * 2160, better: 'high' },
        { label: 'Brightness', value: '1,200 ISO lumens (Pro: 2,000)', n: 1200, better: 'high' },
        { label: 'Throw', value: '1.2:1, 100″ at 2.6 m', n: 1.2, better: 'low' },
        { label: 'Focus', value: 'ToF autofocus, auto keystone, obstacle avoidance' },
      ] },
      { group: 'Sound & smart', rows: [
        { label: 'Speakers', value: '2 × 8 W, Dolby Audio', n: 16, better: 'high' },
        { label: 'Streaming', value: 'Netflix, AirPlay, Google Cast, Halo OS' },
        { label: 'Wireless', value: 'Wi-Fi 6, Bluetooth 5.3' },
        { label: 'Inputs', value: 'HDMI 2.1 (eARC), USB-C, 3.5 mm' },
      ] },
      { group: 'Power & body', rows: [
        { label: 'Battery', value: '65 Wh, 2.5 h', n: 2.5, better: 'high' },
        { label: 'Charging', value: '65 W USB-C PD (Pro: 100 W)', n: 65, better: 'high' },
        { label: 'Weight', value: '1.1 kg', n: 1.1, better: 'low' },
        { label: 'Noise', value: '26 dB', n: 26, better: 'low' },
      ] },
    ],
  },
  {
    id: 'beam-mini',
    name: 'Beam Mini',
    brand: 'Halo',
    category: 'Home cinema',
    tagline: '1080p LED pocket projector for the bedroom wall. Runs 4 hours, weighs 480 g.',
    price: 249,
    rating: 4.5,
    reviews: 3310,
    stock: 'in',
    fulfil: SUPPLIER,
    visual: 'projector',
    hue: 200,
    trend: { label: 'Steady', delta: 12, series: [20, 21, 19, 22, 23, 22, 24, 23], source: 'Search + social, 7 days' },
    variants: [{ id: 'lunar', label: 'Lunar', swatch: '#c9ccd3', hue: 200 }],
    options: [PLUG_OPTIONS],
    facts: { app: ['ios', 'android'], provides: [{ kind: 'hdmi', count: 1 }, { kind: 'usb-c', count: 1 }], pdInMin: 30, plug: 'AU', voltage: '100-240' },
    specs: [
      { group: 'Picture', rows: [
        { label: 'Light source', value: 'LED, 30,000 h' },
        { label: 'Resolution', value: '1080p (1920 × 1080)', n: 1920 * 1080, better: 'high' },
        { label: 'Brightness', value: '400 ISO lumens', n: 400, better: 'high' },
        { label: 'Throw', value: '1.2:1, 80″ at 2.1 m', n: 1.2, better: 'low' },
        { label: 'Focus', value: 'Autofocus, auto keystone' },
      ] },
      { group: 'Sound & smart', rows: [
        { label: 'Speakers', value: '1 × 5 W', n: 5, better: 'high' },
        { label: 'Streaming', value: 'AirPlay, Google Cast' },
        { label: 'Wireless', value: 'Wi-Fi 5, Bluetooth 5.0' },
        { label: 'Inputs', value: 'HDMI 2.0, USB-C' },
      ] },
      { group: 'Power & body', rows: [
        { label: 'Battery', value: '30 Wh, 4 h', n: 4, better: 'high' },
        { label: 'Charging', value: '30 W USB-C PD', n: 30, better: 'high' },
        { label: 'Weight', value: '0.48 kg', n: 0.48, better: 'low' },
        { label: 'Noise', value: '30 dB', n: 30, better: 'low' },
      ] },
    ],
  },
  {
    id: 'loop-ring',
    name: 'Ring 2',
    brand: 'Loop',
    category: 'Wearables',
    tagline: 'Titanium smart ring: sleep staging, HRV, skin temperature and a 7-day battery. No subscription.',
    price: 299,
    rating: 4.7,
    reviews: 5120,
    stock: 'in',
    fulfil: WAREHOUSE,
    visual: 'ring',
    hue: 40,
    badges: ['Viral'],
    trend: { label: 'Viral', delta: 212, series: [8, 9, 12, 15, 22, 30, 38, 61], source: 'TikTok + search, 7 days' },
    variants: [
      { id: 'titanium', label: 'Titanium', swatch: '#c9ccd3', hue: 40 },
      { id: 'black', label: 'Black', swatch: '#1b1b1f', hue: 40 },
      { id: 'gold', label: 'Gold', swatch: '#d8b25c', hue: 40 },
    ],
    options: [{ id: 'size', label: 'Size (free sizing kit ships first)', choices: [7, 8, 9, 10, 11, 12, 13].map((n) => ({ id: String(n), label: `US ${n}`, delta: 0 })) }],
    facts: { app: ['ios', 'android'] },
    specs: [{ group: 'Sensors', rows: [
      { label: 'Sensors', value: 'PPG, skin temp, 3-axis accelerometer' },
      { label: 'Battery', value: '7 days', n: 7, better: 'high' },
      { label: 'Water resistance', value: '100 m', n: 100, better: 'high' },
    ] }],
  },
  {
    id: 'aether-magpack',
    name: 'MagPack Solar 10K',
    brand: 'Aether',
    category: 'Power',
    tagline: 'Magnetic 10,000 mAh Qi2 power bank with a fold-out solar panel for the days you forget to charge it.',
    price: 89,
    rating: 4.6,
    reviews: 2744,
    stock: 'in',
    fulfil: SUPPLIER,
    visual: 'powerbank',
    hue: 78,
    trend: { label: 'Rising', delta: 96, series: [10, 11, 13, 14, 16, 19, 22, 26], source: 'Search + social, 7 days' },
    variants: [
      { id: 'graphite', label: 'Graphite', swatch: '#2b2b30', hue: 78 },
      { id: 'lunar', label: 'Lunar', swatch: '#c9ccd3', hue: 200 },
    ],
    facts: { magnetic: true, pdOut: 20 },
    specs: [{ group: 'Power', rows: [
      { label: 'Capacity', value: '10,000 mAh', n: 10000, better: 'high' },
      { label: 'Wireless', value: 'Qi2, 15 W magnetic', n: 15, better: 'high' },
      { label: 'Solar', value: '5 W fold-out panel, 2 h sun = 15 % charge' },
    ] }],
  },
  {
    id: 'specs-air',
    name: 'Specs Air',
    brand: 'Specs',
    category: 'Wearables',
    tagline: 'Smart glasses with a 12 MP camera, open-ear audio and an on-device assistant. Prescription lenses available.',
    price: 349,
    rating: 4.4,
    reviews: 1180,
    stock: 'low',
    stockCount: 6,
    fulfil: SUPPLIER,
    visual: 'glasses',
    hue: 220,
    badges: ['Rising'],
    trend: { label: 'Rising', delta: 180, series: [6, 7, 7, 9, 12, 15, 18, 22], source: 'Search + social, 7 days' },
    variants: [
      { id: 'black', label: 'Black', swatch: '#1b1b1f', hue: 220 },
      { id: 'tortoise', label: 'Tortoise', swatch: '#6b4a2a', hue: 30 },
    ],
    facts: { app: ['ios', 'android'] },
    specs: [{ group: 'Glasses', rows: [
      { label: 'Camera', value: '12 MP, 1080p 60 video' },
      { label: 'Battery', value: '6 h, 36 h with case', n: 6, better: 'high' },
      { label: 'Weight', value: '49 g', n: 49, better: 'low' },
    ] }],
  },
  {
    id: 'nimbus-orbit',
    name: 'Orbit 2K',
    brand: 'Nimbus',
    category: 'Smart home',
    tagline: 'Pan-tilt indoor camera with on-device person detection, Matter and local storage. No cloud fee.',
    price: 129,
    rating: 4.6,
    reviews: 2032,
    stock: 'in',
    fulfil: WAREHOUSE,
    visual: 'cam',
    hue: 200,
    trend: { label: 'Steady', delta: 18, series: [18, 19, 18, 20, 21, 21, 22, 22], source: 'Search + social, 7 days' },
    variants: [{ id: 'white', label: 'White', swatch: '#e8e8ec', hue: 200 }],
    facts: { app: ['ios', 'android'], home: ['matter', 'homekit', 'google', 'alexa'], plug: 'AU', voltage: '100-240' },
    options: [PLUG_OPTIONS],
    specs: [{ group: 'Camera', rows: [
      { label: 'Resolution', value: '2K, 360° pan, 90° tilt' },
      { label: 'Smart home', value: 'Matter, Apple Home, Google Home, Alexa' },
      { label: 'Storage', value: 'microSD up to 512 GB', n: 512, better: 'high' },
    ] }],
  },
  {
    id: 'nimbus-glow',
    name: 'Glow Strip 5 m',
    brand: 'Nimbus',
    category: 'Smart home',
    tagline: 'Addressable RGBIC light strip over Matter and Thread. Music sync, 16 million colours, no hub bundled.',
    price: 59,
    rating: 4.5,
    reviews: 4410,
    stock: 'in',
    fulfil: SUPPLIER,
    visual: 'strip',
    hue: 290,
    trend: { label: 'Rising', delta: 74, series: [14, 15, 15, 17, 19, 21, 23, 25], source: 'Search + social, 7 days' },
    variants: [{ id: 'white', label: 'White', swatch: '#e8e8ec', hue: 290 }],
    facts: { app: ['ios', 'android'], home: ['matter', 'thread'], needsThread: true, plug: 'AU', voltage: '100-240' },
    options: [PLUG_OPTIONS],
    specs: [{ group: 'Light', rows: [
      { label: 'Length', value: '5 m, cuttable', n: 5, better: 'high' },
      { label: 'Protocol', value: 'Matter over Thread' },
      { label: 'Brightness', value: '1,800 lm', n: 1800, better: 'high' },
    ] }],
  },
  {
    id: 'drift-one',
    name: 'Drift One',
    brand: 'Drift',
    category: 'Mobility',
    tagline: 'Folding e-scooter with a 45 km range, 10-inch tubeless tyres and an app lock. Stocked locally.',
    price: 649,
    compareAt: 799,
    rating: 4.5,
    reviews: 866,
    stock: 'low',
    stockCount: 3,
    fulfil: WAREHOUSE,
    visual: 'scooter',
    hue: 150,
    badges: ['AU stock'],
    trend: { label: 'Rising', delta: 64, series: [12, 13, 12, 14, 16, 17, 19, 20], source: 'Search + social, 7 days' },
    variants: [{ id: 'graphite', label: 'Graphite', swatch: '#2b2b30', hue: 150 }],
    facts: { app: ['ios', 'android'], plug: 'AU', voltage: '100-240' },
    specs: [{ group: 'Ride', rows: [
      { label: 'Range', value: '45 km', n: 45, better: 'high' },
      { label: 'Motor', value: '500 W, 25 km/h', n: 500, better: 'high' },
      { label: 'Weight', value: '17 kg', n: 17, better: 'low' },
    ] }],
  },
  {
    id: 'pulse-open',
    name: 'Open Buds',
    brand: 'Pulse',
    category: 'Audio',
    tagline: 'Clip-on open-ear earbuds you can wear all day. 8 hours, IPX5, multipoint.',
    price: 129,
    rating: 4.6,
    reviews: 6210,
    stock: 'in',
    fulfil: SUPPLIER,
    visual: 'earbuds',
    hue: 20,
    badges: ['Best seller'],
    trend: { label: 'Trending', delta: 120, series: [15, 16, 18, 21, 24, 28, 31, 33], source: 'TikTok + search, 7 days' },
    variants: [
      { id: 'graphite', label: 'Graphite', swatch: '#2b2b30', hue: 20 },
      { id: 'sand', label: 'Sand', swatch: '#d8c9a6', hue: 40 },
    ],
    facts: { app: ['ios', 'android'] },
    specs: [{ group: 'Audio', rows: [
      { label: 'Drivers', value: '12 mm, open-ear' },
      { label: 'Battery', value: '8 h, 32 h with case', n: 8, better: 'high' },
      { label: 'Water resistance', value: 'IPX5' },
    ] }],
  },
  {
    id: 'echo-pin',
    name: 'Echo Pin',
    brand: 'Echo',
    category: 'Work & creator',
    tagline: 'Magnetic AI voice recorder: 30 hours of audio, transcripts and summaries on your phone. iPhone app only, for now.',
    price: 149,
    rating: 4.3,
    reviews: 980,
    stock: 'in',
    fulfil: SUPPLIER,
    visual: 'pin',
    hue: 320,
    badges: ['Viral'],
    trend: { label: 'Viral', delta: 260, series: [5, 6, 8, 10, 14, 19, 27, 36], source: 'TikTok + search, 7 days' },
    variants: [{ id: 'graphite', label: 'Graphite', swatch: '#2b2b30', hue: 320 }],
    facts: { app: ['ios'], magnetic: true },
    specs: [{ group: 'Recorder', rows: [
      { label: 'Recording', value: '30 h continuous', n: 30, better: 'high' },
      { label: 'Transcription', value: 'On-phone, 40 languages' },
      { label: 'Weight', value: '14 g', n: 14, better: 'low' },
    ] }],
  },
  {
    id: 'flux-mini',
    name: 'Flux Mini',
    brand: 'Flux',
    category: 'Maker',
    tagline: 'A desk-sized 3D printer that prints a phone stand in 40 minutes. Auto-levelling, app slicing, 160 mm bed.',
    price: 399,
    rating: 4.4,
    reviews: 712,
    stock: 'in',
    fulfil: SUPPLIER_SLOW,
    visual: 'printer',
    hue: 120,
    trend: { label: 'Rising', delta: 88, series: [9, 10, 10, 12, 13, 15, 17, 19], source: 'Search + social, 7 days' },
    variants: [{ id: 'graphite', label: 'Graphite', swatch: '#2b2b30', hue: 120 }],
    facts: { app: ['ios', 'android'], plug: 'US', voltage: '100-240' },
    options: [{ ...PLUG_OPTIONS, choices: [PLUG_OPTIONS.choices[1], PLUG_OPTIONS.choices[2]] }],
    specs: [{ group: 'Printer', rows: [
      { label: 'Build volume', value: '160 × 160 × 160 mm', n: 160, better: 'high' },
      { label: 'Speed', value: 'Up to 300 mm/s', n: 300, better: 'high' },
      { label: 'Noise', value: '38 dB', n: 38, better: 'low' },
    ] }],
  },
  {
    id: 'nimbus-robo',
    name: 'Robo Mop',
    brand: 'Nimbus',
    category: 'Smart home',
    tagline: 'Robot vacuum and mop with a self-emptying dock and LiDAR mapping. Google Home and Alexa.',
    price: 499,
    compareAt: 599,
    rating: 4.5,
    reviews: 1540,
    stock: 'in',
    fulfil: WAREHOUSE,
    visual: 'robovac',
    hue: 200,
    badges: ['−17%'],
    trend: { label: 'Steady', delta: 22, series: [16, 17, 17, 18, 19, 19, 20, 20], source: 'Search + social, 7 days' },
    variants: [{ id: 'graphite', label: 'Graphite', swatch: '#2b2b30', hue: 200 }],
    facts: { app: ['ios', 'android'], home: ['google', 'alexa'], plug: 'AU', voltage: '100-240' },
    options: [PLUG_OPTIONS],
    specs: [{ group: 'Cleaning', rows: [
      { label: 'Suction', value: '8,000 Pa', n: 8000, better: 'high' },
      { label: 'Runtime', value: '180 min', n: 180, better: 'high' },
      { label: 'Dock', value: 'Self-empty, 60-day bag' },
    ] }],
  },
  {
    id: 'luma-mask',
    name: 'Luma Mask',
    brand: 'Luma',
    category: 'Health & beauty',
    tagline: 'Flexible LED light-therapy mask with red and near-infrared modes. 10 minutes a day, app-timed.',
    price: 179,
    rating: 4.6,
    reviews: 8930,
    stock: 'in',
    fulfil: SUPPLIER,
    visual: 'mask',
    hue: 350,
    badges: ['Viral'],
    trend: { label: 'Viral', delta: 310, series: [4, 5, 6, 9, 13, 20, 29, 41], source: 'TikTok + search, 7 days' },
    variants: [{ id: 'lunar', label: 'Lunar', swatch: '#c9ccd3', hue: 350 }],
    facts: { app: ['ios', 'android'] },
    specs: [{ group: 'Therapy', rows: [
      { label: 'LEDs', value: '240, 630 nm red, 830 nm NIR', n: 240, better: 'high' },
      { label: 'Session', value: '10 min, auto-off' },
      { label: 'Battery', value: '12 sessions', n: 12, better: 'high' },
    ] }],
  },
  {
    id: 'halo-screen',
    name: 'Screen 100″ ALR',
    brand: 'Halo',
    category: 'Home cinema',
    tagline: 'Ambient-light-rejecting screen that keeps blacks black with the lights on. Folds into a 60 cm tube.',
    price: 249,
    rating: 4.7,
    reviews: 1105,
    stock: 'in',
    fulfil: WAREHOUSE,
    visual: 'screen',
    hue: 78,
    trend: { label: 'Steady', delta: 30, series: [10, 10, 11, 12, 12, 13, 14, 15], source: 'Search + social, 7 days' },
    variants: [{ id: 'black', label: 'Black frame', swatch: '#1b1b1f', hue: 78 }],
    facts: {},
    specs: [{ group: 'Screen', rows: [
      { label: 'Size', value: '100″, 16:9', n: 100, better: 'high' },
      { label: 'Gain', value: '0.6 ALR', n: 0.6, better: 'high' },
      { label: 'Packed', value: '60 cm tube, 2.4 kg', n: 2.4, better: 'low' },
    ] }],
  },
  {
    id: 'aether-cube-100',
    name: 'Cube 100 W',
    brand: 'Aether',
    category: 'Power',
    tagline: 'Pocket GaN charger: 100 W on one port, 65 + 30 on two. Swappable plug heads.',
    price: 59,
    rating: 4.8,
    reviews: 7210,
    stock: 'in',
    fulfil: WAREHOUSE,
    visual: 'charger',
    hue: 78,
    trend: { label: 'Steady', delta: 8, series: [22, 22, 23, 22, 23, 24, 23, 24], source: 'Search + social, 7 days' },
    variants: [
      { id: 'graphite', label: 'Graphite', swatch: '#2b2b30', hue: 78 },
      { id: 'lunar', label: 'Lunar', swatch: '#c9ccd3', hue: 200 },
    ],
    options: [PLUG_OPTIONS],
    facts: { pdOut: 100, plug: 'AU', voltage: '100-240' },
    specs: [{ group: 'Output', rows: [
      { label: 'Max output', value: '100 W USB-C PD 3.1', n: 100, better: 'high' },
      { label: 'Ports', value: '2 × USB-C, 1 × USB-A' },
    ] }],
  },
  {
    id: 'snap-tag',
    name: 'Snap Tag 4-pack',
    brand: 'Snap',
    category: 'Everyday carry',
    tagline: 'Coin-sized trackers for keys, bags and luggage. Choose the network your phone uses.',
    price: 39,
    rating: 4.5,
    reviews: 11200,
    stock: 'in',
    fulfil: SUPPLIER,
    visual: 'tag',
    hue: 200,
    trend: { label: 'Trending', delta: 110, series: [20, 22, 24, 27, 31, 36, 40, 44], source: 'Search + social, 7 days' },
    variants: [
      { id: 'graphite', label: 'Graphite', swatch: '#2b2b30', hue: 200 },
      { id: 'lunar', label: 'Lunar', swatch: '#c9ccd3', hue: 200 },
    ],
    options: [{
      id: 'network',
      label: 'Finder network',
      choices: [
        { id: 'find-my', label: 'Apple Find My', sub: 'iPhone', delta: 0, facts: { tracker: 'find-my', app: ['ios'] } },
        { id: 'find-hub', label: 'Google Find Hub', sub: 'Android', delta: 0, facts: { tracker: 'find-hub', app: ['android'] } },
      ],
    }],
    facts: { tracker: 'find-my', app: ['ios'] },
    specs: [{ group: 'Tracker', rows: [
      { label: 'Battery', value: 'CR2032, 1 year', n: 12, better: 'high' },
      { label: 'Range', value: 'Bluetooth 5.3, 120 m', n: 120, better: 'high' },
    ] }],
  },
  {
    id: 'nimbus-hub',
    name: 'Hub',
    brand: 'Nimbus',
    category: 'Smart home',
    tagline: 'Matter controller and Thread border router that bridges to Apple Home, Google Home and Alexa.',
    price: 69,
    rating: 4.4,
    reviews: 1320,
    stock: 'in',
    fulfil: WAREHOUSE,
    visual: 'hub',
    hue: 200,
    trend: { label: 'Steady', delta: 15, series: [9, 9, 10, 10, 11, 11, 12, 12], source: 'Search + social, 7 days' },
    variants: [{ id: 'white', label: 'White', swatch: '#e8e8ec', hue: 200 }],
    facts: { app: ['ios', 'android'], hubs: ['matter', 'thread', 'homekit', 'google', 'alexa'], plug: 'AU', voltage: '100-240' },
    options: [PLUG_OPTIONS],
    specs: [{ group: 'Hub', rows: [
      { label: 'Radios', value: 'Thread, Zigbee, Bluetooth, Wi-Fi 6' },
      { label: 'Bridges to', value: 'Apple Home, Google Home, Alexa' },
    ] }],
  },
  {
    id: 'snap-case',
    name: 'Snap Case (magnet ring)',
    brand: 'Snap',
    category: 'Everyday carry',
    tagline: 'Adds a Qi2-aligned magnet ring to Android phones so magnetic accessories snap on.',
    price: 25,
    rating: 4.3,
    reviews: 2210,
    stock: 'in',
    fulfil: SUPPLIER,
    visual: 'case',
    hue: 200,
    trend: { label: 'Steady', delta: 20, series: [8, 8, 9, 9, 10, 10, 11, 11], source: 'Search + social, 7 days' },
    variants: [{ id: 'graphite', label: 'Graphite', swatch: '#2b2b30', hue: 200 }],
    facts: { givesMagnets: true },
    specs: [{ group: 'Case', rows: [{ label: 'Fits', value: 'Pixel 8/9, Galaxy S24/S25' }] }],
  },
  {
    id: 'plug-adapter',
    name: 'Travel plug adapter',
    brand: 'Aether',
    category: 'Power',
    tagline: 'Grounded adapter for devices that ship with a US, EU or UK plug.',
    price: 9,
    rating: 4.6,
    reviews: 15400,
    stock: 'in',
    fulfil: WAREHOUSE,
    visual: 'adapter',
    hue: 78,
    trend: { label: 'Steady', delta: 5, series: [30, 30, 31, 30, 31, 31, 32, 31], source: 'Search + social, 7 days' },
    variants: [{ id: 'graphite', label: 'Graphite', swatch: '#2b2b30', hue: 78 }],
    facts: { adapterFor: 'AU' },
    specs: [{ group: 'Adapter', rows: [{ label: 'Output', value: 'Type I (AU/NZ), 10 A' }] }],
  },
]

export const byId = (id: string) => products.find((p) => p.id === id)!

/** "My setup": what the shopper already owns. Checked live on every PDP and in the cart. */
export const gear: GearItem[] = [
  { id: 'g-iphone', name: 'iPhone 16 Pro', detail: 'iOS, MagSafe (Qi2), Find My', defaultOn: true,
    facts: { phone: { os: 'ios', magnets: true, trackerNet: 'find-my' } } },
  { id: 'g-pixel', name: 'Pixel 9', detail: 'Android, Qi (no magnets), Find Hub', defaultOn: false,
    facts: { phone: { os: 'android', magnets: false, trackerNet: 'find-hub' } } },
  { id: 'g-apple-home', name: 'Apple Home (Apple TV 4K)', detail: 'Apple Home, Matter, Thread border router', defaultOn: true,
    facts: { hubs: ['homekit', 'matter', 'thread'] } },
  { id: 'g-google-home', name: 'Google Home (Nest Hub)', detail: 'Google Home, Matter, no Thread', defaultOn: false,
    facts: { hubs: ['google', 'matter'] } },
  { id: 'g-switch', name: 'Nintendo Switch', detail: 'HDMI source', defaultOn: true,
    facts: { requires: [{ anyOf: ['hdmi'], label: 'an HDMI input' }] } },
  { id: 'g-region', name: 'Australia, 240 V, Type I', detail: 'Plug and voltage check', defaultOn: true,
    facts: { region: 'AU' } },
  { id: 'g-charger', name: 'Aether Cube 65 W', detail: 'USB-C PD charger you already own', defaultOn: true,
    facts: { pdOut: 65 } },
]

export interface NavColumn { title: string; items: string[] }
export interface NavSection { id: string; label: string; columns: NavColumn[]; featured: string }

export const nav: NavSection[] = [
  { id: 'trending', label: 'Trending', featured: 'loop-ring', columns: [
    { title: 'This week', items: ['Viral right now', 'Rising fast', 'New arrivals', 'Back in stock'] },
    { title: 'By signal', items: ['Hot on TikTok', 'Search spikes', 'Creator picks', 'Most wishlisted'] },
    { title: 'Collections', items: ['Under $100', 'Gifts that ship in 48 h', 'Travel tech', 'Desk upgrades'] },
  ] },
  { id: 'wearables', label: 'Wearables', featured: 'specs-air', columns: [
    { title: 'Body', items: ['Smart rings', 'Smart glasses', 'Fitness bands', 'Sleep tech'] },
    { title: 'Audio on you', items: ['Open-ear buds', 'Bone conduction', 'Sleep buds', 'Hearing assist'] },
    { title: 'Guides', items: ['Ring sizing', 'Which smart glasses?', 'Works with iPhone', 'Works with Android'] },
  ] },
  { id: 'smart-home', label: 'Smart home', featured: 'nimbus-orbit', columns: [
    { title: 'Devices', items: ['Cameras', 'Lighting', 'Robot vacuums', 'Air & climate'] },
    { title: 'Platforms', items: ['Apple Home', 'Google Home', 'Alexa', 'Matter & Thread hubs'] },
    { title: 'Guides', items: ['Do I need a hub?', 'Matter explained', 'Local-only setups'] },
  ] },
  { id: 'cinema', label: 'Cinema', featured: 'beam-4k', columns: [
    { title: 'Picture', items: ['Laser projectors', 'Pocket projectors', 'ALR screens', 'Streaming sticks'] },
    { title: 'Sound', items: ['Open-ear buds', 'Soundbars', 'Party speakers', 'Turntables'] },
    { title: 'Guides', items: ['Projector vs TV', 'Throw distance calculator', 'Movie night under $1,000'] },
  ] },
  { id: 'power', label: 'Power', featured: 'aether-magpack', columns: [
    { title: 'Power', items: ['Magnetic power banks', 'Solar chargers', 'GaN chargers', 'Portable power stations'] },
    { title: 'Mobility', items: ['E-scooters', 'E-bikes', 'Electric skateboards', 'Helmets & locks'] },
    { title: 'Guides', items: ['Qi2 vs MagSafe', 'Airline battery rules', 'Scooter laws by state'] },
  ] },
  { id: 'health', label: 'Health', featured: 'luma-mask', columns: [
    { title: 'Skin & light', items: ['LED masks', 'Red light panels', 'Microcurrent', 'Hair tools'] },
    { title: 'Body', items: ['Smart scales', 'Massage guns', 'Posture trainers', 'Sleep tech'] },
    { title: 'Guides', items: ['Red vs near-infrared', 'What the studies say', 'TGA-listed devices'] },
  ] },
  { id: 'maker', label: 'Maker', featured: 'flux-mini', columns: [
    { title: 'Make', items: ['Desk 3D printers', 'Laser engravers', 'Dev boards', 'Soldering'] },
    { title: 'Work', items: ['AI recorders', 'Label printers', 'Portable monitors', 'Stream decks'] },
    { title: 'Guides', items: ['First 3D print', 'Record meetings legally', 'Travel-ready desk'] },
  ] },
]

export const trendingSearches = ['smart ring', 'laser projector', 'open-ear buds', 'LED mask', 'Matter', 'AI recorder']

/** Trend tape shown in the hero: category momentum over 7 days. */
export const trendTape: { label: string; delta: number }[] = [
  { label: 'LED masks', delta: 310 },
  { label: 'AI recorders', delta: 260 },
  { label: 'Smart rings', delta: 212 },
  { label: 'Smart glasses', delta: 180 },
  { label: 'Laser projectors', delta: 140 },
  { label: 'Open-ear buds', delta: 120 },
  { label: 'Finder tags', delta: 110 },
  { label: 'Solar power banks', delta: 96 },
  { label: 'Desk 3D printers', delta: 88 },
  { label: 'Thread lighting', delta: 74 },
]
