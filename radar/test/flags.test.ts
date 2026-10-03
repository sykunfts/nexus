import { describe, expect, it } from 'vitest'
import { FLAG_NOTES, flagsFor } from '../src/flags'

describe('flags', () => {
  it('battery', () => expect(flagsFor('10000mAh power bank', 200)).toContain('battery'))
  it('mains', () => expect(flagsFor('Projector with AU plug and wall charger', 1200)).toContain('mains'))
  it('radio', () => expect(flagsFor('Bluetooth 5.3 earbuds', 50)).toContain('radio'))
  it('skin', () => expect(flagsFor('LED therapy facial mask', 300)).toContain('skin'))
  it('kids', () => expect(flagsFor('Toy robot for kids', 300)).toContain('kids'))
  it('heavy at 2001 g not 2000', () => {
    expect(flagsFor('Robot vacuum', 2001)).toContain('heavy')
    expect(flagsFor('Robot vacuum', 2000)).not.toContain('heavy')
  })
  it('no flags on plain text', () => expect(flagsFor('Wooden phone stand', 120)).toEqual([]))
  it('every flag has a note', () => {
    for (const f of ['battery', 'mains', 'radio', 'skin', 'kids', 'heavy'] as const) expect(FLAG_NOTES[f].length).toBeGreaterThan(20)
  })
})
