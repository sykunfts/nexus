import { describe, expect, it } from 'vitest'
import { benchFor, verdictText } from './bench'

describe('bench', () => {
  it('has six MoGo rows and none for other products', () => {
    expect(benchFor('xgimi-mogo-4-laser')).toHaveLength(6)
    expect(benchFor('chipolo-pop')).toEqual([])
  })
  it('words the verdict', () => {
    expect(verdictText({ metric: 'm', claimed: '550 ISO lm', measured: '380', by: 'x', url: 'u', verdict: 'check' })).toBe('Short of the claim')
    expect(verdictText({ metric: 'm', claimed: '40 ms', measured: '40 ms', by: 'x', url: 'u', verdict: 'pass' })).toBe('Matches the claim')
    expect(verdictText({ metric: 'm', claimed: '', measured: '40 ms', by: 'x', url: 'u', verdict: 'pass' })).toBe('No maker claim to check')
    expect(verdictText({ metric: 'm', claimed: '', measured: '92 min', by: 'x', url: 'u', verdict: 'check' })).toBe('A weak spot, no maker claim')
  })
  it('leads with the three rows the product page shows as tiles', () => {
    expect(benchFor('xgimi-mogo-4-laser').slice(0, 3).map((r) => r.metric)).toEqual(['Brightness, standard mode', 'Battery, standard mode', 'Input lag'])
  })
})
