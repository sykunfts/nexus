/* Works with your setup: the shopper's enabled gear as chips on the left, the works-with row on the right. */
import type { MouseEvent } from 'react'
import { byId, type GearKind } from '../../lib/data'
import { checkBuild, resolveFacts } from '../../lib/compat'
import { fmt } from '../../lib/currency'
import { formatRoute } from '../../lib/routes'
import { useSetup, useStore } from '../../lib/store'
import { cn } from '../../lib/cn'
import { ProductImage } from '../ProductVisual'
import { Button } from '../ui'
import { SETUP } from './rails'

const KIND_ORDER: GearKind[] = ['phone', 'hub', 'region', 'source', 'charger']
const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine']
const countWord = (n: number) => WORDS[n] ?? String(n)

export function SetupRow() {
  const go = useStore((s) => s.go)
  const currency = useStore((s) => s.currency)
  const gear = useStore((s) => s.gear)
  const gearOn = useStore((s) => s.gearOn)
  const owned = useSetup()
  const chips = gear.filter((g) => gearOn[g.id]).sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind))
  const n = chips.length
  const toSetup = () => go({ name: 'setup' })

  return (
    <section id="setup" aria-labelledby="setup-h" className="grid grid-cols-12 items-start gap-x-8 gap-y-6">
      <div className="col-span-12 flex flex-col gap-4 rounded-[2px] border border-ink bg-sheet p-6 lg:col-span-4">
        <span className="text-[14px] text-ink-2">Your setup</span>
        {n > 0 ? (
          <>
            <ul className="flex flex-wrap gap-2" aria-label="Your setup">
              {chips.map((g) => <li key={g.id} className="rounded-[2px] bg-paper-2 px-3 py-2 text-[14px] text-ink">{g.name}</li>)}
            </ul>
            <p className="text-[15px] leading-[1.5] text-ink-2">Every product page checks itself against {n === 1 ? 'this one' : `these ${countWord(n)}`} before you pay.</p>
            <a href={formatRoute({ name: 'setup' })} onClick={(e) => { e.preventDefault(); toSetup() }} className="self-start text-[15px] text-ink underline decoration-rule-2 underline-offset-4 hover:decoration-ink">Edit setup</a>
          </>
        ) : (
          <>
            <p className="text-[15px] leading-[1.5] text-ink-2">Add your phone, hub and plug once. Every product page then checks itself.</p>
            <Button variant="secondary" size="md" className="self-start" onClick={toSetup}>Set up in two minutes</Button>
          </>
        )}
      </div>

      <div className="col-span-12 min-w-0 lg:col-span-8">
        <h2 id="setup-h" className="display mb-6 text-[30px] text-ink lg:text-[40px]">{SETUP.title}</h2>
        <ul className="scrollbar-none -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 pt-1 md:mx-0 md:px-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:pb-0">
          {SETUP.ids.map(byId).map((p) => {
            const compat = checkBuild({ name: p.name, facts: resolveFacts(p, {}), product: p }, owned)
            const open = (e: MouseEvent) => { e.preventDefault(); go({ name: 'product', id: p.id }) }
            return (
              <li key={p.id} className="w-[236px] shrink-0 snap-start lg:w-auto lg:min-w-0">
                <a href={formatRoute({ name: 'product', id: p.id })} onClick={open} className="lift flex h-full flex-col gap-3 rounded-[2px] border border-rule bg-sheet p-[18px]">
                  <span className="relative block aspect-[4/3] w-full"><ProductImage product={p} className="absolute inset-0" /></span>
                  <span className="text-[15px] font-medium text-ink">{p.brand} {p.name}</span>
                  <span className="mt-auto flex items-baseline justify-between gap-3">
                    {n > 0 && (
                      <span className={cn('text-[13px]', compat.status === 'ok' ? 'text-pass' : compat.status === 'warn' ? 'text-check' : 'text-fail')}>
                        {compat.status === 'ok' ? `Works with all ${owned.length}` : compat.summary}
                      </span>
                    )}
                    <span className="numeral ml-auto text-[15px] text-ink">{fmt(p.price, currency, { compact: true })}</span>
                  </span>
                </a>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
