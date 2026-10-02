import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, X } from 'lucide-react'
import { byId } from '../lib/data'
import { fmt } from '../lib/currency'
import { useStore } from '../lib/store'
import { ProductVisual } from './ProductVisual'
import { Button, Row, Stars, StockDot, Tile } from './ui'
import { cn } from '../lib/cn'

export function QuickView() {
  const id = useStore((s) => s.quickViewId)
  const close = () => useStore.getState().setQuickView(null)
  const go = useStore((s) => s.go)
  const add = useStore((s) => s.add)
  const currency = useStore((s) => s.currency)
  const [variantId, setVariantId] = useState<string | null>(null)
  const [added, setAdded] = useState(false)

  useEffect(() => {
    if (!id) return
    setVariantId(null)
    setAdded(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [id])

  const product = id ? byId(id) : null
  const variant = product ? product.variants.find((v) => v.id === variantId) ?? product.variants[0] : null

  return (
    <AnimatePresence>
      {product && variant && (
        <motion.div className="fixed inset-0 z-50 grid place-items-center bg-ink/30 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.14 }} onClick={close}>
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="qv-title"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4, transition: { duration: 0.12 } }}
            transition={{ duration: 0.18 }}
            onClick={(e) => e.stopPropagation()}
            className="relative grid w-full max-w-[880px] border border-ink bg-sheet md:grid-cols-2"
          >
            <button type="button" aria-label="Close quick view" onClick={close} className="absolute right-2 top-2 z-10 p-2 text-ink"><X size={18} /></button>
            <div className="aspect-[4/3] border-b border-rule bg-paper p-8 md:aspect-auto md:border-b-0 md:border-r">
              <ProductVisual visual={product.visual} hue={variant.hue} swatch={variant.swatch} />
            </div>
            <div className="flex flex-col p-6">
              <div className="text-[13px] text-ink-2">{product.brand}, {product.category.toLowerCase()}</div>
              <h2 id="qv-title" className="display-md mt-1 text-[30px] text-ink">{product.name}</h2>
              <div className="mt-2 flex items-center gap-3"><Stars rating={product.rating} reviews={product.reviews} /><Tile>+{product.trend.delta}%</Tile></div>
              <p className="mt-3 text-[14px] leading-relaxed text-ink-2">{product.tagline}</p>

              {product.variants.length > 1 && (
                <div className="mt-4 flex items-center justify-between border-t border-rule pt-3 text-[13.5px]">
                  <span className="text-ink">Finish</span>
                  <div className="flex items-center gap-3">
                    <span className="text-ink-3">{variant.label}</span>
                    <div className="flex gap-1.5" role="radiogroup" aria-label="Finish">
                      {product.variants.map((v) => (
                        <button key={v.id} type="button" role="radio" aria-checked={v.id === variant.id} aria-label={v.label} onClick={() => setVariantId(v.id)} className={cn('h-6 w-6 border p-[2px]', v.id === variant.id ? 'border-ink' : 'border-rule-2')}>
                          <span className="block h-full w-full" style={{ background: v.swatch }} />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-2">
                {product.specs[0].rows.slice(0, 3).map((r) => <Row key={r.label} label={r.label} value={r.value} />)}
              </div>

              <div className="mt-auto pt-6">
                <div className="mb-3 flex items-center justify-between">
                  <div className="reading text-[22px] text-ink">{fmt(product.price, currency, { compact: true })}</div>
                  <StockDot stock={product.stock} count={product.stockCount} />
                </div>
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <Button variant="primary" size="lg" onClick={() => { add(product, variant.id); setAdded(true); window.setTimeout(close, 500) }}>
                    {added ? <><Check size={16} strokeWidth={2.5} /> Added</> : 'Add to cart'}
                  </Button>
                  <Button variant="secondary" size="lg" onClick={() => { close(); go({ name: 'pdp', id: product.id }) }}>Full details</Button>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
