/* What a merchant (or a monitor) needs to know the office is alive: KV, Stripe key mode, CJ auth, email, last cron. */
import { getJson, putJson } from './kv'
import type { Ctx } from './office'

export const CJ_AUTH_TTL_SEC = 3600

export async function cjAuthOk(c: Ctx): Promise<boolean> {
  const cached = await getJson<{ ok: boolean }>(c.kv, 'cj:auth')
  if (cached) return cached.ok
  let ok = false
  try { ok = await c.cj.auth() } catch { ok = false }
  await putJson(c.kv, 'cj:auth', { ok, at: c.now().toISOString() }, { expirationTtl: CJ_AUTH_TTL_SEC })
  return ok
}

export async function health(c: Ctx): Promise<Record<string, unknown>> {
  let kvOk = true
  try { await c.kv.get('health:ping') } catch { kvOk = false }
  const key = c.env.STRIPE_SECRET_KEY ?? ''
  return {
    ok: kvOk,
    kv: kvOk,
    stripeMode: key.startsWith('sk_live_') ? 'live' : key.startsWith('sk_test_') ? 'test' : 'missing',
    cjAuth: kvOk ? await cjAuthOk(c) : false,
    emailEnabled: c.env.EMAIL_ENABLED === '1',
    dryRun: c.env.CJ_DRY_RUN === '1',
    cronLast: await getJson(c.kv, 'cron:last'),
    catalogueSellable: c.catalogue.filter((p) => p.sellable).length,
  }
}
