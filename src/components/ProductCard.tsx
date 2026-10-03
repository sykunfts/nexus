import { useId, useState } from 'react'
import { Check, Plus } from 'lucide-react'
import { Product } from '../lib/data'
import { fmt } from '../lib/currency'
import { useStore, useZone } from '../lib/store'
import { ProductImage } from './ProductVisual'
import { Pill, Stars, StockDot, Tile } from './ui'
import { cn } from '../lib/cn'
import { canBuy } from '../lib/office'
import { NotifyMe } from './NotifyMe'
import { etaText, originShort } from '../lib/shipping'

/** 7-day trend sparkline, drawn in ink: a line, a faint baseline, the last point marked. */
export function Sparkline({ series, width = 48, height = 16, className }: { series: number[]; width?: number; height?: number; className?: string }) {
  const id = useId().replace(/:/g, '')
  const max = Math.max(...series), min = Math.min(...series)
  const pts = series.map((v, i) => [(i / (series.length - 1)) * (width - 2) + 1, height - 1 - ((v - min) / Math.max(1, max - min)) * (height - 3)])
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
  const last = pts[pts.length - 1]
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={cn('shrink-0 overflow-visible', className)} aria-hidden="true" data-id={id}>
      <line x1="1" y1={height - 1} x2={width - 1} y2={height - 1} stroke="#c9cec6" strokeWidth="1" />
      <path d={d} fill="none" stroke="#121820" strokeWidth="1.25" strokeLinejoin="round" strokeLinecap="round" />
      <rect x={last[0] - 2} y={last[1] - 2} width="4" height="4" fill="#ff4a1f" />
    </svg>
  )
}

export function TrendPill({ product }: { product: Product }) {
  const t = product.trend
  if (t.label === 'Steady') return null
  return <Tile>{t.label} +{t.delta}%</Tile>
}

export function ProductCard({ product, reason }: { product: Product; reason?: string; index?: number }) {
  const [variantId, setVariantId] = useState(product.variants[0].id)
  const [added, setAdded] = useState(false)
  const add = useStore((s) => s.add)
  const go = useStore((s) => s.go)
  const setQuickView = useStore((s) => s.setQuickView)
  const compare = useStore((s) => s.compare)
  const toggleCompare = useStore((s) => s.toggleCompare)
  const currency = useStore((s) => s.currency)
  const zone = useZone()
  const variant = product.variants.find((v) => v.id === variantId)!
  const comparing = compare.includes(product.id)
  const out = product.stock === 'out'
  const local = product.fulfil.route === 'warehouse'

  const onAdd = () => {
    if (out || added) return
    add(product, variantId)
    setAdded(true)
    window.setTimeout(() => setAdded(false), 1400)
  }

  return (
    <article className="group flex h-full flex-col bg-paper transition-colors duration-120 hover:bg-paper-2">
      {/* render */}
      <div className="relative">
        <button type="button" onClick={() => go({ name: 'product', id: product.id })} className="block aspect-[4/3] w-full cursor-pointer" aria-label={`View ${product.name}`}>
          <ProductImage product={product} hue={variant.hue} swatch={variant.swatch} glow />
        </button>
        <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap gap-1.5">
          <TrendPill product={product} />
          {product.badges?.filter((b) => !['Viral', 'Trending', 'Rising'].includes(b)).map((b) => (
            <Pill key={b} tone={b.startsWith('−') ? 'fail' : b === 'AU stock' ? 'pass' : 'neutral'}>{b}</Pill>
          ))}
        </div>
        <label className="absolute right-3 top-3 flex cursor-pointer items-center gap-1.5 text-[12px] text-ink-2 opacity-0 transition-opacity duration-120 group-hover:opacity-100 focus-within:opacity-100 has-[:checked]:opacity-100">
          <input type="checkbox" checked={comparing} onChange={() => toggleCompare(product.id)} className="h-3.5 w-3.5 accent-[#121820]" aria-label={`Compare ${product.name}`} />
          Compare
        </label>
        <button
          type="button"
          onClick={() => setQuickView(product.id)}
          className="absolute bottom-3 right-3 border border-ink bg-sheet px-2.5 py-1 text-[12.5px] text-ink opacity-0 transition-opacity duration-120 hover:bg-ink hover:text-paper group-hover:opacity-100 focus-visible:opacity-100"
        >
          Quick view
        </button>
      </div>

      {/* index entry */}
      <div className="flex flex-1 flex-col border-t border-rule px-4 pb-4 pt-3">
        {reason && <div className="mb-1 text-[12px] text-ink-3">{reason}</div>}
        <div className="flex items-baseline justify-between gap-3">
          <button type="button" onClick={() => go({ name: 'product', id: product.id })} className="min-w-0 truncate text-left text-[17px] font-medium text-ink hover:underline underline-offset-4 decoration-signal decoration-2">
            {product.name}
          </button>
          <span className="reading shrink-0 text-[15px] text-ink">{fmt(product.price, currency, { compact: true })}</span>
        </div>
        <div className="flex items-baseline justify-between gap-3 text-[12.5px] text-ink-3">
          <span className="truncate">{product.brand}, {product.category.toLowerCase()}</span>
          {product.compareAt && <span className="reading line-through">{fmt(product.compareAt, currency, { compact: true })}</span>}
        </div>
        <p className="mt-2 line-clamp-2 text-[13.5px] leading-snug text-ink-2">{product.tagline}</p>

        <div className="mt-3 flex items-center justify-between gap-3 border-t border-rule pt-3">
          <Stars rating={product.rating} />
          <span className="flex items-center gap-2" title={`${product.trend.source}: +${product.trend.delta}%`}>
            <Sparkline series={product.trend.series} />
            <span className="reading text-[12px] text-ink-2">+{product.trend.delta}%</span>
          </span>
        </div>

        <div className="mt-auto flex items-end justify-between gap-3 pt-3">
          <div className="flex flex-col gap-1.5">
            {product.variants.length > 1 && (
              <div className="flex items-center gap-1.5" role="radiogroup" aria-label="Colour">
                {product.variants.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    role="radio"
                    aria-checked={v.id === variantId}
                    aria-label={v.label}
                    title={v.label}
                    onClick={() => setVariantId(v.id)}
                    className={cn('h-4 w-4 border p-[2px]', v.id === variantId ? 'border-ink' : 'border-rule-2')}
                  >
                    <span className="block h-full w-full" style={{ background: v.swatch }} />
                  </button>
                ))}
              </div>
            )}
            <StockDot stock={product.stock} count={product.stockCount} />
            <span className={cn('text-[12px]', local ? 'text-ink-2' : 'text-ink-3')}>{originShort(product.fulfil)}, {etaText(product.fulfil.origin, zone)}</span>
          </div>

          {!canBuy(product) ? <NotifyMe productId={product.id} compact className="h-10 shrink-0" /> : <button
            type="button"
            onClick={onAdd}
            disabled={out}
            aria-label={added ? 'Added to cart' : `Add ${product.name} to cart`}
            className={cn(
              'flex h-10 items-center gap-1.5 px-3 text-[13.5px] font-medium transition-colors duration-120',
              added ? 'bg-pass text-paper' : 'bg-ink text-paper hover:bg-[#1f2730]',
              out && 'opacity-40',
            )}
          >
            {added ? <Check size={15} strokeWidth={2.5} /> : <Plus size={15} strokeWidth={2.25} />}
            {added ? 'Added' : 'Add'}
          </button>}
        </div>
      </div>
    </article>
  )
}
