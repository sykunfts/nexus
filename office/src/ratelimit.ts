/* A per-IP, per-route counter in KV, bucketed by minute; the key expires with the minute. */
import type { KV } from './kv'

export const LIMITS = { freight: 20, checkout: 20, notify: 5, orders: 60 } as const

export async function limit(kv: KV, route: string, ip: string, perMinute: number, now: Date): Promise<boolean> {
  const minute = Math.floor(now.getTime() / 60_000)
  const key = `rl:${route}:${ip}:${minute}`
  const count = Number((await kv.get(key)) ?? '0') + 1
  if (count > perMinute) return false
  await kv.put(key, String(count), { expirationTtl: 60 })
  return true
}
