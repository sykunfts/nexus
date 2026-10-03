/*
  The merchant view: every order the office holds, the ones needing a hand first, the stock-alert
  list, and a health strip. Gated by the admin token, which lives in this browser only.
*/
import { useCallback, useEffect, useState } from 'react'
import { admin, office, OfficeClientError, type OfficeOrder, type OrderState } from '../../lib/office'
import { REPO } from '../lib'
import { cn } from '../../lib/cn'

interface Health { ok: boolean; kv: boolean; stripeMode: 'test' | 'live' | 'missing'; cjAuth: boolean; emailEnabled: boolean; dryRun: boolean; cronLast: { at: string; synced: number; retried: number; errors: string[] } | null; catalogueSellable: number }
interface NotifyRow { productId: string; count: number; emails: string[] }

export const STATE_LABEL: Record<OrderState, string> = { paid: 'Paid', placed_with_supplier: 'With CJ', shipped: 'Shipped', delivered: 'Delivered', needs_attention: 'Needs attention', refunded: 'Refunded' }
const STATE_TONE: Record<OrderState, string> = { paid: 'bg-rule text-ink', placed_with_supplier: 'bg-check-tint text-check', shipped: 'bg-check-tint text-check', delivered: 'bg-pass-tint text-pass', needs_attention: 'bg-fail-tint text-fail', refunded: 'bg-rule text-ink-3' }
const RETRYABLE: OrderState[] = ['paid', 'needs_attention']
const REFUNDABLE: OrderState[] = ['paid', 'placed_with_supplier', 'shipped', 'delivered', 'needs_attention']
export const trackingUrl = (n: string) => `https://t.17track.net/en#nums=${encodeURIComponent(n)}`
const when = (iso: string) => new Date(iso).toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
/* Needs-attention first, then the office's own order (newest first). */
export const queueFirst = (orders: OfficeOrder[]) => [...orders.filter((o) => o.state === 'needs_attention'), ...orders.filter((o) => o.state !== 'needs_attention')]

