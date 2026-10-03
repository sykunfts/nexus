/* USD→AUD for freight: ECB daily via frankfurter, cached a day; the last good rate survives the cache for the fallback. */
import { getJson, putJson, type KV } from './kv'
import { FALLBACK_RATE, RATE_URL } from '../../radar/src/money'
import { iso } from '../../radar/src/window'
import type { Rate } from '../../radar/src/types'

const FRESH = 'rate:usd-aud'
const LAST = 'rate:usd-aud:last'

export async function getRate(kv: KV, fetchImpl: typeof fetch, now: Date): Promise<Rate> {
  const fresh = await getJson<Rate>(kv, FRESH)
  if (fresh) return fresh
  try {
    const res = await fetchImpl(RATE_URL)
    if (res.ok) {
      const body = (await res.json()) as { date?: string; rates?: { AUD?: number } }
      const r = body.rates?.AUD
      if (typeof r === 'number' && r > 0) {
        const rate: Rate = { usdAud: r, source: 'ecb', date: body.date ?? iso(now) }
        await putJson(kv, FRESH, rate, { expirationTtl: 86_400 })
        await putJson(kv, LAST, rate)
        return rate
      }
    }
  } catch { /* fall through */ }
  const last = await getJson<Rate>(kv, LAST)
  if (last) return { usdAud: last.usdAud, source: 'previous', date: last.date }
  return { usdAud: FALLBACK_RATE, source: 'fallback', date: iso(now) }
}
