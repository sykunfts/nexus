import { describe, expect, it } from 'vitest'
import { getJson, MemoryKV, putJson } from '../src/kv'

describe('MemoryKV', () => {
  it('round-trips, lists by prefix in order, expires with TTL', async () => {
    let t = 1_000_000
    const kv = new MemoryKV({ now: () => t })
    await kv.put('order:NX-2', 'b')
    await kv.put('order:NX-1', 'a')
    await kv.put('draft:x', 'd', { expirationTtl: 60 })
    expect(await kv.get('order:NX-1')).toBe('a')
    expect((await kv.list({ prefix: 'order:' })).keys.map((k) => k.name)).toEqual(['order:NX-1', 'order:NX-2'])
    expect(await kv.get('draft:x')).toBe('d')
    t += 61_000
    expect(await kv.get('draft:x')).toBeNull()
    await kv.delete('order:NX-1')
    expect(await kv.get('order:NX-1')).toBeNull()
  })
  it('getJson returns null for missing and parses stored', async () => {
    const kv = new MemoryKV()
    expect(await getJson(kv, 'nope')).toBeNull()
    await putJson(kv, 'k', { a: 1 })
    expect(await getJson<{ a: number }>(kv, 'k')).toEqual({ a: 1 })
  })
})
