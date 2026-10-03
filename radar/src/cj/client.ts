/*
  CJdropshipping API 2.0: one token per run, one request a second (the http layer spaces the host),
  and every envelope checked before it is trusted. The key arrives through the environment only.
*/
import type { Http } from '../fetch'

export const CJ_BASE = 'https://developers.cjdropshipping.com/api2.0/v1'
export const CJ_HOST = 'developers.cjdropshipping.com'

interface Envelope<T> { code?: number; result?: boolean; message?: string; data?: T }

export class CjError extends Error {
  constructor(public code: number | string, message: string) { super(`CJ ${code}: ${message}`); this.name = 'CjError' }
}

export interface CjClient {
  auth(): Promise<void>
  get<T>(path: string, params: Record<string, string | number>): Promise<T>
  post<T>(path: string, body: unknown): Promise<T>
}

export function createCjClient(o: { apiKey: string; http: Http }): CjClient {
  let token: string | null = null
  const headers = () => ({ 'Content-Type': 'application/json', ...(token ? { 'CJ-Access-Token': token } : {}) })

  const unwrap = async <T,>(res: Response, path: string): Promise<T> => {
    const body = (await res.json().catch(() => ({}))) as Envelope<unknown>
    if (!res.ok || body.result === false || (typeof body.code === 'number' && body.code !== 200)) throw new CjError(body.code ?? res.status, `${body.message ?? res.statusText} (${path})`)
    return body as T
  }

  return {
    async auth() {
      const res = await o.http(`${CJ_BASE}/authentication/getAccessToken`, { method: 'POST', headers: headers(), body: JSON.stringify({ apiKey: o.apiKey }) })
      const body = await unwrap<Envelope<{ accessToken?: string }>>(res, '/authentication/getAccessToken')
      if (!body.data?.accessToken) throw new CjError('auth', 'no access token in the reply')
      token = body.data.accessToken
    },
    async get<T>(path: string, params: Record<string, string | number>) {
      const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString()
      const res = await o.http(`${CJ_BASE}${path}${qs ? `?${qs}` : ''}`, { headers: headers() })
      return unwrap<T>(res, path)
    },
    async post<T>(path: string, body: unknown) {
      const res = await o.http(`${CJ_BASE}${path}`, { method: 'POST', headers: headers(), body: JSON.stringify(body) })
      return unwrap<T>(res, path)
    },
  }
}
