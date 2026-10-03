/* Orders list and one order with its shipment timelines. Status is derived from time, re-read every 30 s. */
import { useEffect, useState } from 'react'
import { products } from '../lib/data'
import { fmt } from '../lib/currency'
import { Order, OrderStatus, orderStatus, shipmentStatus } from '../lib/orders'
import { COUNTRIES, originLabel } from '../lib/shipping'
import { useStore } from '../lib/store'
import { ProductImage } from '../components/ProductVisual'
import { Button } from '../components/ui'
import { NotFoundPage } from './NotFoundPage'
import { cn } from '../lib/cn'

const LABEL: Record<OrderStatus, string> = { placed: 'Placed', packed: 'Packed', shipped: 'Shipped', delivered: 'Delivered' }
const TONE: Record<OrderStatus, string> = { placed: 'text-ink-2', packed: 'text-check', shipped: 'text-check', delivered: 'text-pass' }

function useNow(every = 30_000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => { const t = window.setInterval(() => setNow(new Date()), every); return () => window.clearInterval(t) }, [every])
  return now
}

const when = (iso: string) => new Date(iso).toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

function Crumb({ label }: { label: string }) {
  const go = useStore((s) => s.go)
  return (
    <nav aria-label="Breadcrumb" className="py-4 text-[13px] text-ink-3">
      <button type="button" onClick={() => go({ name: 'home' })} className="hover:text-ink">Home</button><span className="mx-1.5">/</span>
      <button type="button" onClick={() => go({ name: 'orders' })} className="hover:text-ink">Orders</button>
      {label !== 'Orders' && <><span className="mx-1.5">/</span><span className="text-ink">{label}</span></>}
    </nav>
  )
}

