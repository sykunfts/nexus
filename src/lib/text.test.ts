import { describe, expect, it } from 'vitest'
import { signedPct } from './text'

describe('signedPct', () => {
  it('signs a percentage change without doubling the sign', () => {
    expect(signedPct(140)).toBe('+140%')
    expect(signedPct(-12)).toBe('-12%')
    expect(signedPct(0)).toBe('0%')
  })
})
