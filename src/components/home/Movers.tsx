/* Category movers on a full-bleed paper band: the flip board, with the note on where the figures come from. */
import { trendTape } from '../../lib/data'
import { FlipBoard } from '../FlipBoard'
import { MOVERS_NOTE } from './rails'

export function Movers() {
  return (
    <section id="movers" aria-labelledby="movers-h" className="-mx-4 bg-paper-2 px-4 py-8 md:-mx-6 md:px-6 lg:py-10">
      <div className="grid grid-cols-12 items-center gap-x-8 gap-y-4">
        <div className="col-span-12 lg:col-span-3">
          <h2 id="movers-h" className="text-[20px] font-medium tracking-[-0.02em] text-ink lg:text-[24px]">Movers this week</h2>
          <p className="mt-1.5 text-[13.5px] text-ink-2">{MOVERS_NOTE}</p>
        </div>
        <div className="col-span-12 min-w-0 lg:col-span-9">
          <FlipBoard items={trendTape.slice(0, 6)} />
        </div>
      </div>
    </section>
  )
}
