import { lazy, Suspense, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check } from 'lucide-react'
import { byId, priceCheckedText, Product, products } from '../lib/data'
import { fmt } from '../lib/currency'
import { defaultSelection, priceFor, useSetup, useStore, useZone } from '../lib/store'
import { checkBuild, CompatResult, resolveFacts } from '../lib/compat'
import { isLightSwatch, ProductImage } from './ProductVisual'
import { ProductCard, Sparkline } from './ProductCard'
import { Button, Chip, Reveal, Row, Stars, StockDot, Tile, Toggle } from './ui'
import { Callouts } from './Callouts'
import { BenchResults } from './BenchResults'
import { benchFor } from '../lib/bench'
import { signedPct } from '../lib/text'
import { PARTS, CanvasMode } from '../lib/parts'
import { cn } from '../lib/cn'
import { etaText, originLabel, originShort } from '../lib/shipping'
import { canBuy } from '../lib/office'
import { NOTIFY_INPUT_ID, NotifyMe } from './NotifyMe'

const ProductCanvas = lazy(() => import('./ProductCanvas').then((m) => ({ default: m.ProductCanvas })))

type Tab = 'overview' | 'specs' | 'compat' | 'reviews'

const HERO = 'xgimi-mogo-4-laser'

const STATE = {
  ok: { mark: 'bg-pass', text: 'text-pass', tint: 'bg-pass-tint', label: 'Works with your setup' },
  warn: { mark: 'bg-check', text: 'text-check', tint: 'bg-check-tint', label: 'Needs attention' },
  bad: { mark: 'bg-fail', text: 'text-fail', tint: 'bg-fail-tint', label: 'Does not work with your setup' },
}

