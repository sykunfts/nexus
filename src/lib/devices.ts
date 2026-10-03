/*
  Devices a shopper can add to My setup. Each fact was checked on 3 Oct 2026 against the page in
  `source`; a device whose fact could not be verified is left out rather than guessed.
  Chargers, sources and regions are the shopper's own statement about what they own.
*/
import { CompatFacts, GearItem, GearKind, Region, REGION_LABEL } from './data'

export interface Device { id: string; kind: GearKind; name: string; detail: string; facts: CompatFacts; source: string }

const APPLE_MAGSAFE = 'https://www.apple.com/iphone/compare/'
const IPHONE_16E = 'https://www.apple.com/iphone-16e/specs/'          // Qi wireless charging, no MagSafe
const PIXEL_10 = 'https://store.google.com/product/pixel_10_specs'     // Pixelsnap: Qi2 magnets built in
const PIXEL_9 = 'https://store.google.com/product/pixel_9_specs'
const PIXEL_8 = 'https://store.google.com/product/pixel_8_specs'
const GALAXY_S26 = 'https://www.techadvisor.com/article/3068758/galaxy-s26-doesnt-have-qi2-magnets-samsung-explains-why.html'
const SAMSUNG_QI2_READY = 'https://www.androidcentral.com/phones/samsung-galaxy/samsung-galaxy-s26-qi2-magnetic-charging'
const THREAD_LIST = 'https://www.matteralpha.com/frequently-asked-questions/complete-list-thread-border-routers'
const USER = 'user-stated'

const phone = (id: string, name: string, os: 'ios' | 'android', magnets: boolean, source: string): Device => ({
  id, kind: 'phone', name,
  detail: `${os === 'ios' ? 'iOS' : 'Android'}, ${magnets ? (os === 'ios' ? 'MagSafe (Qi2)' : 'Qi2 magnets') : 'Qi, no magnets'}, ${os === 'ios' ? 'Find My' : 'Find Hub'}`,
  facts: { phone: { os, magnets, trackerNet: os === 'ios' ? 'find-my' : 'find-hub' } }, source,
})
const hub = (id: string, name: string, hubs: NonNullable<CompatFacts['hubs']>, source: string): Device => ({
  id, kind: 'hub', name,
  detail: [hubs.includes('homekit') ? 'Apple Home' : hubs.includes('google') ? 'Google Home' : 'Alexa', hubs.includes('matter') ? 'Matter' : null, hubs.includes('thread') ? 'Thread border router' : 'no Thread'].filter(Boolean).join(', '),
  facts: { hubs }, source,
})
const charger = (w: number): Device => ({ id: `charger-${w}w`, kind: 'charger', name: `${w} W USB-C charger`, detail: 'USB-C PD charger you already own', facts: { pdOut: w }, source: USER })
const source = (id: string, name: string, anyOf: ('hdmi' | 'usb-c')[], label: string): Device => ({ id, kind: 'source', name, detail: `${label} source`, facts: { requires: [{ anyOf, label: anyOf.length > 1 ? 'an HDMI or USB-C input' : 'an HDMI input' }] }, source: USER })
const region = (r: Region): Device => ({ id: `region-${r.toLowerCase()}`, kind: 'region', name: REGION_LABEL[r], detail: 'Plug and voltage check', facts: { region: r }, source: USER })

export const DEVICES: Device[] = [
  phone('iphone-17-pro', 'iPhone 17 Pro', 'ios', true, APPLE_MAGSAFE),
  phone('iphone-17', 'iPhone 17', 'ios', true, APPLE_MAGSAFE),
  phone('iphone-16-pro', 'iPhone 16 Pro', 'ios', true, APPLE_MAGSAFE),
  phone('iphone-16', 'iPhone 16', 'ios', true, APPLE_MAGSAFE),
  phone('iphone-16e', 'iPhone 16e', 'ios', false, IPHONE_16E),
  phone('iphone-15', 'iPhone 15', 'ios', true, APPLE_MAGSAFE),
  phone('pixel-10-pro', 'Pixel 10 Pro', 'android', true, PIXEL_10),
  phone('pixel-10', 'Pixel 10', 'android', true, PIXEL_10),
  phone('pixel-9', 'Pixel 9', 'android', false, PIXEL_9),
  phone('pixel-8', 'Pixel 8', 'android', false, PIXEL_8),
  phone('galaxy-s26', 'Galaxy S26', 'android', false, GALAXY_S26),
  phone('galaxy-s25', 'Galaxy S25', 'android', false, SAMSUNG_QI2_READY),
  phone('galaxy-s24', 'Galaxy S24', 'android', false, SAMSUNG_QI2_READY),

  hub('apple-tv-4k-ethernet', 'Apple TV 4K (Wi-Fi + Ethernet)', ['homekit', 'matter', 'thread'], THREAD_LIST),
  hub('apple-tv-4k-wifi', 'Apple TV 4K (Wi-Fi)', ['homekit', 'matter'], THREAD_LIST),
  hub('homepod-mini', 'HomePod mini', ['homekit', 'matter', 'thread'], THREAD_LIST),
  hub('nest-hub-2', 'Nest Hub (2nd gen)', ['google', 'matter', 'thread'], THREAD_LIST),
  hub('nest-mini', 'Nest Mini', ['google', 'matter'], THREAD_LIST),
  hub('nest-wifi-pro', 'Nest Wifi Pro', ['google', 'matter', 'thread'], THREAD_LIST),
  hub('echo-4', 'Echo (4th gen)', ['alexa', 'matter', 'thread'], THREAD_LIST),
  hub('echo-hub', 'Echo Hub', ['alexa', 'matter', 'thread'], THREAD_LIST),
  hub('aqara-hub-m3', 'Aqara Hub M3', ['matter', 'thread', 'homekit', 'google', 'alexa'], 'https://www.aqara.com/en/product/hub-m3/'),

  charger(20), charger(30), charger(45), charger(65), charger(100),

  source('switch', 'Nintendo Switch', ['hdmi'], 'HDMI'),
  source('ps5', 'PlayStation 5', ['hdmi'], 'HDMI'),
  source('xbox-series-x', 'Xbox Series X', ['hdmi'], 'HDMI'),
  source('laptop', 'Laptop', ['hdmi', 'usb-c'], 'HDMI or USB-C'),

  ...(['AU', 'NZ', 'US', 'CA', 'UK', 'EU', 'JP'] as Region[]).map(region),
]

export const deviceById = (id: string) => DEVICES.find((d) => d.id === id)

export function toGear(d: Device): GearItem {
  return { id: d.kind === 'region' ? 'g-region' : `d-${d.id}`, kind: d.kind, name: d.name, detail: d.detail, facts: d.facts, defaultOn: true, deviceId: d.id }
}

/* A device the user typed in. A source always demands an HDMI input on what it plugs into; other kinds carry the facts the form ticked. */
export function customGear(kind: GearKind, name: string, facts: CompatFacts, token: string = Date.now().toString(36)): GearItem {
  const f: CompatFacts = kind === 'source' ? { requires: [{ anyOf: ['hdmi'], label: 'an HDMI input' }] } : facts
  return { id: `c-${token}`, kind, name: name.trim(), detail: 'Added by you', facts: f, defaultOn: true }
}
