/* Order confirmation: number, shipments with ETAs, the works-with summary, and a way to grow My setup. */
import { byId, products } from '../lib/data'
import { fmt } from '../lib/currency'
import { COUNTRIES, originLabel } from '../lib/shipping'
import { useStore } from '../lib/store'
import { ProductImage } from '../components/ProductVisual'
import { Button } from '../components/ui'
import { NotFoundPage } from './NotFoundPage'
import { cn } from '../lib/cn'

export function ConfirmedPage({ id }: { id: string }) {
  const order = useStore((s) => s.orders.find((o) => o.id === id))
  const go = useStore((s) => s.go)
  const addGear = useStore((s) => s.addGear)
  const gear = useStore((s) => s.gear)
  if (!order) return <NotFoundPage hash={`#/orders/${id}/confirmed`} />
  const currency = order.totals.currency
  const addable = order.lines.map((l) => products.find((p) => p.id === l.productId)).filter((p): p is NonNullable<typeof p> => !!p && (!!p.facts.hubs || !!p.facts.pdOut)).filter((p) => !gear.some((g) => g.deviceId === p.id))

  return (
    <div className="mx-auto max-w-[1440px] px-4 pb-24 md:px-6 lg:pb-16">
      <div className="grid grid-cols-12 gap-x-8 gap-y-6 py-10">
        <div className="col-span-12 lg:col-span-7">
          <div className="reading text-[12px] text-ink-3">Order {order.id}</div>
          <h1 className="display-md mt-2 text-[34px] text-ink sm:text-[44px]">Thanks, it is on its way.</h1>
          <p className="mt-2 text-[15px] text-ink-2">A confirmation would go to {order.email}. Nothing was charged: this is a prototype.</p>

          <div className="mt-6 space-y-3">
            {order.shipments.map((s, i) => (
              <div key={s.origin} className="border border-rule bg-sheet">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rule px-4 py-2.5 text-[13.5px]">
                  <span className="text-ink">Shipment {i + 1} of {order.shipments.length}: {originLabel({ route: s.origin === 'AU' ? 'warehouse' : 'supplier', origin: s.origin })}</span>
                  <span className="reading text-ink-2">{s.etaDays[0]}–{s.etaDays[1]} days, {s.method}</span>
                </div>
                <ul className="divide-y divide-rule">
                  {order.lines.filter((l) => s.lineKeys.includes(l.key)).map((l) => (
                    <li key={l.key} className="flex items-center gap-3 px-4 py-2.5">
                      <div className="h-11 w-14 shrink-0 bg-paper"><ProductImage product={products.find((p) => p.id === l.productId) ?? byId('xgimi-mogo-4-laser')} hue={l.hue} swatch={l.swatch} /></div>
                      <div className="min-w-0 flex-1"><div className="truncate text-[13.5px] text-ink">{l.brand} {l.name}</div><div className="truncate text-[12px] text-ink-3">{l.variantLabel}, {l.qty} × {fmt(l.unitPrice, currency, { compact: true })}</div></div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className={cn('mt-4 flex items-start gap-3 border px-3 py-2.5 text-[13px]', order.compat.status === 'ok' ? 'border-pass bg-pass-tint text-pass' : order.compat.status === 'warn' ? 'border-check bg-check-tint text-check' : 'border-fail bg-fail-tint text-fail')}>
            <span className={cn('mt-1 h-2 w-2 shrink-0', order.compat.status === 'ok' ? 'bg-pass' : order.compat.status === 'warn' ? 'bg-check' : 'bg-fail')} aria-hidden />
            <div>
              <div className="font-medium">{order.compat.status === 'ok' ? 'Everything in this order works with your setup' : 'Things to know about this order'}</div>
              {order.compat.issues.length > 0 && <ul className="mt-1 list-disc pl-4 text-ink-2">{order.compat.issues.map((t) => <li key={t}>{t}</li>)}</ul>}
            </div>
          </div>

          {addable.length > 0 && (
            <div className="mt-4 border border-rule bg-sheet px-4 py-3">
              <div className="text-[13.5px] text-ink">Add what you just bought to My setup, so the next check knows about it.</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {addable.map((p) => (
                  <Button key={p.id} size="sm" variant="secondary" onClick={() => addGear({ id: `d-${p.id}`, kind: p.facts.hubs ? 'hub' : 'charger', name: `${p.brand} ${p.name}`, detail: p.facts.hubs ? 'From your order' : `${p.facts.pdOut} W, from your order`, facts: p.facts.hubs ? { hubs: p.facts.hubs } : { pdOut: p.facts.pdOut }, defaultOn: true, deviceId: p.id })}>Add {p.brand} {p.name}</Button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            <Button variant="primary" onClick={() => go({ name: 'order', id: order.id })}>Track this order</Button>
            <Button variant="secondary" onClick={() => go({ name: 'home' })}>Keep browsing</Button>
          </div>
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
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
