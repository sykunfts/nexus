/* Shared fixtures for the office tests (not a test file: vitest would otherwise run imported tests twice). */
import type { OfficeOrder } from '../src/orders'

const quote = { lines: [{ productId: 'cj-P-A1', variantId: 'cj-V-AU', name: 'Projector', qty: 1, unitPrice: 95.95, vid: 'V-AU', origin: 'CN' }], subtotal: 95.95,
  shipping: { origin: 'CN' as const, method: 'standard' as const, logisticName: 'CJPacket Ordinary', aud: 9.95, days: [8, 15] as [number, number], fellBack: false }, tax: { amount: 9.63, included: true, label: 'Includes GST 10 %' }, total: 105.9 }
export const mkOrder = (id: string, over: Partial<OfficeOrder> = {}): OfficeOrder => ({
  id, createdAt: '2026-10-05T00:00:00.000Z', email: 'nick@example.com', address: { name: 'Nick', line1: '1 St', city: 'Sydney', region: 'NSW', postcode: '2000', country: 'AU' },
  lines: quote.lines, shipping: quote.shipping, tax: quote.tax, subtotal: quote.subtotal, total: quote.total, currency: 'AUD',
  stripe: { sessionId: `cs_${id}`, paymentIntentId: 'pi_1', paid: true }, state: 'paid', history: [{ at: '2026-10-05T00:00:00.000Z', state: 'paid' }], ...over,
})

