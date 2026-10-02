import { byId, nav, products, trendTape } from '../lib/data'
import { fmt } from '../lib/currency'
import { useStore } from '../lib/store'
import { ProductVisual } from './ProductVisual'
import { ProductCard } from './ProductCard'
import { FlipBoard } from './FlipBoard'
import { Button, Tile } from './ui'

/* Rails: slot order + reasons come from the edge; cards are cached per SKU. */
const RAILS = [
  { id: 'viral', title: 'Moving fastest this week', reason: 'Ranked by 7-day change in search and social interest', ids: ['luma-mask', 'echo-pin', 'loop-ring', 'specs-air'] },
  { id: 'setup', title: 'Works with your iPhone and Apple Home', reason: 'Filtered by the works-with check against your setup', ids: ['beam-4k', 'aether-magpack', 'nimbus-orbit', 'snap-tag'] },
  { id: 'fast', title: 'On the shelf in Sydney', reason: 'Ships in 2 to 4 days', ids: ['drift-one', 'nimbus-robo', 'halo-screen', 'aether-cube-100'] },
]

/* Bench results for the product of the week: what the maker claims vs what we measured. */
const BENCH: { metric: string; claimed: string; measured: string; verdict: 'pass' | 'check' }[] = [
  { metric: 'Brightness', claimed: '1,200 lm', measured: '1,140 lm', verdict: 'pass' },
  { metric: 'Battery, 4K film', claimed: '2.5 h', measured: '2 h 36 m', verdict: 'pass' },
  { metric: 'Fan noise at 1 m', claimed: '26 dB', measured: '27 dB', verdict: 'pass' },
  { metric: 'Boot to picture', claimed: '', measured: '9 s', verdict: 'pass' },
  { metric: 'Autofocus settle', claimed: '2 s', measured: '2.4 s', verdict: 'check' },
  { metric: 'Returns, first 200 units', claimed: '', measured: '1.9 %', verdict: 'pass' },
]

