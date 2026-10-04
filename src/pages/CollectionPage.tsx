/*
  Collection and search results share this page: the collection's own filters are locked, the
  shopper's filters and sort live in the route so the link is shareable.
*/
import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { products } from '../lib/data'
import { facets as computeFacets, query, similar } from '../lib/catalog'
import { Filters, Sort } from '../lib/routes'
import { useSetup, useStore } from '../lib/store'
import { FilterRail, activeCount } from '../components/FilterRail'
import { ProductCard } from '../components/ProductCard'
import { Button } from '../components/ui'
import { cn } from '../lib/cn'

const SORTS: { value: Sort; label: string }[] = [
  { value: 'trending', label: 'Trending' },
  { value: 'newest', label: 'Newest' },
  { value: 'price-asc', label: 'Price, low to high' },
  { value: 'price-desc', label: 'Price, high to low' },
  { value: 'rating', label: 'Rating' },
]

interface Props {
  title: string
  blurb?: string
  base: Filters                       // locked filters from the collection or the search query
  filters: Filters                    // the shopper's filters, from the route
  sort?: Sort
  defaultSort?: Sort
  q?: string
  onChange: (filters: Filters, sort?: Sort) => void
}

export function CollectionPage({ title, blurb, base, filters, sort, defaultSort = 'trending', q, onChange }: Props) {
  const setup = useSetup()
  const setAdvisor = useStore((s) => s.setAdvisor)
  const go = useStore((s) => s.go)
  const addRecentSearch = useStore((s) => s.addRecentSearch)
  const [sheet, setSheet] = useState(false)
  const effectiveSort = sort ?? defaultSort

  useEffect(() => { if (q) addRecentSearch(q) }, [q, addRecentSearch])
  useEffect(() => { document.body.style.overflow = sheet ? 'hidden' : ''; return () => { document.body.style.overflow = '' } }, [sheet])

  const merged = useMemo<Filters>(() => ({ ...filters, ...base, text: [base.text, filters.text].filter(Boolean).join(' ') || undefined }), [base, filters])
  const results = useMemo(() => query(products, merged, effectiveSort, setup), [merged, effectiveSort, setup])
  const facets = useMemo(() => computeFacets(products, merged, setup), [merged, setup])
  const suggestions = useMemo(() => (results.length === 0 ? similar(products, q ?? title, 3) : []), [results.length, q, title])
  const n = activeCount(filters)

  const rail = <FilterRail filters={filters} facets={facets} locked={base} onChange={(next) => onChange(next, sort)} />

  return (
    <div className="mx-auto max-w-[1440px] px-4 pb-24 md:px-6 lg:pb-16">
      <nav aria-label="Breadcrumb" className="py-4 text-[13px] text-ink-3">
        <button type="button" onClick={() => go({ name: 'home' })} className="hover:text-ink">Home</button>
        <span className="mx-1.5">/</span>
        <span className="text-ink">{title}</span>
      </nav>

      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-b border-ink pb-4">
        <div className="min-w-0">
          <h1 className="display-md text-[34px] text-ink sm:text-[44px]">{q ? <>Results for <span className="text-ink-2">“{q}”</span></> : title}</h1>
          {blurb && <p className="mt-1 max-w-[60ch] text-[14.5px] text-ink-2">{blurb}</p>}
        </div>
        <div className="flex items-center gap-3 text-[13px]">
          <span className="reading text-ink-2" aria-live="polite">{results.length} {results.length === 1 ? 'product' : 'products'}</span>
          <label className="flex items-center gap-2 text-ink-2">
            Sort
            <select value={effectiveSort} onChange={(e) => onChange(filters, e.target.value as Sort)} className="h-8 border border-rule-2 bg-sheet px-2 text-[13px] text-ink">
              {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </label>
          <button type="button" onClick={() => setSheet(true)} className="h-8 border border-ink px-3 text-[13px] font-medium text-ink lg:hidden">Filters{n ? ` (${n})` : ''}</button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-x-8 pt-6">
        <aside className="hidden lg:col-span-3 lg:block"><div className="sticky top-[88px]">{rail}</div></aside>
        <div className="col-span-12 lg:col-span-9">
          {results.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {results.map((p, i) => <div key={p.id}><ProductCard product={p} index={i} /></div>)}
            </div>
          ) : (
            <div className="border border-rule bg-sheet p-6">
              <div className="text-[18px] font-medium text-ink">Nothing matches that yet.</div>
              <p className="mt-1 text-[13.5px] text-ink-2">{n ? 'Loosen a filter, or ask the Trend Scout what is close.' : 'Nothing is listed here yet. Ask the Trend Scout what is close, or try one of these.'}</p>
              <div className="mt-4 flex flex-wrap gap-3">
                {n > 0 && <Button variant="secondary" size="sm" onClick={() => onChange({}, sort)}>Clear filters</Button>}
                <Button variant="primary" size="sm" onClick={() => setAdvisor(true)}>Ask the Trend Scout</Button>
              </div>
              {suggestions.length > 0 && (
                <div className="mt-6 grid gap-4 sm:grid-cols-3">
                  {suggestions.map((p, i) => <div key={p.id}><ProductCard product={p} index={i} /></div>)}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* mobile filter sheet */}
      <AnimatePresence>
        {sheet && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[55] bg-ink/40 lg:hidden" onClick={() => setSheet(false)}>
            <motion.div
              role="dialog" aria-label="Filters"
              initial={{ y: 40 }} animate={{ y: 0 }} exit={{ y: 40 }} transition={{ duration: 0.18 }}
              onClick={(e) => e.stopPropagation()}
              className={cn('absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto border-t border-ink bg-sheet px-4 pb-6 pt-3')}
            >
              <div className="mb-2 flex items-center justify-between border-b border-ink pb-2">
                <span className="text-[14px] font-medium text-ink">Filters{n ? ` (${n})` : ''}</span>
                <div className="flex items-center gap-4">
                  {n > 0 && <button type="button" onClick={() => onChange({}, sort)} className="text-[12.5px] text-ink-2 underline underline-offset-4">Clear all</button>}
                  <button type="button" aria-label="Close filters" onClick={() => setSheet(false)} className="text-ink-3 hover:text-ink"><X size={16} /></button>
                </div>
              </div>
              <FilterRail filters={filters} facets={facets} locked={base} onChange={(next) => onChange(next, sort)} header={false} />
              <Button variant="primary" className="mt-4 w-full" onClick={() => setSheet(false)}>Show {results.length} {results.length === 1 ? 'product' : 'products'}</Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
