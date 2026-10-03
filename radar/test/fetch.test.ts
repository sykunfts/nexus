import { describe, expect, it } from 'vitest'
import { createHttp } from '../src/fetch'

const res = (status: number, body = '{}') => new Response(body, { status, headers: { 'content-type': 'application/json' } })

function harness(responses: (() => Promise<Response>)[], spacingMs: Record<string, number> = {}) {
  const sleeps: number[] = []
  let t = 1_000_000
  const calls: { url: string; init?: RequestInit }[] = []
  const fetch = async (url: string, init?: RequestInit) => { calls.push({ url, init }); const next = responses.shift(); if (!next) throw new Error('no more responses'); return next() }
  const http = createHttp({ fetch, sleep: async (ms) => { sleeps.push(ms); t += ms }, now: () => t, spacingMs, timeoutMs: 10, retryDelays: [2000, 6000], userAgent: 'NexusRadar/test' })
  return { http, sleeps, calls, clock: () => t }
}

describe('createHttp', () => {
  it('retries twice on 503 then succeeds', async () => {
    const h = harness([async () => res(503), async () => res(503), async () => res(200, '{"ok":1}')])
    const out = await h.http.json<{ ok: number }>('https://a.test/x')
    expect(out).toEqual({ ok: 1 })
    expect(h.sleeps).toEqual([2000, 6000])
    expect(h.calls.length).toBe(3)
  })
  it('gives up after the retries and throws on a bad status', async () => {
    const h = harness([async () => res(503), async () => res(503), async () => res(503)])
    await expect(h.http.json('https://a.test/x')).rejects.toThrow('http 503 https://a.test/x')
  })
  it('spaces requests to the same host', async () => {
    const h = harness([async () => res(200), async () => res(200), async () => res(200)], { 'a.test': 1100 })
    await h.http('https://a.test/1')
    await h.http('https://a.test/2')
    await h.http('https://b.test/3')
    expect(h.sleeps.filter((s) => s === 1100).length).toBe(1)   // the second a.test call waited; b.test did not
  })
  it('sends the user agent', async () => {
    const h = harness([async () => res(200)])
    await h.http('https://a.test/x')
    expect((h.calls[0].init?.headers as Record<string, string>)['User-Agent']).toBe('NexusRadar/test')
  })
  it('times out a hanging request and retries', async () => {
    const hang = () => new Promise<Response>((_, reject) => { setTimeout(() => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })), 15) })
    const h = harness([hang, async () => res(200, '{"late":true}')])
    const out = await h.http.json<{ late: boolean }>('https://a.test/x')
    expect(out.late).toBe(true)
    expect(h.sleeps).toContain(2000)
  })
})