function TokenForm({ refused, onToken }: { refused: boolean; onToken: (t: string) => void }) {
  const [value, setValue] = useState('')
  return (
    <form className="mx-auto max-w-[520px] py-16" onSubmit={(e) => { e.preventDefault(); if (value.trim()) onToken(value.trim()) }}>
      <h2 className="text-[22px] font-medium text-ink">Orders</h2>
      <p className="mt-2 text-[14px] text-ink-2">The office shows its orders to whoever holds the admin token (the Worker's <code className="reading">ADMIN_TOKEN</code> secret). It is kept in this browser only.</p>
      {refused && <p role="alert" className="mt-3 border border-fail bg-fail-tint px-3 py-2 text-[13px] text-fail">That token was refused. Check it against the Worker's secret and try again.</p>}
      <label className="mt-4 block">
        <span className="text-[12.5px] text-ink-2">Admin token</span>
        <input type="password" value={value} onChange={(e) => setValue(e.target.value)} autoComplete="off" className="mt-1 h-10 w-full border border-rule-2 bg-sheet px-3 text-[14px] text-ink focus:border-ink" />
      </label>
      <button type="submit" className="mt-3 h-10 bg-ink px-4 text-[14px] font-medium text-paper hover:bg-[#1f2730]">Open</button>
    </form>
  )
}

function HealthStrip({ h }: { h: Health }) {
  const item = (ok: boolean | null, text: string) => <span className={cn('flex items-center gap-1.5', ok === null ? 'text-ink-2' : ok ? 'text-pass' : 'text-fail')}><span className={cn('inline-block h-1.5 w-1.5', ok === null ? 'bg-rule-2' : ok ? 'bg-pass' : 'bg-fail')} aria-hidden />{text}</span>
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-1 border border-rule bg-sheet px-4 py-2.5 text-[12.5px]">
      {item(h.kv, h.kv ? 'KV reachable' : 'KV unreachable')}
      {item(h.stripeMode === 'live' ? true : h.stripeMode === 'test' ? null : false, h.stripeMode === 'missing' ? 'Stripe key missing' : `Stripe ${h.stripeMode} mode`)}
      {item(h.cjAuth, h.cjAuth ? 'CJ signed in' : 'CJ sign-in failing')}
      {item(h.dryRun ? null : true, h.dryRun ? 'CJ dry run (orders placed, not paid)' : 'CJ paying for real')}
      {item(h.emailEnabled ? true : null, h.emailEnabled ? 'Email on' : 'Email off (customers get nothing yet)')}
      {item(h.cronLast ? h.cronLast.errors.length === 0 : null, h.cronLast ? `Last cron ${when(h.cronLast.at)}: ${h.cronLast.synced} synced, ${h.cronLast.retried} retried${h.cronLast.errors.length ? `, ${h.cronLast.errors.length} errors` : ''}` : 'Last cron: not yet')}
      {item(h.catalogueSellable > 0 ? true : null, `${h.catalogueSellable} sellable listing${h.catalogueSellable === 1 ? '' : 's'}`)}
    </div>
  )
}

function OrderRow({ o, busy, onRetry, onRefund }: { o: OfficeOrder; busy: boolean; onRetry: () => void; onRefund: (note: string) => void }) {
  const [refunding, setRefunding] = useState(false)
  const [note, setNote] = useState('')
  return (
    <tr className={cn('border-t border-rule align-top', o.state === 'needs_attention' ? 'bg-fail-tint/40' : 'bg-sheet')} aria-label={`${o.id} ${STATE_LABEL[o.state]}`}>
      <td className="px-3 py-2"><span className="reading text-ink">{o.id}</span><span className="block text-[11.5px] text-ink-3">{when(o.createdAt)}</span></td>
      <td className="px-3 py-2"><span className={cn('inline-block px-1.5 py-0.5 text-[11.5px]', STATE_TONE[o.state])}>{STATE_LABEL[o.state]}</span>
        {o.attention && o.state === 'needs_attention' && <span className="mt-1 block max-w-[32ch] text-[12px] text-fail">{o.attention.reason}: {o.attention.lastError} ({o.attention.attempts} of 3)</span>}
      </td>
      <td className="px-3 py-2 text-ink-2">{o.lines.map((l) => <span key={l.productId + l.variantId} className="block truncate max-w-[28ch]">{l.qty} × {l.name}</span>)}<span className="block text-[11.5px] text-ink-3">{o.address.name}, {o.address.city} {o.address.postcode} {o.address.country}, {o.email}</span></td>
      <td className="reading px-3 py-2 text-right text-ink">${o.total.toFixed(2)}</td>
      <td className="px-3 py-2 text-ink-2">
        {o.supplier?.cjOrderId ? <span className="block">CJ {o.supplier.cjOrderId}{o.supplier.dryRun ? ' (dry run)' : ''}</span> : <span className="text-ink-3">not placed</span>}
        {o.supplier?.trackNumber && <a href={trackingUrl(o.supplier.trackNumber)} target="_blank" rel="noreferrer" className="block underline underline-offset-4 hover:text-ink">{o.supplier.logisticName ? `${o.supplier.logisticName} ` : ''}{o.supplier.trackNumber}</a>}
      </td>
      <td className="px-3 py-2">
        <div className="flex flex-wrap gap-1.5">
          {RETRYABLE.includes(o.state) && <button type="button" disabled={busy} onClick={onRetry} className="h-8 border border-ink px-2.5 text-[12.5px] text-ink hover:bg-ink hover:text-paper disabled:opacity-40">Retry</button>}
          {REFUNDABLE.includes(o.state) && !refunding && <button type="button" disabled={busy} onClick={() => setRefunding(true)} className="h-8 border border-rule-2 px-2.5 text-[12.5px] text-ink-2 hover:border-ink hover:text-ink disabled:opacity-40">Mark refunded</button>}
        </div>
        {refunding && (
          <form className="mt-2 flex flex-col gap-1.5" onSubmit={(e) => { e.preventDefault(); onRefund(note); setRefunding(false) }}>
            <label className="block"><span className="sr-only">Refund note</span><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Refund note, e.g. the Stripe refund id" aria-label="Refund note" className="h-8 w-full min-w-[220px] border border-rule-2 bg-sheet px-2 text-[12.5px] text-ink" /></label>
            <div className="flex gap-1.5"><button type="submit" className="h-8 bg-ink px-2.5 text-[12.5px] text-paper">Confirm refund</button><button type="button" onClick={() => setRefunding(false)} className="h-8 px-2 text-[12.5px] text-ink-2 hover:text-ink">Cancel</button></div>
            <span className="text-[11.5px] text-ink-3">Refund the card in Stripe first; this only records it.</span>
          </form>
        )}
      </td>
    </tr>
  )
}

export function OrdersTab() {
  const [token, setToken] = useState<string | null>(() => admin.token())
  const [refused, setRefused] = useState(false)
  const [health, setHealth] = useState<Health | null>(null)
  const [orders, setOrders] = useState<OfficeOrder[] | null>(null)
  const [notify, setNotify] = useState<NotifyRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const [h, o, n] = await Promise.all([admin.get<Health>('/admin/health'), admin.get<{ orders: OfficeOrder[] }>('/admin/orders'), admin.get<{ products: NotifyRow[] }>('/admin/notify')])
      setHealth(h); setOrders(queueFirst(o.orders)); setNotify(n.products)
    } catch (e) {
      if (e instanceof OfficeClientError && e.status === 401) { admin.setToken(''); setToken(null); setRefused(true); return }
      setError(e instanceof OfficeClientError && e.code === 'offline' ? 'The office did not answer. Is the Worker deployed and VITE_OFFICE_URL right?' : `Could not load the office (${e instanceof OfficeClientError ? e.code : 'error'}).`)
    }
  }, [])

  useEffect(() => { if (office.enabled && token) void load() }, [token, load])

  if (!office.enabled) {
    return (
      <div className="mx-auto max-w-[640px] py-16">
        <h2 className="text-[22px] font-medium text-ink">Orders</h2>
        <p className="mt-2 text-[14.5px] text-ink-2">The back office is not configured in this build: the shop was built without <code className="reading">VITE_OFFICE_URL</code>, so there is nothing to show here. The checkout runs as the prototype and takes no payment.</p>
        <p className="mt-2 text-[14.5px] text-ink-2">Deploying the Worker and pointing the build at it is a one-off; the steps are in the <a href={`https://github.com/${REPO}#back-office`} className="text-ink underline underline-offset-4">README under Back office</a>.</p>
      </div>
    )
  }
  if (!token) return <TokenForm refused={refused} onToken={(t) => { admin.setToken(t); setRefused(false); setToken(t) }} />

  const act = async (id: string, path: string, body: unknown, done: string) => {
    setBusy(id); setNotice(null); setError(null)
    try { await admin.post(path, body); setNotice(done); await load() }
    catch (e) { setError(e instanceof OfficeClientError ? `${id}: ${e.code}${e.message && e.message !== e.code ? ` (${e.message})` : ''}` : `${id}: failed`) }
    finally { setBusy(null) }
  }

  return (
    <div className="pt-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h2 className="text-[22px] font-medium text-ink">Orders</h2><p className="text-[13px] text-ink-2">Everything the office holds, newest first; anything needing a hand sits at the top.</p></div>
        <div className="flex gap-2 text-[12.5px]"><button type="button" onClick={() => void load()} className="h-8 border border-rule-2 px-2.5 text-ink-2 hover:border-ink hover:text-ink">Refresh</button><button type="button" onClick={() => { admin.setToken(''); setToken(null) }} className="h-8 px-2 text-ink-3 hover:text-ink">Forget token</button></div>
      </div>
      {health && <div className="mt-4"><HealthStrip h={health} /></div>}
      {error && <p role="alert" className="mt-3 border border-fail bg-fail-tint px-3 py-2 text-[13px] text-fail">{error}</p>}
      {notice && <p role="status" className="mt-3 border border-pass bg-pass-tint px-3 py-2 text-[13px] text-pass">{notice}</p>}
      {!orders ? (
        <div className="mt-4 space-y-2" aria-busy="true"><div className="skeleton h-10" /><div className="skeleton h-10" /></div>
      ) : orders.length === 0 ? (
        <div className="mt-4 border border-rule bg-sheet px-5 py-10 text-[14px] text-ink-2">No orders yet. The first paid checkout appears here within seconds of Stripe's webhook.</div>
      ) : (
        <div className="mt-4 overflow-x-auto border border-rule">
          <table className="w-full min-w-[960px] border-collapse text-[13px]">
            <thead><tr className="bg-paper text-left text-[12px] text-ink-3"><th className="px-3 py-2 font-normal">Order</th><th className="px-3 py-2 font-normal">State</th><th className="px-3 py-2 font-normal">Lines and customer</th><th className="px-3 py-2 text-right font-normal">Total</th><th className="px-3 py-2 font-normal">Supplier</th><th className="px-3 py-2 font-normal">Actions</th></tr></thead>
            <tbody>
              {orders.map((o) => <OrderRow key={o.id} o={o} busy={busy === o.id} onRetry={() => void act(o.id, `/admin/orders/${o.id}/retry`, {}, `Retried ${o.id}.`)} onRefund={(note) => void act(o.id, `/admin/orders/${o.id}/refunded`, { note }, `${o.id} marked refunded.`)} />)}
            </tbody>
          </table>
        </div>
      )}
      <h3 className="mt-8 text-[16px] font-medium text-ink">Tell-me-when list</h3>
      <p className="text-[13px] text-ink-2">Who asked to hear when a reference product is stocked. The best signal there is for what to list next.</p>
      {notify.length === 0 ? <p className="mt-2 text-[13px] text-ink-3">Nobody yet.</p> : (
        <table className="mt-2 w-full max-w-[720px] border-collapse border border-rule text-[13px]">
          <thead><tr className="bg-paper text-left text-[12px] text-ink-3"><th className="px-3 py-1.5 font-normal">Product</th><th className="px-3 py-1.5 font-normal">Asked</th><th className="px-3 py-1.5 font-normal">Emails</th></tr></thead>
          <tbody>{notify.map((n) => <tr key={n.productId} className="border-t border-rule bg-sheet"><td className="px-3 py-1.5 text-ink">{n.productId}</td><td className="reading px-3 py-1.5 text-ink-2">{n.count}</td><td className="px-3 py-1.5 text-ink-2">{n.emails.join(', ')}</td></tr>)}</tbody>
        </table>
      )}
    </div>
  )
}
