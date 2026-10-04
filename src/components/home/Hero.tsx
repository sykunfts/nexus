/* The hero: one oversized headline across the page, then the pitch on the left and the product of the week on its bench slab. */
import { byId, priceCheckedText } from '../../lib/data'
import { fmt } from '../../lib/currency'
import { formatRoute } from '../../lib/routes'
import { useStore } from '../../lib/store'
import { ProductImage } from '../ProductVisual'
import { Callouts } from '../Callouts'
import { Button, Reveal, Tile } from '../ui'
import { HERO, HERO_LINE } from './rails'
import { signedPct } from '../../lib/text'

export function Hero() {
  const go = useStore((s) => s.go)
  const setAdvisor = useStore((s) => s.setAdvisor)
  const currency = useStore((s) => s.currency)
  const hero = byId(HERO)
  const open = () => go({ name: 'product', id: HERO })

  return (
    <section aria-labelledby="hero-h" className="pt-8 lg:pt-14">
      <Reveal>
        <h1 id="hero-h" className="display-xl max-w-[16ch] text-[50px] text-ink md:text-[72px] lg:max-w-none lg:text-[108px]">The new thing, before it&rsquo;s everywhere.</h1>
      </Reveal>

      <div className="mt-8 grid grid-cols-12 gap-x-8 gap-y-8 lg:mt-12">
        <Reveal delay={0.12} className="col-span-12 flex flex-col gap-8 lg:col-span-5 lg:pt-6">
          <p className="max-w-[40ch] text-[17px] leading-[1.5] text-ink-2 lg:text-[20px]">Trending tech, checked against the maker and against your setup, shipped from Sydney or straight from the maker.</p>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Button variant="primary" size="lg" onClick={open}>See the MoGo 4 Laser</Button>
            <Button variant="secondary" size="lg" onClick={() => setAdvisor(true)}>Ask the Trend Scout</Button>
          </div>
        </Reveal>

        <Reveal delay={0.2} className="relative z-[1] col-span-12 lg:col-span-7 lg:-mb-[88px]">
          <div className="slab -mx-4 flex min-h-[520px] flex-col rounded-none md:mx-0 md:rounded-[2px] lg:min-h-[620px]">
            <div className="flex items-baseline justify-between gap-3 px-4 pt-4 md:px-6 md:pt-5">
              <span className="text-[13.5px]">Product of the week</span>
              <span className="reading text-[12px] text-rule">Price checked {priceCheckedText(hero.priceCheckedAt)}</span>
            </div>
            <a
              href={formatRoute({ name: 'product', id: HERO })}
              onClick={(e) => { e.preventDefault(); open() }}
              aria-label={`Open the ${hero.brand} ${hero.name}`}
              className="relative mx-7 block min-h-[340px] flex-1 lg:mx-0 lg:min-h-[440px]"
            >
              <ProductImage product={hero} className="absolute inset-0" />
              <Callouts product={hero} />
            </a>
            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-on-mat/15 px-4 py-4 md:px-6 md:py-5">
              <div className="min-w-0">
                <div className="text-[20px] font-medium">{hero.brand} {hero.name}</div>
                <div className="mt-0.5 text-[13.5px] text-rule">{HERO_LINE}</div>
              </div>
              <div className="flex items-center gap-3.5">
                <Tile>{signedPct(hero.trend.delta)} this week</Tile>
                <span className="numeral text-[22px]">{fmt(hero.price, currency, { compact: true })}</span>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
