/*
  The slice of Cloudflare KV the office uses, so every handler can run in tests against MemoryKV.
  The real binding (KVNamespace) satisfies this interface as-is.
*/
export interface KV {
  get(key: string): Promise<string | null>
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>
  delete(key: string): Promise<void>
  list(opts: { prefix: string; limit?: number; cursor?: string }): Promise<{ keys: { name: string }[]; list_complete: boolean; cursor?: string }>
}

export class MemoryKV implements KV {
  private store = new Map<string, { value: string; expiresAt: number | null }>()
  private now: () => number
  constructor(o: { now?: () => number } = {}) { this.now = o.now ?? (() => Date.now()) }
  private live(key: string) {
    const e = this.store.get(key)
    if (!e) return null
    if (e.expiresAt !== null && e.expiresAt <= this.now()) { this.store.delete(key); return null }
    return e
  }
  async get(key: string) { return this.live(key)?.value ?? null }
  async put(key: string, value: string, opts?: { expirationTtl?: number }) {
    this.store.set(key, { value, expiresAt: opts?.expirationTtl ? this.now() + opts.expirationTtl * 1000 : null })
  }
  async delete(key: string) { this.store.delete(key) }
  async list(opts: { prefix: string; limit?: number; cursor?: string }) {
    const keys = [...this.store.keys()].filter((k) => k.startsWith(opts.prefix) && this.live(k)).sort()
    const start = opts.cursor ? Number(opts.cursor) : 0
    const limit = opts.limit ?? 1000
    const page = keys.slice(start, start + limit)
    const done = start + limit >= keys.length
    return { keys: page.map((name) => ({ name })), list_complete: done, ...(done ? {} : { cursor: String(start + limit) }) }
  }
}

export async function getJson<T>(kv: KV, key: string): Promise<T | null> {
  const raw = await kv.get(key)
  if (raw === null) return null
  try { return JSON.parse(raw) as T } catch { return null }
}
export const putJson = (kv: KV, key: string, value: unknown, opts?: { expirationTtl?: number }) => kv.put(key, JSON.stringify(value), opts)

/* Every key of a prefix, following cursors. */
export async function listAll(kv: KV, prefix: string): Promise<string[]> {
  const out: string[] = []
  let cursor: string | undefined
  do {
    const page = await kv.list({ prefix, cursor })
    out.push(...page.keys.map((k) => k.name))
    cursor = page.list_complete ? undefined : page.cursor
  } while (cursor)
  return out
}
