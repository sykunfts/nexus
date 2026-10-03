/* Compliance flags from the words on a listing. They never block; they tell Nick what to check before selling in Australia. */
import type { Flag } from './types'

export const FLAG_NOTES: Record<Flag, string> = {
  battery: 'Lithium batteries limit the courier choices and need UN38.3 test reports from the supplier.',
  mains: 'Mains devices need the RCM mark and an approved AU plug; a 110 V-only item cannot be sold here.',
  radio: 'Radio devices need ACMA compliance (RCM) and a supplier declaration.',
  skin: 'Devices used on the body attract consumer-law scrutiny of claims; avoid medical claims.',
  kids: 'Mandatory toy safety standards apply.',
  heavy: 'Freight dominates the price; check the cheapest line is a real courier.',
}

export const HEAVY_G = 2000

const RULES: { flag: Flag; re: RegExp }[] = [
  { flag: 'battery', re: /\b(battery|mah|lithium|rechargeable|power bank)\b/i },
  { flag: 'mains', re: /\b(plug|adapter|charger|220\s?v|110\s?v|wall)\b/i },
  { flag: 'radio', re: /\b(bluetooth|wifi|wi-fi|2\.4g|wireless|ble|zigbee|thread)\b/i },
  { flag: 'skin', re: /\b(mask|led therapy|facial|massage|massager|skin)\b/i },
  { flag: 'kids', re: /\b(kids|children|toy|baby)\b/i },
]

export function flagsFor(text: string, weightG: number): Flag[] {
  const out: Flag[] = RULES.filter((r) => r.re.test(text)).map((r) => r.flag)
  if (weightG > HEAVY_G) out.push('heavy')
  return out
}
