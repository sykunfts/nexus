/*
  Collections are declared queries: every mega-menu item, footer link and category tile is one of
  these (or a guide / fixed route), so the whole menu is data and nothing can be a dead end.
*/
import { nav, TREND_NOTE } from './data'
import { Filters, Route, Sort } from './routes'

export interface Collection { slug: string; title: string; blurb: string; filters: Filters; sort?: Sort }

const c = (slug: string, title: string, blurb: string, filters: Filters, sort?: Sort): Collection => ({ slug, title, blurb, filters, ...(sort ? { sort } : {}) })

export const COLLECTIONS: Collection[] = [
  // nav sections
  c('trending', 'Trending', `Everything in the catalogue, ranked by 7-day change in interest. ${TREND_NOTE}`, {}, 'trending'),
  c('wearables', 'Wearables', 'Rings, glasses, bands and watches, checked against your phone.', { category: ['Wearables'] }),
  c('smart-home', 'Smart home', 'Cameras, lights, robots, locks and hubs, checked against your home platform.', { category: ['Smart home'] }),
  c('cinema', 'Cinema', 'Projectors, screens and the sound to go with them.', { category: ['Home cinema', 'Audio'] }),
  c('power', 'Power', 'Banks, chargers, adapters and the scooters they charge.', { category: ['Power', 'Accessories', 'Mobility'] }),
  c('health', 'Health', 'Light therapy, recovery and measurement, with the maker\'s claims labelled as such.', { category: ['Health'] }),
  c('maker', 'Maker', 'Printers, boards, recorders, cameras and keyboards for the desk.', { category: ['Maker', 'Work'] }),
  // this week
  c('viral-right-now', 'Viral right now', `Interest more than tripled in seven days. ${TREND_NOTE}`, { badge: ['Viral'] }),
  c('rising-fast', 'Rising fast', `Climbing steadily this week. ${TREND_NOTE}`, { badge: ['Trending', 'Rising'] }),
  c('new-arrivals', 'New arrivals', 'Newest releases first, then the newest listings.', {}, 'newest'),
  // collections
  c('under-100', 'Under $100', 'Small, useful and under a hundred dollars.', { price: [0, 100] }),
  c('under-300', 'Under $300', 'The sweet spot for a gift that lands.', { price: [0, 300] }),
  c('gifts-48h', 'Gifts that ship in 48 h', 'On the shelf in Sydney and out the door within two days.', { route: 'warehouse' }),
  c('travel-tech', 'Travel tech', 'Power, audio and small tools that earn their place in a bag.', { category: ['Power', 'Accessories', 'Audio', 'Work'] }),
  // wearables
  c('smart-rings', 'Smart rings', 'Sleep, recovery and heart data from a ring, with or without a subscription.', { category: ['Wearables'], text: 'ring' }),
  c('smart-glasses', 'Smart glasses', 'Cameras, displays and audio in a frame.', { category: ['Wearables'], text: 'glasses' }),
  c('fitness-bands', 'Fitness bands', 'Screenless straps that track without a watch face.', { category: ['Wearables'], brand: ['WHOOP', 'Garmin'] }),
  c('smartwatches', 'Smartwatches', 'Watches that measure as well as tell the time.', { category: ['Wearables'], brand: ['Withings'] }),
  c('sleep-tech', 'Sleep tech', 'Devices that track the night.', { category: ['Wearables'], text: 'sleep' }),
  c('open-ear-buds', 'Open-ear buds', 'Earbuds that leave your ears open to the street.', { category: ['Audio'], text: 'ear' }),
  c('speakers', 'Speakers', 'Portable speakers that travel.', { category: ['Audio'], text: 'speaker' }),
  c('works-with-iphone', 'Works with iPhone', 'Everything that passes the works-with check against an iPhone.', { setupItem: 'g-iphone' }),
  c('works-with-android', 'Works with Android', 'Everything that passes the works-with check against a Pixel.', { setupItem: 'g-pixel' }),
  // smart home
  c('cameras', 'Cameras', 'Indoor and outdoor cameras and what they record to.', { category: ['Smart home'], text: 'camera' }),
  c('lighting', 'Lighting', 'Strips, panels and sync boxes.', { category: ['Smart home'], text: 'light' }),
  c('robot-vacuums', 'Robot vacuums', 'Floor and window robots with self-emptying bases.', { category: ['Smart home'], text: 'robot' }),
  c('locks', 'Locks', 'Smart locks and the platforms they unlock from.', { category: ['Smart home'], text: 'lock' }),
  c('hubs', 'Hubs', 'Matter controllers and Thread border routers.', { category: ['Smart home'], text: 'hub' }),
  c('apple-home', 'Apple Home', 'Works in the Home app.', { platform: ['homekit'] }),
  c('google-home', 'Google Home', 'Works in Google Home.', { platform: ['google'] }),
  c('alexa', 'Alexa', 'Works with Alexa.', { platform: ['alexa'] }),
  c('matter-thread', 'Matter and Thread', 'Joins any home app through Matter, over Wi-Fi or Thread.', { platform: ['matter', 'thread'] }),
  // cinema
  c('laser-projectors', 'Laser projectors', 'No bulb to replace.', { category: ['Home cinema'], text: 'laser' }),
  c('battery-projectors', 'Battery projectors', 'Projectors that run without a socket.', { category: ['Home cinema'], text: 'battery' }),
  c('outdoor-screens', 'Outdoor screens', 'Frames and fabric for the yard.', { category: ['Home cinema'], text: 'screen' }),
  // power
  c('power-banks', 'Power banks', 'From pocket Qi2 packs to 300 W bricks.', { category: ['Power'], text: 'power bank' }),
  c('chargers', 'Chargers', 'GaN wall chargers by wattage.', { category: ['Power'], text: 'charger' }),
  c('magnetic-charging', 'Magnetic charging', 'Qi2 and MagSafe pads and packs.', { category: ['Power'], text: 'magnetic' }),
  c('travel-adapters', 'Travel adapters', 'Plug adapters for devices that ship with another region\'s plug.', { category: ['Accessories'], text: 'adapter' }),
  c('e-scooters', 'E-scooters', 'Commuter scooters; check your state\'s rules before riding on public roads.', { category: ['Mobility'] }),
  // health
  c('led-masks', 'LED masks', 'Red and near-infrared light masks, with the maker\'s claims labelled as such.', { category: ['Health'], text: 'mask' }),
  c('smart-scales', 'Smart scales', 'Scales that sync to your health app.', { category: ['Health'], text: 'scale' }),
  c('recovery', 'Recovery', 'Compression and recovery gear.', { category: ['Health'], brand: ['Hyperice'] }),
  c('health-watches', 'Health watches', 'Watches with ECG and SpO2.', { category: ['Wearables'], text: 'ecg' }),
  // maker
  c('desk-3d-printers', 'Desk 3D printers', 'Printers that fit a desk and calibrate themselves.', { category: ['Maker'], text: 'print' }),
  c('dev-boards', 'Dev boards', 'Boards and multitools for tinkering.', { category: ['Maker'], brand: ['Flipper', 'Raspberry Pi'] }),
  c('ai-recorders', 'AI recorders', 'Recorders that transcribe and summarise.', { category: ['Work'], brand: ['Plaud'] }),
  c('cameras-gimbals', 'Cameras and gimbals', 'Pocket gimbals and 360 cameras.', { category: ['Work'], text: 'camera' }),
  c('keyboards', 'Keyboards', 'Keyboards with magnetic switches.', { category: ['Work'], text: 'keyboard' }),
]

