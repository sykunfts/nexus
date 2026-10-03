/*
  Three emails through Resend: the order confirmation, the shipping notice with tracking, and the
  needs-attention note to Nick. Customer mail waits for a verified domain (EMAIL_ENABLED); the
  note to Nick goes whenever a key and an address exist. Sending never changes an order.
*/
import type { OfficeOrder } from './orders'

export interface Mailer { confirmation(o: OfficeOrder): Promise<void>; shipped(o: OfficeOrder): Promise<void>; attention(o: OfficeOrder): Promise<void> }
export interface Mail { subject: string; text: string; html: string }

export const RESEND_URL = 'https://api.resend.com/emails'
const aud = (n: number) => `$${n.toFixed(2)}`
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
const wrap = (title: string, lines: string[]) => ({
  text: [title, '', ...lines].join('\n'),
  html: `<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;color:#121820;max-width:560px"><h2 style="font-weight:500">${esc(title)}</h2>${lines.map((l) => `<p style="margin:6px 0">${esc(l)}</p>`).join('')}</div>`,
})
export const trackingUrl = (n: string) => `https://t.17track.net/en#nums=${encodeURIComponent(n)}`
const orderUrl = (site: string, id: string) => `${site}#/orders/${id}`

export const templates = {
  confirmation(o: OfficeOrder, site: string): Mail {
    const lines = [
      `Thanks for your order. Order number ${o.id}.`,
      ...o.lines.map((l) => `${l.qty} × ${l.name}, ${aud(l.unitPrice * l.qty)}`),
      `Shipping: ${o.shipping.logisticName}, ${o.shipping.days[0]}–${o.shipping.days[1]} days, ${aud(o.shipping.aud)}`,
      o.tax.included ? `Total ${aud(o.total)} (${o.tax.label.toLowerCase()})` : `${o.tax.label}: ${aud(o.tax.amount)}. Total ${aud(o.total)}`,
      `Delivering to ${o.address.name}, ${o.address.line1}, ${o.address.city} ${o.address.postcode}, ${o.address.country}.`,
      `Follow it at ${orderUrl(site, o.id)} with this email address.`,
    ]
    return { subject: `Your Nexus order ${o.id}`, ...wrap(`Order ${o.id} confirmed`, lines) }
  },
  shipped(o: OfficeOrder, site: string): Mail {
    const t = o.supplier?.trackNumber ?? ''
    const lines = [
      `Order ${o.id} is on its way with ${o.supplier?.logisticName ?? o.shipping.logisticName}.`,
      t ? `Tracking number ${t}: ${trackingUrl(t)}` : 'A tracking number will follow.',
      `Expected ${o.shipping.days[0]}–${o.shipping.days[1]} days from dispatch. Order page: ${orderUrl(site, o.id)}`,
    ]
    return { subject: `Your Nexus order ${o.id} has shipped`, ...wrap(`Order ${o.id} shipped`, lines) }
  },
  attention(o: OfficeOrder, site: string): Mail {
    const a = o.attention
    const lines = [
      `Order ${o.id} needs attention: ${a?.reason ?? 'unknown'}.`,
      `Last error: ${a?.lastError ?? ''}`,
      `Attempt ${a?.attempts ?? 0}; next automatic retry ${a?.nextRetryAt ?? 'none'}.`,
      `Total ${aud(o.total)}, ${o.lines.length} line(s), CJ order ${o.supplier?.cjOrderId ?? 'not created'}.`,
      `Open the merchant view: ${site}radar.html#orders`,
    ]
    return { subject: `Nexus order ${o.id} needs attention (${a?.reason ?? ''})`, ...wrap(`Order ${o.id} needs attention`, lines) }
  },
}

export function createMailer(o: { fetch: typeof fetch; apiKey: string; from: string; enabled: boolean; adminEmail: string; siteUrl: string; log: (s: string) => void }): Mailer {
  const send = async (to: string, mail: Mail, what: string) => {
    if (!o.apiKey || !to) { o.log(`email ${what}: skipped (no key or address)`); return }
    try {
      const res = await o.fetch(RESEND_URL, { method: 'POST', headers: { Authorization: `Bearer ${o.apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: o.from, to, subject: mail.subject, text: mail.text, html: mail.html }) })
      if (!res.ok) o.log(`email ${what}: resend answered ${res.status}`)
    } catch (e) { o.log(`email ${what}: ${e instanceof Error ? e.message : String(e)}`) }
  }
  const customer = async (order: OfficeOrder, mail: Mail, what: string) => {
    if (!o.enabled) { o.log(`email ${what} for ${order.id}: customer mail disabled`); return }
    await send(order.email, mail, `${what} ${order.id}`)
  }
  return {
    confirmation: (order) => customer(order, templates.confirmation(order, o.siteUrl), 'confirmation'),
    shipped: (order) => customer(order, templates.shipped(order, o.siteUrl), 'shipped'),
    attention: (order) => send(o.adminEmail, templates.attention(order, o.siteUrl), `attention ${order.id}`),
  }
}
