/* On the shelf in Sydney: a ledger of warehouse stock with delivery time, price and a one-tap Add. */
import { useState, type MouseEvent } from 'react'
import { byId } from '../../lib/data'
import { fmt } from '../../lib/currency'
import { formatRoute } from '../../lib/routes'
import { etaText } from '../../lib/shipping'
import { useStore, useZone } from '../../lib/store'
import { canBuy } from '../../lib/office'
import { ProductImage } from '../ProductVisual'
import { NotifyMe } from '../NotifyMe'
import { Button } from '../ui'
import { SHELF_IDS } from './rails'

export function Shelf() {
  const go = useStore((s) => s.go)
  const add = useStore((s) => s.add)
  const currency = useStore((s) => s.currency)
  const zone = useZone()
  const [alertFor, setAlertFor] = useState<string | null>(null)
  return (
    <section id="sydney" aria-labelledby="sydney-h">
      <h2 id="sydney-h" className="display mb-5 text-[30px] text-ink lg:text-[40px]">On the shelf in Sydney</h2>
      <ul className="border-t border-ink">
        {SHELF_IDS.map(byId).map((p) => {
          const eta = etaText(p.fulfil.origin, zone)
          const open = (e: MouseEvent) => { e.preventDefault(); go({ name: 'product', id: p.id }) }
          return (
            <li key={p.id} className="grid grid-cols-[1fr_auto] items-center gap-x-4 border-b border-rule px-1 py-[18px] transition-colors last:border-b-0 hover:bg-paper-2 lg:grid-cols-[72px_1fr_160px_120px_100px] lg:gap-x-6 lg:px-2">
              <span className="relative hidden h-12 w-16 lg:block"><ProductImage product={p} className="absolute inset-0" /></span>
              <span className="min-w-0">
                <a href={formatRoute({ name: 'product', id: p.id })} onClick={open} className="block text-[16px] font-medium text-ink hover:underline hover:decoration-signal hover:decoration-2 hover:underline-offset-4 lg:text-[17px]">{p.brand} {p.name}</a>
                <span className="mt-0.5 line-clamp-1 text-[13.5px] text-ink-3">{p.tagline}</span>
                <span className="mt-1.5 flex items-baseline gap-3 lg:hidden">
                  <span className="numeral text-[16px] text-ink lg:hidden">{fmt(p.price, currency, { compact: true })}</span>
                  <span className="numeral text-[12px] text-ink-2">{eta}</span>
                </span>
              </span>
              <span className="numeral hidden text-[14px] text-ink-2 lg:block">{eta}</span>
              <span className="numeral hidden lg:block text-right text-[17px] text-ink">{fmt(p.price, currency, { compact: true })}</span>
              {canBuy(p)
                ? <Button variant="secondary" size="md" className="!h-11 lg:!h-10" aria-label={`Add ${p.name} to cart`} onClick={() => add(p, p.variants[0].id)}>Add</Button>
                : <Button variant="secondary" size="md" className="!h-11 lg:!h-10" aria-expanded={alertFor === p.id} onClick={() => setAlertFor((a) => (a === p.id ? null : p.id))}>Tell me when</Button>}
              {alertFor === p.id && <div className="col-span-full pt-3 lg:col-start-2"><NotifyMe productId={p.id} /></div>}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
