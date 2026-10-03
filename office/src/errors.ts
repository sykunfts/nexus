/* One error type for everything the office refuses, with the HTTP status and a code the shop can show. */
export class OfficeError extends Error {
  constructor(public status: number, public code: string, public field?: string, message?: string) {
    super(message ?? code)
    this.name = 'OfficeError'
  }
}

export const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...headers } })

export function toResponse(e: unknown): Response {
  if (e instanceof OfficeError) return json({ error: e.code, ...(e.field ? { field: e.field } : {}), message: e.message !== e.code ? e.message : undefined }, e.status)
  return json({ error: 'internal' }, 500)
}
