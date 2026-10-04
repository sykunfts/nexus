/* How we choose what to list, with the two guides people ask for first. */
import type { MouseEvent } from 'react'
import { byId } from '../../lib/data'
import { formatRoute, type Route } from '../../lib/routes'
import { useStore } from '../../lib/store'
import { ProductImage } from '../ProductVisual'
import { HERO } from './rails'

const ROWS: { title: string; line: string; route: Route; product: string }[] = [
  { title: 'Does it work with my phone?', line: 'Add your phone, hub and plug once. Every page checks itself.', route: { name: 'guide', slug: 'works-with-my-phone' }, product: 'chipolo-pop' },
  { title: 'Movie night under $2,000', line: 'Projector, screen and charger, checked as a set and shipped together.', route: { name: 'guide', slug: 'movie-night' }, product: HERO },
]

export function Guides() {
  const go = useStore((s) => s.go)
  const link = (route: Route) => ({ href: formatRoute(route), onClick: (e: MouseEvent) => { e.preventDefault(); go(route) } })
  return (
    <section id="guides" aria-labelledby="guides-h" className="grid grid-cols-12 items-start gap-x-8 gap-y-8">
      <div className="col-span-12 flex flex-col gap-5 lg:col-span-7 lg:pr-12">
        <h2 id="guides-h" className="display text-[36px] text-ink lg:text-[48px]">How we choose what to list</h2>
        <p className="max-w-[46ch] text-[17px] leading-[1.5] text-ink-2 lg:text-[18px]">Velocity gets a product onto the list. Verified specs, a checked price and a works-with record keep it there.</p>
        <a {...link({ name: 'how-we-pick' })} className="self-start text-[16px] text-ink underline decoration-rule-2 underline-offset-[5px] hover:decoration-ink">Read how we pick</a>
      </div>
      <ul className="col-span-12 border-t border-ink lg:col-span-5">
        {ROWS.map((r) => (
          <li key={r.title} className="border-b border-rule last:border-b-0">
            <a {...link(r.route)} className="grid grid-cols-[1fr_72px] items-center gap-5 px-2 py-5 transition-colors hover:bg-paper-2">
              <span>
                <span className="block text-[18px] font-medium text-ink lg:text-[19px]">{r.title}</span>
                <span className="mt-1 block text-[14px] text-ink-2">{r.line}</span>
              </span>
              <span className="relative block h-14 w-16"><ProductImage product={byId(r.product)} className="absolute inset-0" /></span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}
