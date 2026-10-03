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
