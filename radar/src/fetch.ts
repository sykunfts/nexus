/*
  One HTTP door for every source: a timeout, two retries with backoff, a polite gap between
  requests to the same host, and a User-Agent that says who is asking. Everything is injectable
  so tests drive it with a fake fetch and a fake clock.
*/
export type Fetch = (url: string, init?: RequestInit) => Promise<Response>

export interface HttpOptions {
  fetch?: Fetch
  sleep?: (ms: number) => Promise<void>
  now?: () => number
  timeoutMs?: number
  retryDelays?: number[]
  spacingMs?: Record<string, number>
  defaultSpacingMs?: number
  userAgent?: string
}

export interface Http {
  (url: string, init?: RequestInit): Promise<Response>
  json<T = unknown>(url: string, init?: RequestInit): Promise<T>
}

export const USER_AGENT = 'NexusRadar/0.3 (+https://github.com/sykunfts/nexus)'

const retryable = (status: number) => status === 429 || status >= 500

export function createHttp(o: HttpOptions = {}): Http {
  const fetchImpl = o.fetch ?? ((url, init) => globalThis.fetch(url, init))
  const sleep = o.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)))
  const now = o.now ?? (() => Date.now())
  const timeoutMs = o.timeoutMs ?? 15_000
  const retryDelays = o.retryDelays ?? [2000, 6000]
  const spacing = o.spacingMs ?? {}
  const defaultSpacing = o.defaultSpacingMs ?? 300
  const userAgent = o.userAgent ?? USER_AGENT
  const lastAt = new Map<string, number>()

  const once = async (url: string, init?: RequestInit): Promise<Response> => {
    const host = new URL(url).host
    const gap = spacing[host] ?? defaultSpacing
    const prev = lastAt.get(host)
    if (prev !== undefined) { const wait = gap - (now() - prev); if (wait > 0) await sleep(wait) }
    lastAt.set(host, now())
    const ctl = new AbortController()
    const timer = setTimeout(() => ctl.abort(), timeoutMs)
    try {
      return await fetchImpl(url, { ...init, signal: ctl.signal, headers: { 'User-Agent': userAgent, Accept: 'application/json, text/xml;q=0.9, */*;q=0.8', ...(init?.headers as Record<string, string> | undefined) } })
    } finally { clearTimeout(timer) }
  }

  const http = (async (url: string, init?: RequestInit): Promise<Response> => {
    let attempt = 0
    for (;;) {
      try {
        const res = await once(url, init)
        if (!retryable(res.status) || attempt >= retryDelays.length) return res
      } catch (e) {
        if (attempt >= retryDelays.length) throw e
      }
      await sleep(retryDelays[attempt])
      attempt++
    }
  }) as Http

  http.json = async <T,>(url: string, init?: RequestInit): Promise<T> => {
    const res = await http(url, init)
    if (!res.ok) throw new Error(`http ${res.status} ${url}`)
    return (await res.json()) as T
  }
  return http
}
