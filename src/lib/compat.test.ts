import { describe, expect, it } from 'vitest'
import { checkBuild, resolveFacts } from './compat'
import { byId, gear } from './data'

describe('compat smoke', () => {
  it('MagGo warns on a Pixel 9 alone and offers the ESR ring', () => {
    const p = byId('anker-maggo-10k')
    const pixel = gear.find((g) => g.id === 'g-pixel')!
    const r = checkBuild({ name: p.name, facts: resolveFacts(p, {}), product: p }, [{ id: pixel.id, name: pixel.name, facts: pixel.facts }])
    expect(r.status).toBe('warn')
    expect(r.issues[0].fix?.sku).toBe('esr-halolock-ring')
    expect(r.issues[0].fix?.price).toBe(26.38)
  })
})

describe('plug families and voltage', () => {
  const region = (r: 'AU' | 'NZ' | 'US' | 'CA' | 'UK' | 'EU' | 'JP') => ({ id: 'g-region', name: 'Region', facts: { region: r } })
  it('AU plug passes in NZ', () => {
    const p = byId('xgimi-mogo-4-laser')
    const r = checkBuild({ name: p.name, facts: resolveFacts(p, {}), product: p }, [region('NZ')])
    expect(r.issues.find((i) => i.id === 'plug')).toBeUndefined()
  })
  it('US plug passes in JP', () => {
    const p = byId('xgimi-mogo-4-laser')
    const r = checkBuild({ name: p.name, facts: resolveFacts(p, { plug: 'US' }), product: p }, [region('JP')])
    expect(r.issues.find((i) => i.id === 'plug')).toBeUndefined()
  })
  it('110 V device fails in UK', () => {
    const p = byId('xgimi-mogo-4-laser')
    const r = checkBuild({ name: 'Synthetic 110 V', facts: { voltage: '110', plug: 'US' }, product: p }, [region('UK')])
    expect(r.issues.find((i) => i.id === 'voltage')?.severity).toBe('bad')
  })
})