export function OrdersPage() {
  const orders = useStore((s) => s.orders)
  const go = useStore((s) => s.go)
  const now = useNow()
  return (
    <div className="mx-auto max-w-[1440px] px-4 pb-24 md:px-6 lg:pb-16">
      <Crumb label="Orders" />
      <h1 className="display-md text-[34px] text-ink sm:text-[44px]">Orders</h1>
      {orders.length === 0 ? (
        <div className="mt-6 border border-rule bg-sheet p-6">
          <div className="text-[18px] font-medium text-ink">No orders yet.</div>
          <p className="mt-1 text-[13.5px] text-ink-2">Orders placed in this browser appear here with their shipments and status.</p>
          <Button variant="primary" className="mt-4" onClick={() => go({ name: 'collection', slug: 'trending', filters: {} })}>See what is trending</Button>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto border border-rule">
          <table className="w-full min-w-[560px] border-collapse text-[13.5px]">
            <thead><tr className="bg-sheet text-left text-[12.5px] text-ink-3"><th className="px-4 py-2 font-normal">Order</th><th className="px-4 py-2 font-normal">Placed</th><th className="px-4 py-2 font-normal">Items</th><th className="px-4 py-2 font-normal">Status</th><th className="px-4 py-2 text-right font-normal">Total</th></tr></thead>
            <tbody>
              {orders.map((o) => { const st = orderStatus(o, now); return (
                <tr key={o.id} className="border-t border-rule bg-sheet hover:bg-paper">
                  <td className="px-4 py-2.5"><button type="button" onClick={() => go({ name: 'order', id: o.id })} className="reading text-ink underline decoration-rule-2 underline-offset-4 hover:decoration-ink">{o.id}</button></td>
                  <td className="px-4 py-2.5 text-ink-2">{when(o.placedAt)}</td>
                  <td className="px-4 py-2.5 text-ink-2">{o.lines.reduce((n, l) => n + l.qty, 0)}</td>
                  <td className={cn('px-4 py-2.5', TONE[st])}><span className={cn('mr-2 inline-block h-2 w-2', st === 'delivered' ? 'bg-pass' : st === 'placed' ? 'bg-rule-2' : 'bg-check')} aria-hidden />{LABEL[st]}</td>
                  <td className="reading px-4 py-2.5 text-right text-ink">{fmt(o.totals.total, o.totals.currency)}</td>
                </tr>
              ) })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Timeline({ order, index }: { order: Order; index: number }) {
  const now = useNow()
  const s = order.shipments[index]
  const { status, at } = shipmentStatus(order, s, now)
  const steps: OrderStatus[] = ['placed', 'packed', 'shipped', 'delivered']
  return (
    <ol className="grid grid-cols-4 gap-px bg-rule">
      {steps.map((k) => {
        const reached = at[k] !== null
        return (
          <li key={k} className="bg-sheet px-3 py-2">
            <div className={cn('flex items-center gap-2 text-[13px]', reached ? 'text-ink' : 'text-ink-3')}><span className={cn('h-2 w-2', reached ? (k === status ? 'bg-signal' : 'bg-ink') : 'border border-rule-2')} aria-hidden />{LABEL[k]}</div>
            <div className="reading mt-0.5 text-[11px] text-ink-3">{at[k] ? when(at[k]!) : 'pending'}</div>
          </li>
        )
      })}
    </ol>
  )
}

export function OrderPage({ id }: { id: string }) {
  const order = useStore((s) => s.orders.find((o) => o.id === id))
  const now = useNow()
  if (!order) return <NotFoundPage hash={`#/orders/${id}`} />
  const currency = order.totals.currency
  const st = orderStatus(order, now)
  return (
    <div className="mx-auto max-w-[1440px] px-4 pb-24 md:px-6 lg:pb-16">
      <Crumb label={order.id} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="display-md text-[34px] text-ink sm:text-[44px]">{order.id}</h1><p className="mt-1 text-[14.5px] text-ink-2">Placed {when(order.placedAt)}</p></div>
        <div className={cn('text-[14px] font-medium', TONE[st])}>{LABEL[st]}</div>
      </div>
      <div className="mt-6 grid grid-cols-12 gap-x-8 gap-y-6">
        <div className="col-span-12 space-y-4 lg:col-span-7">
          {order.shipments.map((s, i) => (
            <div key={s.origin} className="border border-rule bg-sheet">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rule px-4 py-2.5 text-[13.5px]">
                <span className="text-ink">Shipment {i + 1}: {originLabel({ route: s.origin === 'AU' ? 'warehouse' : 'supplier', origin: s.origin })}</span>
                <span className="reading text-ink-2">{s.etaDays[0]}–{s.etaDays[1]} days, {s.method}, {s.cost === 0 ? 'free' : fmt(s.cost, currency, { compact: true })}</span>
              </div>
              <div className="px-4 py-3"><Timeline order={order} index={i} /></div>
              <ul className="divide-y divide-rule border-t border-rule">
                {order.lines.filter((l) => s.lineKeys.includes(l.key)).map((l) => {
                  const p = products.find((x) => x.id === l.productId)
                  return (
                    <li key={l.key} className="flex items-center gap-3 px-4 py-2.5">
                      <div className="h-11 w-14 shrink-0 bg-paper">{p ? <ProductImage product={p} hue={l.hue} swatch={l.swatch} /> : null}</div>
                      <div className="min-w-0 flex-1"><div className="truncate text-[13.5px] text-ink">{l.brand} {l.name}</div><div className="truncate text-[12px] text-ink-3">{l.variantLabel}, {l.qty} × {fmt(l.unitPrice, currency, { compact: true })}</div></div>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
          <p className="text-[12px] text-ink-3">Status moves on its own in this prototype: packed after 2 minutes, shipped after 10, delivered after 30 or 60 depending on the lane.</p>
        </div>
        <aside className="col-span-12 lg:col-span-5">
          <div className="border border-ink bg-sheet">
            <div className="border-b border-rule px-4 py-2.5 text-[13.5px] text-ink">Receipt</div>
            <dl className="reading px-4 py-3 text-[12.5px] text-ink-2">
              <div className="flex justify-between py-0.5"><dt>Subtotal</dt><dd>{fmt(order.totals.subtotal, currency)}</dd></div>
              <div className="flex justify-between py-0.5"><dt>Shipping</dt><dd>{order.totals.shipping === 0 ? 'Free' : fmt(order.totals.shipping, currency)}</dd></div>
              <div className="flex justify-between py-0.5"><dt>{order.totals.taxLabel}</dt><dd>{fmt(order.totals.tax, currency)}</dd></div>
              <div className="mt-1 flex items-baseline justify-between border-t border-ink pt-2 text-ink"><dt className="font-sans text-[14px] font-medium">Total</dt><dd className="text-[18px]">{fmt(order.totals.total, currency)}</dd></div>
            </dl>
            <div className="border-t border-rule px-4 py-3 text-[12.5px] text-ink-2">
              <div className="text-ink">{order.address.name}</div>
              <div>{order.address.line1}{order.address.line2 ? `, ${order.address.line2}` : ''}</div>
              <div>{order.address.city} {order.address.region} {order.address.postcode}</div>
              <div>{COUNTRIES.find((c) => c.code === order.address.country)?.name}</div>
              <div className="mt-1 text-ink-3">{order.email}</div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
