import { describe, expect, it } from 'vitest'
import { customGear, DEVICES, toGear } from './devices'

describe('devices', () => {
  it('every device carries a source and a kind', () => {
    for (const d of DEVICES) {
      expect(d.source.length, d.id).toBeGreaterThan(5)
      expect(['phone', 'hub', 'charger', 'source', 'region']).toContain(d.kind)
    }
    expect(new Set(DEVICES.map((d) => d.id)).size).toBe(DEVICES.length)
  })
  it('iPhone 16e has no magnets and Pixel 10 does', () => {
    expect(DEVICES.find((d) => d.id === 'iphone-16e')!.facts.phone!.magnets).toBe(false)
    expect(DEVICES.find((d) => d.id === 'pixel-10')!.facts.phone!.magnets).toBe(true)
  })
  it('Apple TV 4K Wi-Fi only is not a Thread border router', () => {
    expect(DEVICES.find((d) => d.id === 'apple-tv-4k-wifi')!.facts.hubs).not.toContain('thread')
    expect(toGear(DEVICES.find((d) => d.id === 'homepod-mini')!).facts.hubs).toContain('thread')
  })
  it('gear from a device keeps the device id', () => {
    const g = toGear(DEVICES.find((d) => d.id === 'pixel-9')!)
    expect(g.deviceId).toBe('pixel-9')
    expect(g.kind).toBe('phone')
    expect(g.id).toBe('d-pixel-9')
  })
  it('a custom source always requires an HDMI input, whatever facts the form held', () => {
    const g = customGear('source', '  Switch 2 ', {}, 'abc')
    expect(g.id).toBe('c-abc')
    expect(g.name).toBe('Switch 2')
    expect(g.facts.requires).toEqual([{ anyOf: ['hdmi'], label: 'an HDMI input' }])
    expect(g.defaultOn).toBe(true)
  })
  it('a custom phone keeps the facts ticked on the form', () => {
    const g = customGear('phone', 'Galaxy A56', { phone: { os: 'android', magnets: false, trackerNet: 'find-hub' } }, 'x')
    expect(g.facts.phone?.os).toBe('android')
    expect(g.facts.requires).toBeUndefined()
  })
})
