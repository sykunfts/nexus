/* The Worker entry: real KV, real fetch, real clock. Everything else is in office.ts and testable. */
import type { Env } from './env'
import { createOffice } from './office'

const office = (env: Env) => createOffice({ kv: env.ORDERS, env, fetch: (input, init) => globalThis.fetch(input, init), now: () => new Date(), random: Math.random })

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return office(env).fetch(request, (p) => ctx.waitUntil(p))
  },
  scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): void {
    ctx.waitUntil(office(env).scheduled())
  },
}
