import { byId, nav, PRICE_CHECKED, priceCheckedText, products, TREND_NOTE, trendTape } from '../lib/data'
import { TRENDS_GENERATED_AT } from '../lib/trends.generated'
import { fmt } from '../lib/currency'
import { etaText } from '../lib/shipping'
import { useStore, useZone } from '../lib/store'
import { ProductImage } from './ProductVisual'
import { ProductCard } from './ProductCard'
import { FlipBoard } from './FlipBoard'
import { Button, Tile } from './ui'
import { navTarget } from '../lib/collections'

const HERO = 'xgimi-mogo-4-laser'
const LATEST_CHECK = products.map((p) => p.priceCheckedAt).sort().slice(-1)[0] ?? PRICE_CHECKED

/* Rails: slot order + reasons come from the edge; cards are cached per SKU. */
/* With real trend data the fastest movers are computed; before that, a hand-picked sample set. */
const MOVERS = TRENDS_GENERATED_AT
  ? [...products].sort((a, b) => b.trend.delta - a.trend.delta).slice(0, 4).map((p) => p.id)
  : ['omnilux-contour-face', 'plaud-notepin-s', 'ringconn-gen-3', 'rayban-meta-gen-3']
const RAILS = [
  { id: 'viral', title: 'Moving fastest this week', reason: `Ranked by 7-day change in search and social interest. ${TREND_NOTE}`, ids: MOVERS },
  { id: 'setup', title: 'Works with your iPhone and Apple Home', reason: 'Filtered by the works-with check against your setup', ids: ['xgimi-mogo-4-laser', 'anker-maggo-10k', 'aqara-camera-e1', 'chipolo-pop'] },
  { id: 'fast', title: 'On the shelf in Sydney', reason: 'Sydney stock, tracked', ids: ['segway-e3-pro', 'eufy-x10-pro-omni', 'elite-yard-master-2-100', 'anker-prime-100w'] },
]

/*
  Independent tests for the product of the week: what the maker claims against what reviewers measured.
  Every row links to the review that measured it. Rows nobody measured are left out, not invented.
  Replaced by NEXUS bench results once a unit has been through the Sydney bench.
*/
const TESTS: { metric: string; claimed: string; measured: string; by: string; url: string; verdict: 'pass' | 'check' }[] = [
  { metric: 'Brightness, standard mode', claimed: '550 ISO lm', measured: '370 to 390 ANSI lm', by: 'laurentwillen.com', url: 'https://www.laurentwillen.com/en/test-reviews/projectors-tests-reviews/xgimi-mogo-4-laser-test-review/', verdict: 'check' },
  { metric: 'Battery, full brightness', claimed: '', measured: '92 min', by: 'gamerevolution.com', url: 'https://www.gamerevolution.com/review/981910-xgimi-mogo-4-laser-review-projector-worth-buying', verdict: 'check' },
  { metric: 'Battery, standard mode', claimed: '2.5 h in Eco', measured: '1 h 53 min', by: 'expertreviews.co.uk', url: 'https://www.expertreviews.co.uk/technology/tvs-home-cinema/xgimi-mogo-4-laser-review', verdict: 'check' },
  { metric: 'Input lag', claimed: '', measured: '40 ms', by: 'laurentwillen.com', url: 'https://www.laurentwillen.com/en/test-reviews/projectors-tests-reviews/xgimi-mogo-4-laser-test-review/', verdict: 'pass' },
  { metric: 'Boot to home screen', claimed: '', measured: '51 s', by: 'newedgetimes.com', url: 'https://www.newedgetimes.com/xgimi-mogo-4-laser-review/', verdict: 'check' },
  { metric: 'Fan noise, close up', claimed: '≤ 28 dB at 1 m', measured: 'under 40 dB', by: 'laurentwillen.com', url: 'https://www.laurentwillen.com/en/test-reviews/projectors-tests-reviews/xgimi-mogo-4-laser-test-review/', verdict: 'check' },
]

