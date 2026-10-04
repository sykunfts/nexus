/* Moving fastest this week: a four-cell bento at desktop (one tall bench tile, two small, one wide), a slab card plus a ledger on phones. One DOM for both, so each product is exactly one link. */
import type { MouseEvent } from 'react'
import { byId, TREND_NOTE, type Product } from '../../lib/data'
import { fmt } from '../../lib/currency'
import { formatRoute } from '../../lib/routes'
import { useStore } from '../../lib/store'
import { signedPct } from '../../lib/text'
import { cn } from '../../lib/cn'
import { ProductImage } from '../ProductVisual'
import { Tile } from '../ui'
import { MOVERS } from './rails'

function useOpen(id: string) {
  const go = useStore((s) => s.go)
  return { href: formatRoute({ name: 'product', id }), onClick: (e: MouseEvent) => { e.preventDefault(); go({ name: 'product', id }) } }
}

function Lead({ p }: { p: Product }) {
  const currency = useStore((s) => s.currency)
  const open = useOpen(p.id)
  return (
    <a {...open} className="slab lift flex h-full flex-col justify-between gap-4 p-5 lg:p-6">
      <span className="flex items-baseline justify-between gap-3">
        <span className="text-[19px] font-medium lg:text-[22px]">{p.brand} {p.name}</span>
        <Tile>{signedPct(p.trend.delta)}</Tile>
      </span>
      <span className="relative mx-auto block aspect-[4/3] w-full max-w-[420px]"><ProductImage product={p} className="absolute inset-0" /></span>
      <span className="flex items-baseline justify-between gap-4">
        <span className="line-clamp-2 min-w-0 text-[13.5px] text-rule lg:text-[14px]">{p.tagline}</span>
        <span className="numeral shrink-0 text-[19px] lg:text-[22px]">{fmt(p.price, currency, { compact: true })}</span>
      </span>
    </a>
  )
}

/* Small tiles are ledger rows on phones and cards at desktop; `wide` lays the card out landscape across two columns. */
function Cell({ p, tone, wide = false }: { p: Product; tone: 'sheet' | 'paper'; wide?: boolean }) {
  const currency = useStore((s) => s.currency)
  const open = useOpen(p.id)
  return (
    <a
      {...open}
      className={cn(
        'grid h-full grid-cols-[56px_1fr_auto] items-center gap-x-3.5 border-b border-rule px-1 py-3.5',
        'lg:lift lg:rounded-[2px] lg:border lg:p-5',
        tone === 'sheet' ? 'lg:bg-sheet' : 'lg:bg-paper-2',
        wide ? 'lg:grid-cols-[1fr_minmax(0,40%)] lg:grid-rows-[auto_1fr_auto] lg:gap-x-6 lg:px-6' : 'lg:grid-cols-1 lg:grid-rows-[auto_1fr_auto] lg:gap-y-3',
      )}
    >
      <span className={cn('relative block h-11 w-14 lg:h-full lg:min-h-0 lg:w-full', wide ? 'lg:col-start-2 lg:row-span-3 lg:row-start-1' : 'lg:order-2')}>
        <ProductImage product={p} className="absolute inset-0" />
      </span>
      <span className={cn('flex min-w-0 flex-col gap-0.5', wide ? 'lg:col-start-1 lg:row-start-1 lg:gap-2' : 'lg:order-1 lg:flex-row lg:items-baseline lg:justify-between lg:gap-3')}>
        <span className={cn('flex min-w-0 flex-col gap-0.5', wide && 'lg:flex-row lg:items-baseline lg:gap-3')}>
          <span className="truncate text-[16px] font-medium">{p.brand} {p.name}</span>
          <span className="numeral shrink-0 text-[12px] text-ink-2">{signedPct(p.trend.delta)}</span>
        </span>
        {wide && <span className="hidden max-w-[40ch] text-[14px] text-ink-2 lg:line-clamp-2">{p.tagline}</span>}
      </span>
      <span className={cn('numeral text-[16px] lg:text-[18px]', wide ? 'lg:col-start-1 lg:row-start-3' : 'lg:order-3')}>{fmt(p.price, currency, { compact: true })}</span>
    </a>
  )
}

export function Fastest() {
  const [lead, second, third, fourth] = MOVERS.map(byId)
  return (
    <section id="fastest" aria-labelledby="fastest-h">
      <h2 id="fastest-h" className="display text-[30px] text-ink lg:text-[40px]">Moving fastest this week</h2>
      <p className="mb-6 mt-2 max-w-[80ch] text-[13.5px] text-ink-2 lg:mb-7">{`Ranked by 7-day change in search and social interest. ${TREND_NOTE}`}</p>
      <ul className="grid grid-cols-1 lg:grid-cols-[2fr_1fr_1fr] lg:grid-rows-[360px_300px] lg:gap-4">
        <li className="mb-4 lg:row-span-2 lg:mb-0"><Lead p={lead} /></li>
        <li className="border-t border-ink lg:border-t-0"><Cell p={second} tone="sheet" /></li>
        <li><Cell p={third} tone="paper" /></li>
        <li className="lg:col-span-2"><Cell p={fourth} tone="sheet" wide /></li>
      </ul>
    </section>
  )
}