function TestCard() {
  const go = useStore((s) => s.go)
  const currency = useStore((s) => s.currency)
  const hero = byId('beam-4k')
  return (
    <div className="border border-ink bg-sheet">
      <div className="flex items-baseline justify-between gap-3 border-b border-rule px-4 py-2.5">
        <span className="text-[13.5px] text-ink">Product of the week</span>
        <span className="reading text-[11.5px] text-ink-3">Tested 24 to 30 Sep, Sydney bench</span>
      </div>

      {/* bench mat with dimension lines */}
      <button type="button" onClick={() => go({ name: 'pdp', id: hero.id })} className="relative block w-full bg-mat" aria-label="Open the Halo Beam 4K">
        <div className="relative mx-auto aspect-[4/3] w-full max-w-[560px]">
          <ProductVisual visual="projector" hue={hero.hue} glow={false} className="absolute inset-0" />
          <svg viewBox="0 0 400 300" className="absolute inset-0 h-full w-full" aria-hidden="true">
            <g className="dim-line" fill="none">
              <path d="M76 254 V262 M324 254 V262 M76 258 H324" />
              <path d="M338 118 H346 M338 230 H346 M342 118 V230" />
            </g>
            <g fontFamily="Martian Mono, monospace" fontSize="11" fontWeight="500" fill="#121820">
              <rect x="172" y="266" width="56" height="18" fill="#ff4a1f" />
              <text x="200" y="279" textAnchor="middle">240 mm</text>
              <rect x="350" y="165" width="48" height="18" fill="#ff4a1f" />
              <text x="374" y="178" textAnchor="middle">118 mm</text>
              <rect x="14" y="14" width="50" height="18" fill="#ff4a1f" />
              <text x="39" y="27" textAnchor="middle">1.1 kg</text>
            </g>
          </svg>
        </div>
      </button>

      {/* claimed vs measured */}
      <table className="w-full border-collapse text-[13.5px]">
        <thead>
          <tr className="border-b border-rule text-left text-[12.5px] text-ink-3">
            <th className="px-4 py-2 font-normal">Measure</th>
            <th className="px-4 py-2 text-right font-normal">Claimed</th>
            <th className="px-4 py-2 text-right font-normal">On our bench</th>
          </tr>
        </thead>
        <tbody>
          {BENCH.map((r) => (
            <tr key={r.metric} className="border-b border-rule last:border-b-0">
              <td className="px-4 py-2 text-ink">{r.metric}</td>
              <td className="reading px-4 py-2 text-right text-[12.5px] text-ink-3">{r.claimed || '—'}</td>
              <td className="px-4 py-2 text-right">
                <span className="reading text-[12.5px] text-ink">{r.measured}</span>
                <span className={`ml-2 inline-block h-2 w-2 align-middle ${r.verdict === 'pass' ? 'bg-pass' : 'bg-check'}`} aria-label={r.verdict === 'pass' ? 'passed' : 'needs a note'} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink px-4 py-3">
        <div>
          <div className="text-[16px] font-medium text-ink">{hero.brand} {hero.name}</div>
          <div className="text-[12.5px] text-ink-2">Triple-laser 4K projector, 100 in from 2.6 m</div>
        </div>
        <div className="flex items-center gap-3">
          <Tile>+{hero.trend.delta}% this week</Tile>
          <span className="reading text-[15px] text-ink">{fmt(hero.price, currency, { compact: true })}</span>
          <Button variant="primary" size="sm" onClick={() => go({ name: 'pdp', id: hero.id })}>Configure</Button>
        </div>
      </div>
    </div>
  )
}

export function Home() {
  const go = useStore((s) => s.go)
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
              We watch what is taking off, run it on the bench for a week, and ship what passes from Sydney or straight from the maker. Every product is checked against your phone, your home and your plug before you pay.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button variant="primary" size="lg" onClick={() => go({ name: 'pdp', id: 'beam-4k' })}>See the Beam 4K</Button>
              <Button variant="secondary" size="lg" onClick={() => setAdvisor(true)}>Ask the Trend Scout</Button>
            </div>
          </div>
          <dl className="mt-12 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-rule pt-5 text-[13.5px] sm:grid-cols-4">
            {[
              ['2 to 4 days', 'Sydney stock, tracked'],
              ['8 to 12 days', 'Supplier direct, priced lower'],
              ['7 days', 'On our bench before listing'],
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
          <span className="text-[13px] text-ink-3">7-day change in interest, search and social combined, refreshed hourly</span>
        </div>
        <FlipBoard items={trendTape.slice(0, 6)} />
      </section>

      {/* ---------- categories ---------- */}
      <section className="pb-4" aria-label="Categories">
        <div className="scrollbar-none -mx-4 flex gap-px overflow-x-auto border-y border-rule bg-rule px-0 md:mx-0 md:grid md:grid-cols-7 md:border-x">
          {nav.map((s) => {
            const f = byId(s.featured)
            return (
              <button key={s.id} type="button" onClick={() => go({ name: 'pdp', id: f.id })} className="flex min-w-[150px] items-center gap-3 bg-paper px-4 py-3 text-left hover:bg-paper-2">
                <div className="h-10 w-12 shrink-0"><ProductVisual visual={f.visual} hue={f.hue} glow={false} /></div>
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
          ['Does it work with my phone?', 'Add your phone, hub and plug once. Every page checks itself.', 'snap-tag'],
          ['Movie night under $1,000', 'Projector, screen and power, checked as a set and shipped together.', 'beam-4k'],
          ['How we choose what to stock', 'Velocity gets a product onto the bench. A week of testing and a return rate under 3 % get it onto the shelf.', 'luma-mask'],
        ].map(([t, s, id]) => (
          <button key={t} type="button" onClick={() => go({ name: 'pdp', id })} className="flex gap-4 bg-paper p-5 text-left hover:bg-paper-2">
            <div className="min-w-0 flex-1">
              <div className="text-[18px] font-medium leading-tight text-ink">{t}</div>
              <p className="mt-1.5 text-[13.5px] text-ink-2">{s}</p>
            </div>
            <div className="w-20 shrink-0 self-center"><ProductVisual visual={byId(id).visual} hue={byId(id).hue} glow={false} /></div>
          </button>
        ))}
      </section>
      <p className="mt-6 text-[12px] text-ink-3">{products.length} sample products shown. Prices are examples in {currency}; tax and shipping are estimated in the cart. Trend figures and bench results are illustrative.</p>
    </div>
  )
}