function TestCard() {
  const go = useStore((s) => s.go)
  const currency = useStore((s) => s.currency)
  const hero = byId(HERO)
  return (
    <div className="border border-ink bg-sheet">
      <div className="flex items-baseline justify-between gap-3 border-b border-rule px-4 py-2.5">
        <span className="text-[13.5px] text-ink">Product of the week</span>
        <span className="reading text-[11.5px] text-ink-3">Price checked {priceCheckedText(hero.priceCheckedAt)}</span>
      </div>

      {/* bench mat with dimension lines */}
      <button type="button" onClick={() => go({ name: 'product', id: hero.id })} className="relative block w-full bg-mat" aria-label={`Open the ${hero.brand} ${hero.name}`}>
        <div className="relative mx-auto aspect-[4/3] w-full max-w-[560px]">
          <ProductImage product={hero} className="absolute inset-0" />
          {!hero.photos?.length && (
            <svg viewBox="0 0 400 300" className="absolute inset-0 h-full w-full" aria-hidden="true">
              <g className="dim-line" fill="none">
                <path d="M146 262 V270 M254 262 V270 M146 266 H254" />
                <path d="M270 46 H278 M270 250 H278 M274 46 V250" />
              </g>
              <g fontFamily="Martian Mono, monospace" fontSize="11" fontWeight="500" fill="#121820">
                <rect x="170" y="274" width="60" height="18" fill="#ff4a1f" />
                <text x="200" y="287" textAnchor="middle">96.5 mm</text>
                <rect x="284" y="139" width="66" height="18" fill="#ff4a1f" />
                <text x="317" y="152" textAnchor="middle">207.6 mm</text>
                <rect x="14" y="14" width="56" height="18" fill="#ff4a1f" />
                <text x="42" y="27" textAnchor="middle">1.32 kg</text>
              </g>
            </svg>
          )}
        </div>
      </button>

      {/* claimed vs independently measured */}
      <table className="w-full border-collapse text-[13.5px]">
        <thead>
          <tr className="border-b border-rule text-left text-[12.5px] text-ink-3">
            <th className="px-4 py-2 font-normal">Measure</th>
            <th className="px-4 py-2 text-right font-normal">Claimed</th>
            <th className="px-4 py-2 text-right font-normal">Independent tests</th>
          </tr>
        </thead>
        <tbody>
          {TESTS.map((r) => (
            <tr key={r.metric} className="border-b border-rule last:border-b-0">
              <td className="px-4 py-2 text-ink">{r.metric}</td>
              <td className="reading px-4 py-2 text-right text-[12.5px] text-ink-3">{r.claimed || '—'}</td>
              <td className="px-4 py-2 text-right">
                <a href={r.url} target="_blank" rel="noreferrer" className="reading text-[12.5px] text-ink underline decoration-rule-2 underline-offset-4 hover:decoration-ink" title={`Measured by ${r.by}`}>{r.measured}</a>
                <span className={`ml-2 inline-block h-2 w-2 align-middle ${r.verdict === 'pass' ? 'bg-pass' : 'bg-check'}`} aria-label={r.verdict === 'pass' ? 'matches the claim' : 'short of the claim'} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="border-b border-rule px-4 py-2 text-[11.5px] text-ink-3">
        Measured by {[...new Set(TESTS.map((t) => t.by))].join(', ')}. Replaced by NEXUS bench results once a unit has been through the Sydney bench.
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink px-4 py-3">
        <div>
          <div className="text-[16px] font-medium text-ink">{hero.brand} {hero.name}</div>
          <div className="text-[12.5px] text-ink-2">Triple-laser 1080p projector, Google TV, 2.5 h battery</div>
        </div>
        <div className="flex items-center gap-3">
          <Tile>+{hero.trend.delta}% this week</Tile>
          <span className="reading text-[15px] text-ink">{fmt(hero.price, currency, { compact: true })}</span>
          <Button variant="primary" size="sm" onClick={() => go({ name: 'product', id: hero.id })}>Configure</Button>
        </div>
      </div>
    </div>
  )
}

export function Home() {
  const go = useStore((s) => s.go)
  const zone = useZone()
  const setAdvisor = useStore((s) => s.setAdvisor)
  const currency = useStore((s) => s.currency)

  return (
    <div className="mx-auto max-w-[1440px] px-4 pb-24 md:px-6 lg:pb-16">
      {/* ---------- hero ---------- */}
      <section className="grid grid-cols-12 gap-x-8 gap-y-8 border-b border-rule py-10 lg:py-14">
        <div className="col-span-12 lg:col-span-6">
          <div>
            <h1 className="display max-w-[11ch] text-[52px] text-ink sm:text-[72px] lg:text-[88px]">The new thing, before it&rsquo;s everywhere.</h1>
            <p className="mt-6 max-w-[52ch] text-[17px] leading-[1.5] text-ink-2">
              We watch what is taking off, check the specs and the price against the maker and the big Australian retailers, and ship what is worth it from Sydney or straight from the maker. Every product is checked against your phone, your home and your plug before you pay.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button variant="primary" size="lg" onClick={() => go({ name: 'product', id: HERO })}>See the MoGo 4 Laser</Button>
              <Button variant="secondary" size="lg" onClick={() => setAdvisor(true)}>Ask the Trend Scout</Button>
            </div>
          </div>
          <dl className="mt-12 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-rule pt-5 text-[13.5px] sm:grid-cols-4">
            {[
              [etaText('AU', zone), 'Sydney stock, tracked'],
              [etaText('CN', zone), 'Supplier direct from China, priced lower'],
              [`${products.length} products`, `Real, sold today, prices checked ${priceCheckedText(LATEST_CHECK)}`],
              ['30 days', 'Returns on both routes'],
            ].map(([v, l]) => (
              <div key={l}>
                <dt className="reading text-[15px] text-ink">{v}</dt>
                <dd className="text-ink-2">{l}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="col-span-12 lg:col-span-6">
          <TestCard />
        </div>
      </section>

      {/* ---------- movers ---------- */}
      <section className="py-8" aria-labelledby="movers">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="movers" className="text-[18px] font-medium text-ink">Movers this week</h2>
          <span className="text-[13px] text-ink-3">7-day change in interest, search and social combined. Sample data until the trend worker runs.</span>
        </div>
        <FlipBoard items={trendTape.slice(0, 6)} />
      </section>

      {/* ---------- categories ---------- */}
      <section className="pb-4" aria-label="Categories">
        <div className="scrollbar-none -mx-4 flex gap-px overflow-x-auto border-y border-rule bg-rule px-0 md:mx-0 md:grid md:grid-cols-7 md:border-x">
          {nav.map((s) => {
            const f = byId(s.featured)
            return (
              <button key={s.id} type="button" onClick={() => go(navTarget(s.label))} className="flex min-w-[150px] items-center gap-3 bg-paper px-4 py-3 text-left hover:bg-paper-2">
                <div className="h-10 w-12 shrink-0"><ProductImage product={f} /></div>
                <div className="min-w-0">
                  <div className="text-[14px] text-ink">{s.label}</div>
                  <div className="truncate text-[12px] text-ink-3">{s.columns[0].items.slice(0, 2).join(', ')}</div>
                </div>
              </button>
            )
          })}
        </div>
      </section>

      {/* ---------- rails ---------- */}
      {RAILS.map((rail, ri) => (
        <section key={rail.id} className="mt-12" aria-labelledby={`rail-${rail.id}`}>
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 id={`rail-${rail.id}`} className="display-md text-[26px] text-ink sm:text-[30px]">{rail.title}</h2>
            <span className="text-[13px] text-ink-3">{rail.reason}</span>
          </div>
          <div className="scrollbar-none -mx-4 flex gap-px overflow-x-auto border-y border-rule bg-rule md:mx-0 md:grid md:grid-cols-4 md:overflow-visible md:border-x">
            {rail.ids.map((id, i) => (
              <div key={id} className="min-w-[270px] md:min-w-0">
                <ProductCard product={byId(id)} index={i + ri} />
              </div>
            ))}
          </div>
        </section>
      ))}

      {/* ---------- guides ---------- */}
      <section className="mt-14 sheet-grid md:grid-cols-3">
        {[
          ['Does it work with my phone?', 'Add your phone, hub and plug once. Every page checks itself.', 'chipolo-pop'],
          ['Movie night under $2,000', 'Projector, screen and charger, checked as a set and shipped together.', HERO],
          ['How we choose what to list', 'Velocity gets a product onto the list. Verified specs, a checked price and a works-with record keep it there.', 'omnilux-contour-face'],
        ].map(([t, s, id]) => (
          <button key={t} type="button" onClick={() => go({ name: 'product', id })} className="flex gap-4 bg-paper p-5 text-left hover:bg-paper-2">
            <div className="min-w-0 flex-1">
              <div className="text-[18px] font-medium leading-tight text-ink">{t}</div>
              <p className="mt-1.5 text-[13.5px] text-ink-2">{s}</p>
            </div>
            <div className="w-20 shrink-0 self-center"><ProductImage product={byId(id)} /></div>
          </button>
        ))}
      </section>
      <p className="mt-6 text-[12px] text-ink-3">{products.length} real products. Prices are AUD including GST, checked {priceCheckedText(PRICE_CHECKED)} to {priceCheckedText(LATEST_CHECK)} at the sources listed on each product page, shown in {currency}; shipping is estimated in the cart. {TREND_NOTE}</p>
    </div>
  )
}
