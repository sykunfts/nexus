import { describe, expect, it } from 'vitest'
import { createMailer, templates } from '../src/email'
import { mkOrder } from './helpers'

const shipped = mkOrder('NX-000020', { state: 'shipped', supplier: { cjOrderId: 'CJ-1', placedAt: 't', trackNumber: 'CJPK123', logisticName: 'CJPacket Ordinary' } })
const site = 'https://sykunfts.github.io/nexus/'

describe('email', () => {
  it('templates carry the order id, totals and tracking link', () => {
    const c = templates.confirmation(mkOrder('NX-000020'), site)
    expect(c.subject).toContain('NX-000020')
    expect(c.text).toContain('$105.90')
    expect(c.text).toContain('#/orders/NX-000020')
    expect(c.text).not.toContain('nick@example.com')   // no need to echo the address back
    const s = templates.shipped(shipped, site)
    expect(s.text).toContain('https://t.17track.net/en#nums=CJPK123')
    expect(s.html).toContain('CJPacket Ordinary')
    const a = templates.attention(mkOrder('NX-000021', { state: 'needs_attention', attention: { reason: 'cj_pay_failed', at: 't', lastError: 'insufficient balance', attempts: 1, nextRetryAt: 't' } }), site)
    expect(a.subject).toContain('needs attention')
    expect(a.text).toContain('cj_pay_failed')
    expect(a.text).toContain('radar.html#orders')
  })
  it('disabled mode skips customer mail and still sends attention', async () => {
    const sent: { to: string; subject: string }[] = []
    const fetchImpl = (async (_url: string, init?: RequestInit) => { const b = JSON.parse(String(init?.body)); sent.push({ to: b.to, subject: b.subject }); return new Response('{"id":"e_1"}', { status: 200 }) }) as typeof fetch
    const m = createMailer({ fetch: fetchImpl, apiKey: 'k', from: 'orders@example.com', enabled: false, adminEmail: 'nick@example.com', siteUrl: site, log: () => {} })
    await m.confirmation(mkOrder('NX-000020'))
    await m.shipped(shipped)
    expect(sent).toEqual([])
    await m.attention(mkOrder('NX-000021', { state: 'needs_attention', attention: { reason: 'x', at: 't', lastError: 'e', attempts: 1, nextRetryAt: 't' } }))
    expect(sent.length).toBe(1)
    expect(sent[0].to).toBe('nick@example.com')
  })
  it('enabled mode sends customer mail and a failed send resolves without throwing', async () => {
    const sent: string[] = []
    const fetchImpl = (async (_url: string, init?: RequestInit) => { sent.push(JSON.parse(String(init?.body)).to); return new Response('{"id":"e_1"}', { status: 200 }) }) as typeof fetch
    const m = createMailer({ fetch: fetchImpl, apiKey: 'k', from: 'orders@example.com', enabled: true, adminEmail: '', siteUrl: site, log: () => {} })
    await m.confirmation(mkOrder('NX-000020'))
    expect(sent).toEqual(['nick@example.com'])
    const broken = createMailer({ fetch: (async () => { throw new Error('offline') }) as typeof fetch, apiKey: 'k', from: 'orders@example.com', enabled: true, adminEmail: 'a@b.co', siteUrl: site, log: () => {} })
    await expect(broken.shipped(shipped)).resolves.toBeUndefined()
    await expect(broken.attention(shipped)).resolves.toBeUndefined()
  })
})