export function ProductPage({ product }: { product: Product }) {
  const [variantId, setVariantId] = useState(product.variants[0].id)
  const [selection, setSelection] = useState<Record<string, string>>(defaultSelection(product))
  const [mode, setMode] = useState<CanvasMode | 'gallery'>(product.id === HERO ? '360' : 'gallery')
  const [photo, setPhoto] = useState(0)
  const [hovered, setHovered] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('overview')
  const [compareWith, setCompareWith] = useState<string | null>(products.find((p) => p.id !== product.id && p.category === product.category)?.id ?? null)
  const [added, setAdded] = useState(false)

  const currency = useStore((s) => s.currency)
  const add = useStore((s) => s.add)
  const go = useStore((s) => s.go)
  const gear = useStore((s) => s.gear)
  const gearOn = useStore((s) => s.gearOn)
  const owned = useSetup()
  const toggleGear = useStore((s) => s.toggleGear)
  const cart = useStore((s) => s.cart)
  const setAdvisor = useStore((s) => s.setAdvisor)

  const zone = useZone()
  const variant = product.variants.find((v) => v.id === variantId)!
  const price = priceFor(product, selection, variantId)
  const facts = useMemo(() => resolveFacts(product, selection), [product, selection])

  // Live check: this configuration vs the shopper's setup + what is already in the cart.
  const compat: CompatResult = useMemo(() => {
    const inCart = cart.filter((l) => l.productId !== product.id).map((l) => ({ id: l.key, name: byId(l.productId).name, facts: resolveFacts(byId(l.productId), l.selection) }))
    return checkBuild({ name: product.name, facts, product }, [...owned, ...inCart])
  }, [facts, owned, cart, product])

  const applyFix = (fix: NonNullable<CompatResult['issues'][number]['fix']>) => {
    if (fix.kind === 'add-sku' && fix.sku) add(byId(fix.sku), byId(fix.sku).variants[0].id)
    if (fix.kind === 'select-option' && fix.optionGroup && fix.choice) setSelection((s) => ({ ...s, [fix.optionGroup!]: fix.choice! }))
  }

  const onAdd = () => {
    add(product, variantId, selection)
    setAdded(true)
    window.setTimeout(() => setAdded(false), 1600)
  }
  const buyable = canBuy(product)

  const other = compareWith ? byId(compareWith) : null
  const related = product.id === HERO
    ? ['elite-yard-master-2-100', 'anker-prime-100w', 'bose-ultra-open-2', 'chipolo-pop'].map(byId)
    : [...products.filter((p) => p.id !== product.id && p.category === product.category), ...[...products].sort((a, b) => b.trend.delta - a.trend.delta).filter((p) => p.id !== product.id && p.category !== product.category)].slice(0, 4)
  const is3D = product.id === HERO
  const photos = product.photos ?? []
  const local = product.fulfil.route === 'warehouse'
  const topSpecs = product.specs[0].rows.slice(0, 4)
  const st = STATE[compat.status]
  const fallback = <div className="h-full w-full p-10"><ProductImage product={product} hue={variant.hue} swatch={variant.swatch} /></div>

  return (
    <div className="mx-auto max-w-[1440px] px-4 pb-28 md:px-6 lg:pb-16">
      <nav aria-label="Breadcrumb" className="py-4 text-[13px] text-ink-3">
        <button type="button" onClick={() => go({ name: 'home' })} className="hover:text-ink">Home</button>
        <span className="mx-1.5">/</span>
        <span>{product.category}</span>
        <span className="mx-1.5">/</span>
        <span className="text-ink">{product.brand} {product.name}</span>
      </nav>

      <div className="grid grid-cols-12 gap-x-8 gap-y-8">
        {/* ---------- media on the bench mat ---------- */}
        <Reveal className="col-span-12 lg:col-span-7">
          <div className="slab">
            <div className="flex items-center justify-between px-4 pt-1.5 sm:px-5">
              <div className="flex gap-4" role="tablist" aria-label="View mode">
                {([
                  { id: '360', label: '360°', show: is3D },
                  { id: 'exploded', label: 'Exploded view', show: is3D },
                  { id: 'gallery', label: 'Photos', show: true },
                ] as const).filter((m) => m.show).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    role="tab"
                    aria-selected={mode === m.id}
                    onClick={() => setMode(m.id)}
                    className={cn('relative py-3 text-[14.5px]', mode === m.id ? 'text-on-mat' : 'text-rule hover:text-on-mat')}
                  >
                    {m.label}
                    {mode === m.id && <span className="absolute inset-x-0 bottom-1.5 h-[2px] bg-signal" />}
                  </button>
                ))}
              </div>
              <span className="reading hidden text-[11.5px] text-rule sm:inline">{is3D && mode !== 'gallery' ? 'Procedural model' : photos.length ? `Photo ${photo + 1} of ${photos.length}` : 'Render, photo pending'}</span>
            </div>

            <div className="relative aspect-[4/3] w-full">
              {is3D && mode !== 'gallery' ? (
                <Suspense fallback={fallback}>
                  <ProductCanvas mode={mode} light={isLightSwatch(variant.swatch)} hue={variant.hue} hovered={hovered} setHovered={setHovered} fallback={fallback} label={`${product.brand} ${product.name}`} />
                </Suspense>
              ) : (
                <div className={cn('h-full w-full', photos.length ? '' : 'p-6 sm:p-10')}><ProductImage product={product} index={photo} hue={variant.hue} swatch={variant.swatch} /></div>
              )}
              {is3D && mode !== 'gallery' && (
                <div className="pointer-events-none absolute inset-y-0 left-0 right-7 lg:right-0"><Callouts product={product} lines={false} /></div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-on-mat/15 px-4 py-3 text-[13px] text-rule sm:px-5">
              <span>{is3D && mode !== 'gallery' ? 'Drag to rotate, scroll to zoom, arrow keys rotate' : `${product.brand} ${product.name}, ${variant.label.toLowerCase()}`}</span>
              <span>{variant.label}</span>
            </div>
          </div>

          {mode === 'gallery' && photos.length > 1 && (
            <div className="mt-3 flex gap-2" role="tablist" aria-label="Photos">
              {photos.map((src, i) => (
                <button key={i} type="button" role="tab" aria-selected={photo === i} onClick={() => setPhoto(i)} className={cn('h-16 w-20 overflow-hidden rounded-[2px] border border-rule bg-sheet', photo === i ? 'ring-2 ring-inset ring-ink' : 'opacity-80 hover:opacity-100')}>
                  <img src={src} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}

          {is3D && mode !== 'gallery' && (
            <ul className="mt-4 hidden grid-cols-3 gap-px overflow-hidden rounded-[2px] border border-rule bg-rule md:grid lg:grid-cols-6" aria-label="Components">
              {PARTS.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onMouseEnter={() => setHovered(p.id)}
                    onMouseLeave={() => setHovered(null)}
                    onFocus={() => setHovered(p.id)}
                    onBlur={() => setHovered(null)}
                    onClick={() => setMode('exploded')}
                    className={cn('block h-full w-full px-4 py-3.5 text-left transition-colors', hovered === p.id ? 'bg-signal-2' : 'bg-sheet hover:bg-paper')}
                  >
                    <div className="text-[14.5px] font-medium text-ink">{p.name}</div>
                    <div className="truncate text-[13px] text-ink-2">{p.spec}</div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Reveal>

        {/* ---------- configurator on a white sheet ---------- */}
        <aside className="col-span-12 lg:col-span-5 lg:row-span-2">
          <div className="lg:sticky lg:top-[88px]">
            <Reveal delay={0.12} className="rounded-[2px] border border-ink bg-sheet">
              <div className="flex flex-col gap-3.5 px-5 pt-6 sm:px-6">
                <div className="text-[13.5px] text-ink-2">{product.brand}, {product.category.toLowerCase()}</div>
                <h1 className="display text-[44px] text-ink lg:text-[64px]">{product.name}</h1>
                <div className="flex flex-wrap items-baseline gap-x-3.5 gap-y-1">
                  <span className="numeral text-[30px] text-ink lg:text-[36px]" aria-live="polite">{fmt(price, currency, { compact: true })}</span>
                  {product.compareAt ? <span className="numeral text-[13px] text-ink-3">RRP {fmt(product.compareAt, currency, { compact: true })}</span> : null}
                  <span className="text-[13.5px] text-ink-2">or {fmt(price / 12, currency)} a month for 12</span>
                </div>
                <div className="flex flex-wrap items-center gap-3.5">
                  <Stars rating={product.rating} size={12} />
                  {product.trend.label !== 'Steady' && <Tile>{signedPct(product.trend.delta)} this week</Tile>}
                </div>
              </div>

              {/* works-with row */}
              <button
                type="button"
                onClick={() => { setTab('compat'); document.getElementById('tab-compat')?.scrollIntoView({ behavior: 'smooth', block: 'center' }) }}
                className={cn('mt-5 flex w-full items-center gap-3 border-y border-rule px-5 py-3 text-left text-[13.5px] sm:px-6', st.tint)}
                aria-live="polite"
              >
                <span className={cn('inline-block h-2.5 w-2.5 shrink-0', st.mark)} aria-hidden />
                <span className={cn('font-medium', st.text)}>{st.label}</span>
                <span className="min-w-0 flex-1 truncate text-ink-2">{compat.summary}</span>
                <span className="shrink-0 text-ink-2 underline underline-offset-4">Details</span>
              </button>

              <div className="px-5 sm:px-6">
                {/* finish */}
                <div className="flex items-center justify-between border-b border-rule py-3">
                  <span className="text-[13.5px] text-ink">Finish</span>
                  <div className="flex items-center gap-3">
                    <span className="text-[13px] text-ink-3">{variant.label}{variant.delta ? <span className="reading ml-1.5 text-[11px]">+{fmt(variant.delta, currency, { compact: true })}</span> : null}</span>
                    <div className="flex gap-1.5" role="radiogroup" aria-label="Finish">
                      {product.variants.map((v) => (
                        <button key={v.id} type="button" role="radio" aria-checked={v.id === variantId} aria-label={v.label} onClick={() => setVariantId(v.id)} className={cn('h-7 w-7 border p-[3px]', v.id === variantId ? 'border-ink' : 'border-rule-2')}>
                          <span className="block h-full w-full" style={{ background: v.swatch }} />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* options as ruled cells */}
                {product.options?.map((g) => (
                  <div key={g.id} className="border-b border-rule py-4">
                    <div className="mb-2 flex items-center justify-between text-[13.5px]">
                      <span className="text-ink">{g.label}</span>
                      <span className="text-ink-3">{g.choices.find((c) => c.id === selection[g.id])?.label}</span>
                    </div>
                    <div className={cn('sheet-grid', g.choices.length === 3 ? 'grid-cols-3' : g.choices.length > 3 ? 'grid-cols-4' : 'grid-cols-2')} role="radiogroup" aria-label={g.label}>
                      {g.choices.map((c) => (
                        <Chip key={c.id} className="min-h-[56px]" selected={selection[g.id] === c.id} role="radio" aria-checked={selection[g.id] === c.id} onClick={() => setSelection((s) => ({ ...s, [g.id]: c.id }))} sub={c.sub}>
                          <span className="flex w-full items-baseline justify-between gap-2">
                            {c.label}
                            {c.delta ? <span className="reading text-[11px] font-normal text-ink-3">+{fmt(c.delta, currency, { compact: true })}</span> : null}
                          </span>
                        </Chip>
                      ))}
                    </div>
                  </div>
                ))}

                <div className="flex items-center justify-between py-3 text-[13px]">
                  <StockDot stock={product.stock} count={product.stockCount} />
                  <span className="text-ink-2">{originLabel(product.fulfil)}, {etaText(product.fulfil.origin, zone)}</span>
                </div>
                <div className="flex items-center justify-between border-t border-rule py-2 text-[11.5px] text-ink-3">
                  <span>Price checked {priceCheckedText(product.priceCheckedAt)} at {product.sources[0]}{product.priceSource ? `, from ${new Intl.NumberFormat('en', { style: 'currency', currency: product.priceSource.currency, currencyDisplay: 'narrowSymbol' }).format(product.priceSource.amount)} at ${product.priceSource.at}` : ''}{product.compareAt ? `, RRP ${fmt(product.compareAt, currency, { compact: true })}` : ''}</span>
                  <span>AUD incl. GST</span>
                </div>
              </div>

              {buyable ? (
                <div className="hidden gap-2.5 px-5 pb-6 sm:px-6 lg:flex">
                  <Button variant="primary" size="lg" onClick={onAdd} className="flex-1" aria-live="polite">
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.span key={added ? 'ok' : 'add'} initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -8, opacity: 0 }} transition={{ duration: 0.14 }} className="flex items-center gap-2">
                        {added ? <><Check size={16} strokeWidth={2.5} /> Added to cart</> : <>Add to cart, {fmt(price, currency, { compact: true })}</>}
                      </motion.span>
                    </AnimatePresence>
                  </Button>
                  <Button variant="secondary" size="lg" onClick={() => add(product, variantId, selection)}>Buy now</Button>
                </div>
              ) : (
                <div className="border-t border-ink px-5 pb-5 pt-3 sm:px-6">
                  <NotifyMe productId={product.id} />
                </div>
              )}
            </Reveal>

            <button type="button" onClick={() => setAdvisor(true)} className="mt-4 text-[14.5px] text-ink underline decoration-rule-2 underline-offset-4 hover:decoration-ink">
              Will this work with my phone and home? Ask the Trend Scout
            </button>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[13.5px] text-ink-2">
              <span>2-year warranty</span><span>Local repairs</span><span>Tracked on both routes</span>
            </div>
          </div>
        </aside>

        {/* ---------- tabs ---------- */}
        <div className="col-span-12 lg:col-span-7">
          <div role="tablist" aria-label="Product details" className="scrollbar-none flex gap-7 overflow-x-auto whitespace-nowrap border-b border-rule">
            {([
              ['overview', 'Overview'], ['specs', 'Specifications'], ['compat', 'Works with'], ['reviews', product.rating ? `Reviews (${product.rating.count.toLocaleString()})` : 'Reviews'],
            ] as [Tab, string][]).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                id={`tab-${id}`}
                aria-selected={tab === id}
                aria-controls={`panel-${id}`}
                onClick={() => setTab(id)}
                className={cn('relative flex items-center gap-2 py-3 text-[15.5px]', tab === id ? 'text-ink' : 'text-ink-2 hover:text-ink')}
              >
                {id === 'compat' && <span className={cn('h-2 w-2', st.mark)} />}
                {label}
                {tab === id && <span className="absolute inset-x-0 -bottom-px h-[2px] bg-signal" />}
              </button>
            ))}
          </div>

          <div className="py-6">
            {tab === 'overview' && (
              <div role="tabpanel" id="panel-overview" aria-labelledby="tab-overview" className="grid gap-8 md:grid-cols-5">
                <div className="md:col-span-3">
                  <h2 className="display-md text-[24px] text-ink">{product.tagline}</h2>
                  <p className="mt-4 text-[15px] leading-relaxed text-ink-2">
                    {product.id === HERO
                      ? 'The MoGo 4 Laser is the portable projector people are swapping their second TV for: a triple-laser light engine with no bulb to replace, Google TV with Netflix running natively rather than cast from a phone, and a built-in stand that swivels so the picture can go on a wall or the ceiling. Reviewers measure it well short of its 550-lumen claim, so plan on a dim room.'
                      : `${product.brand} ${product.name} is listed because interest in it is climbing and it is on sale today at the price shown, checked ${priceCheckedText(product.priceCheckedAt)} at ${product.sources.join(' and ')}. Before you pay it is checked against your phone, your home hub and your plug.`}
                  </p>
                  <div className="mt-5">
                    {topSpecs.map((r) => <Row key={r.label} label={r.label} value={r.value} />)}
                  </div>
                </div>
                <div className="md:col-span-2">
                  <div className="border border-rule bg-sheet">
                    <div className="border-b border-rule px-4 py-2.5 text-[13px] text-ink-2">Why it is on the shelf</div>
                    <div className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Sparkline series={product.trend.series} width={96} height={28} />
                        <div className="text-[13px]"><span className="reading text-ink">{signedPct(product.trend.delta)}</span> <span className="text-ink-2">interest, 7 days</span></div>
                      </div>
                      <div className="mt-1 text-[12px] text-ink-3">{product.trend.source}</div>
                    </div>
                    <div className="border-t border-rule px-4 py-3">
                      <div className="text-[13px] text-ink-2">In the box</div>
                      <ul className="mt-1 space-y-0.5 text-[13.5px] text-ink">
                        {(product.inBox ?? [`${product.brand} ${product.name}`]).map((i) => <li key={i}>{i}</li>)}
                      </ul>
                    </div>
                    <div className="grid grid-cols-3 divide-x divide-rule border-t border-rule text-center">
                      {[[etaText(product.fulfil.origin, zone).replace(' days', ' d'), originShort(product.fulfil).toLowerCase()], ['30 d', 'returns'], ['2 yr', 'warranty']].map(([v, l]) => (
                        <div key={l} className="py-3"><div className="reading text-[14px] text-ink">{v}</div><div className="text-[11.5px] text-ink-3">{l}</div></div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {tab === 'specs' && (
              <div role="tabpanel" id="panel-specs" aria-labelledby="tab-specs">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-[13px]">
                  <span className="text-ink-2">Maker's specifications, checked {priceCheckedText(product.priceCheckedAt)}.</span>
                  <label className="flex items-center gap-2 text-ink-2">
                    Compare with
                    <select id="compare-with" value={compareWith ?? ''} onChange={(e) => setCompareWith(e.target.value || null)} className="h-8 border border-rule-2 bg-sheet px-2 text-[13px] text-ink">
                      <option value="">nothing</option>
                      {products.filter((p) => p.id !== product.id && p.category === product.category).map((p) => <option key={p.id} value={p.id}>{p.brand} {p.name}</option>)}
                    </select>
                  </label>
                  {compareWith && <button type="button" onClick={() => go({ name: 'compare', ids: [product.id, compareWith] })} className="text-ink-2 underline underline-offset-4 hover:text-ink">Open the compare page</button>}
                </div>
                <div className="overflow-x-auto border border-rule">
                  <table className="w-full min-w-[520px] border-collapse text-[13.5px]">
                    <thead>
                      <tr className="bg-sheet text-left">
                        <th className="px-4 py-2 font-normal text-ink-3">Specification</th>
                        <th className="px-4 py-2 font-medium text-ink">{product.name}</th>
                        {other && <th className="px-4 py-2 font-normal text-ink-2">{other.name}</th>}
                      </tr>
                    </thead>
                    {product.specs.map((g) => (
                      <tbody key={g.group}>
                        <tr><td colSpan={other ? 3 : 2} className="border-t border-rule bg-paper px-4 py-1.5 text-[12.5px] text-ink-3">{g.group}</td></tr>
                        {g.rows.map((r) => {
                          const o = other?.specs.flatMap((x) => x.rows).find((x) => x.label === r.label)
                          let win: 'a' | 'b' | null = null
                          if (o && r.n !== undefined && o.n !== undefined && r.n !== o.n) win = (r.better === 'low' ? r.n < o.n : r.n > o.n) ? 'a' : 'b'
                          return (
                            <tr key={r.label} className="border-t border-rule bg-sheet">
                              <td className="px-4 py-2 text-ink-2">{r.label}</td>
                              <td className={cn('reading px-4 py-2 text-[12.5px]', win === 'a' ? 'text-pass' : 'text-ink')}>{r.value}</td>
                              {other && <td className={cn('reading px-4 py-2 text-[12.5px]', win === 'b' ? 'text-pass' : 'text-ink-2')}>{o?.value ?? 'not listed'}</td>}
                            </tr>
                          )
                        })}
                      </tbody>
                    ))}
                  </table>
                </div>
                <div className="mt-3 border border-rule bg-sheet px-4 py-3 text-[12.5px] text-ink-2">
                  <div><span className="text-ink-3">Sources, checked {priceCheckedText(product.priceCheckedAt)}:</span> {product.sources.join(', ')}</div>
                  {product.notes && <div className="mt-1"><span className="text-ink-3">Notes:</span> {product.notes}</div>}
                </div>
              </div>
            )}

            {tab === 'compat' && (
              <div role="tabpanel" id="panel-compat" aria-labelledby="tab-compat" className="grid gap-8 md:grid-cols-5">
                <div className="md:col-span-3">
                  <CompatPanel compat={compat} onFix={applyFix} />
                </div>
                <div className="md:col-span-2">
                  <div className="mb-2 flex items-center justify-between text-[13px] text-ink-2"><span>My setup, checked live</span><button type="button" onClick={() => go({ name: 'setup' })} className="underline underline-offset-4 hover:text-ink">Edit</button></div>
                  <ul className="border border-rule bg-sheet">
                    {gear.map((g) => (
                      <li key={g.id} className="flex items-center justify-between gap-3 border-b border-rule px-4 py-2.5 last:border-b-0">
                        <div className="min-w-0">
                          <div className="truncate text-[13.5px] text-ink">{g.name}</div>
                          <div className="truncate text-[12px] text-ink-3">{g.detail}</div>
                        </div>
                        <Toggle on={!!gearOn[g.id]} onChange={() => toggleGear(g.id)} label={`Include ${g.name} in the check`} />
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-[12px] text-ink-3">Items in your cart are checked too: app, magnets, finder network, home hub, plug, voltage and power. {compat.checked} items, 3 ms.</p>
                </div>
              </div>
            )}

            {tab === 'reviews' && (
              <div role="tabpanel" id="panel-reviews" aria-labelledby="tab-reviews" className="border border-rule bg-sheet">
                {product.rating ? (
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-rule px-4 py-3">
                    <span className="reading text-[28px] text-ink">{product.rating.value.toFixed(1)}</span>
                    <div className="text-[13.5px]">
                      <div className="text-ink">{product.rating.count.toLocaleString()} ratings at {product.rating.at}</div>
                      <div className="text-ink-3">The maker's or retailer's rating, as shown on {priceCheckedText(product.priceCheckedAt)}.</div>
                    </div>
                  </div>
                ) : (
                  <div className="border-b border-rule px-4 py-3 text-[13.5px] text-ink-2">No verified rating with a visible review count at the sources we checked.</div>
                )}
                <p className="px-4 py-3 text-[13.5px] text-ink-2">No NEXUS reviews yet. Reviews appear here after a verified purchase, and we do not write them ourselves.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {benchFor(product.id).length > 0 && <div className="mt-16 lg:mt-24"><BenchResults productId={product.id} /></div>}

      {/* related */}
      <section className="mt-16 lg:mt-24">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="display text-[30px] text-ink lg:text-[40px]">{product.id === HERO ? `Checked to work with the ${product.name}` : `Rising alongside the ${product.name}`}</h2>
        </div>
        <div className="scrollbar-none -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 pt-1 md:mx-0 md:grid md:grid-cols-4 md:overflow-visible md:px-0 md:pb-0 md:pt-0">
          {related.map((p) => <div key={p.id} className="min-w-[270px] snap-start md:min-w-0"><ProductCard product={p} /></div>)}
        </div>
      </section>

      {/* mobile action bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-ink bg-sheet px-4 pt-3 lg:hidden" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}>
        <div className="flex items-center gap-3">
          <div className="min-w-0">
            <div className="reading text-[17px] text-ink">{fmt(price, currency, { compact: true })}</div>
            <div className={cn('truncate text-[12px]', buyable ? st.text : 'text-ink-3')}>{!buyable ? 'Not yet stocked' : compat.status === 'ok' ? 'Works with your setup' : compat.summary}</div>
          </div>
          {buyable
            ? <Button variant="primary" size="lg" onClick={onAdd} className="ml-auto !h-12 !text-[15px] flex-1 max-w-[240px]">{added ? 'Added' : 'Add to cart'}</Button>
            : <Button variant="secondary" size="lg" onClick={() => { document.getElementById(NOTIFY_INPUT_ID)?.scrollIntoView({ block: 'center' }); document.getElementById(NOTIFY_INPUT_ID)?.focus() }} className="ml-auto !h-12 !text-[15px] flex-1 max-w-[240px]">Tell me when</Button>}
        </div>
      </div>
    </div>
  )
}

function CompatPanel({ compat, onFix }: { compat: CompatResult; onFix: (fix: NonNullable<CompatResult['issues'][number]['fix']>) => void }) {
  const st = STATE[compat.status]
  const currency = useStore((s) => s.currency)
  return (
    <div>
      <div className={cn('flex items-center gap-3 border border-rule px-4 py-3', st.tint)}>
        <span className={cn('h-2.5 w-2.5', st.mark)} aria-hidden />
        <span className={cn('text-[14px] font-medium', st.text)}>{st.label}</span>
        <span className="text-[13px] text-ink-2">{compat.summary}</span>
      </div>
      {compat.issues.length === 0 ? (
        <p className="mt-3 text-[13.5px] text-ink-2">App, magnets, finder network, home hub, plug, voltage and power were checked for all {compat.checked} items in your setup and cart.</p>
      ) : (
        <ul className="mt-3 border border-rule bg-sheet">
          {compat.issues.map((i) => (
            <li key={i.id} className="border-b border-rule p-4 last:border-b-0">
              <div className="flex items-start gap-3">
                <span className={cn('mt-1.5 h-2.5 w-2.5 shrink-0', i.severity === 'bad' ? 'bg-fail' : 'bg-check')} aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-medium text-ink">{i.title}</div>
                  <div className="mt-0.5 text-[13.5px] text-ink-2">{i.because}</div>
                  {i.fix && <Button size="sm" variant="secondary" className="mt-3" onClick={() => onFix(i.fix!)}>{i.fix.label}{i.fix.price !== undefined ? <span className="reading ml-1 text-[11px] text-ink-3">{fmt(i.fix.price, currency, { compact: true })}</span> : null}</Button>}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