export const collectionBySlug = (slug: string) => COLLECTIONS.find((x) => x.slug === slug)

const col = (slug: string): Route => ({ name: 'collection', slug, filters: {} })
const guide = (slug: string): Route => ({ name: 'guide', slug })

/** Mega-menu label → route. Section labels map to their section collection. */
const LABELS: Record<string, Route> = {
  Trending: col('trending'), Wearables: col('wearables'), 'Smart home': col('smart-home'), Cinema: col('cinema'), Power: col('power'), Health: col('health'), Maker: col('maker'),
  'Viral right now': col('viral-right-now'), 'Rising fast': col('rising-fast'), 'New arrivals': col('new-arrivals'),
  'Under $100': col('under-100'), 'Under $300': col('under-300'), 'Gifts that ship in 48 h': col('gifts-48h'), 'Travel tech': col('travel-tech'),
  'Smart rings': col('smart-rings'), 'Smart glasses': col('smart-glasses'), 'Fitness bands': col('fitness-bands'), Smartwatches: col('smartwatches'), 'Sleep tech': col('sleep-tech'),
  'Open-ear buds': col('open-ear-buds'), Speakers: col('speakers'), 'Works with iPhone': col('works-with-iphone'), 'Works with Android': col('works-with-android'),
  Cameras: col('cameras'), Lighting: col('lighting'), 'Robot vacuums': col('robot-vacuums'), Locks: col('locks'), Hubs: col('hubs'),
  'Apple Home': col('apple-home'), 'Google Home': col('google-home'), Alexa: col('alexa'), 'Matter and Thread': col('matter-thread'),
  'Laser projectors': col('laser-projectors'), 'Battery projectors': col('battery-projectors'), 'Outdoor screens': col('outdoor-screens'),
  'Power banks': col('power-banks'), Chargers: col('chargers'), 'Magnetic charging': col('magnetic-charging'), 'Travel adapters': col('travel-adapters'), 'E-scooters': col('e-scooters'),
  'LED masks': col('led-masks'), 'Smart scales': col('smart-scales'), Recovery: col('recovery'), 'Health watches': col('health-watches'),
  'Desk 3D printers': col('desk-3d-printers'), 'Dev boards': col('dev-boards'), 'AI recorders': col('ai-recorders'), 'Cameras and gimbals': col('cameras-gimbals'), Keyboards: col('keyboards'),
  'How we pick': { name: 'how-we-pick' },
  'Does it work with my phone?': guide('works-with-my-phone'), 'Movie night, checked as a set': guide('movie-night'), 'Throw distance calculator': guide('movie-night'),
  'Ring sizing': guide('ring-sizing'), 'Do I need a hub?': guide('do-i-need-a-hub'), 'Qi2 vs MagSafe': guide('qi2-vs-magsafe'), 'Red vs near-infrared': guide('red-vs-near-infrared'),
  'Compare projectors': { name: 'compare', ids: ['xgimi-mogo-4-laser', 'xgimi-vibe-one'] },
}

export function navTarget(label: string): Route {
  const r = LABELS[label]
  if (!r) throw new Error(`No target for "${label}"`)
  return r
}

export const FOOTER: { title: string; items: { label: string; route: Route }[] }[] = [
  { title: 'Shop', items: nav.map((s) => ({ label: s.label, route: navTarget(s.label) })) },
  { title: 'Help', items: [
    { label: 'My setup', route: { name: 'setup' } },
    { label: 'Works-with checker', route: guide('works-with-my-phone') },
    { label: 'Delivery and returns', route: { name: 'how-we-pick' } },
    { label: 'Orders', route: { name: 'orders' } },
    { label: 'Account', route: { name: 'account' } },
  ] },
  { title: 'Company', items: [
    { label: 'How we pick', route: { name: 'how-we-pick' } },
    { label: 'Guides', route: { name: 'guides' } },
  ] },
]
