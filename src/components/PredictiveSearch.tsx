import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Search, X } from 'lucide-react'
import { products, trendingSearches, nav } from '../lib/data'
import { fmt } from '../lib/currency'
import { useStore } from '../lib/store'
import { ProductImage } from './ProductVisual'
import { Kbd, StockDot, Tile } from './ui'
import { cn } from '../lib/cn'
import { signedPct } from '../lib/text'

/* Client-side predictive index. In production: Meilisearch hybrid search with typo tolerance, under 50 ms. */
const tokens = (s: string) => s.toLowerCase().split(/[^a-z0-9.]+/).filter(Boolean)
function score(q: string, hay: string[]) {
  const qs = tokens(q)
  if (!qs.length) return 0
  let s = 0
  for (const t of qs) for (const h of hay) {
    if (h === t) s += 3
    else if (h.startsWith(t)) s += 2
    else if (h.includes(t)) s += 1
  }
  return s
}

const index = products.map((p) => ({ p, hay: tokens(`${p.brand} ${p.name} ${p.category} ${p.tagline}`) }))
const categories = nav.flatMap((s) => s.columns.flatMap((c) => c.items.map((i) => ({ item: i, section: s.label }))))

export function PredictiveSearch() {
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const open = useStore((s) => s.searchOpen)
  const setOpen = useStore((s) => s.setSearchOpen)
  const go = useStore((s) => s.go)
  const setAdvisor = useStore((s) => s.setAdvisor)
  const currency = useStore((s) => s.currency)
  const inputRef = useRef<HTMLInputElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  const results = useMemo(() => {
    if (!q.trim()) return []
    return index.map((e) => ({ p: e.p, s: score(q, e.hay) })).filter((e) => e.s > 0).sort((a, b) => b.s - a.s).slice(0, 5).map((e) => e.p)
  }, [q])
  const catHits = useMemo(() => {
    if (!q.trim()) return []
    const ql = q.toLowerCase()
    return categories.filter((c) => c.item.toLowerCase().includes(ql)).slice(0, 3)
  }, [q])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); inputRef.current?.focus(); setOpen(true) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setOpen])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open, setOpen])

  const [navigated, setNavigated] = useState(false)
  useEffect(() => { setActive(0); setNavigated(false) }, [q])

  const recent = useStore((s) => s.recentSearches)
  const rows = [...results.map((p) => ({ kind: 'product' as const, p })), ...(q.trim() ? [{ kind: 'all' as const }, { kind: 'advisor' as const }] : [])]
  const search = () => { const t = q.trim(); if (!t) return; go({ name: 'search', q: t, filters: {} }); setOpen(false); setQ('') }
  const choose = (i: number) => {
    const r = rows[i]
    if (!r) return
    if (r.kind === 'product') go({ name: 'product', id: r.p.id })
    else if (r.kind === 'all') { search(); return }
    else { setAdvisor(true); setOpen(false) }
    setQ('')
  }
  const highlight = (text: string) => {
    const t = q.trim()
    if (!t) return text
    const i = text.toLowerCase().indexOf(t.toLowerCase())
    if (i < 0) return text
    return <>{text.slice(0, i)}<mark className="bg-signal-2 text-ink">{text.slice(i, i + t.length)}</mark>{text.slice(i + t.length)}</>
  }

  return (
    <div ref={wrapRef} className="relative w-full">
      <div className={cn('flex h-9 items-center gap-2 border bg-sheet pl-2.5 pr-1.5 transition-colors duration-120', open ? 'border-ink' : 'border-rule-2 hover:border-ink')}>
        <Search size={15} strokeWidth={1.75} className="shrink-0 text-ink-3" />
        <input
          ref={inputRef}
          id="site-search"
          type="search"
          role="combobox"
          aria-expanded={open}
          aria-controls="search-listbox"
          aria-autocomplete="list"
          aria-label="Search products"
          autoComplete="off"
          placeholder="Search"
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setNavigated(true); setActive((a) => Math.min(a + 1, rows.length - 1)) }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setNavigated(true); setActive((a) => Math.max(a - 1, 0)) }
            else if (e.key === 'Enter') { e.preventDefault(); if (navigated) choose(active); else search() }
            else if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur() }
          }}
          className="h-full min-w-0 flex-1 bg-transparent text-[14px] text-ink placeholder:text-ink-3 focus:outline-none [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none"
        />
        {q ? (
          <button type="button" aria-label="Clear search" onClick={() => { setQ(''); inputRef.current?.focus() }} className="p-1 text-ink-3 hover:text-ink"><X size={14} /></button>
        ) : (
          <span className="hidden items-center gap-1 md:flex" aria-hidden><Kbd>⌘</Kbd><Kbd>K</Kbd></span>
        )}
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            id="search-listbox"
            role="listbox"
            initial={{ opacity: 0, y: -2 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -2, transition: { duration: 0.1 } }}
            transition={{ duration: 0.14 }}
            className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 border border-ink bg-sheet md:left-auto md:w-[620px] md:max-w-[calc(100vw-32px)]"
          >
            {!q.trim() ? (
              <div className="grid divide-y divide-rule sm:grid-cols-2 sm:divide-x sm:divide-y-0">
                <div className="p-4">
                  <div className="mb-2 text-[12.5px] text-ink-3">Recent</div>
                  {recent.length ? (
                    <ul className="space-y-1">
                      {recent.map((r) => (
                        <li key={r}><button type="button" onClick={() => setQ(r)} className="block w-full text-left text-[14px] text-ink hover:underline underline-offset-4">{r}</button></li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[13px] text-ink-3">Try a search; the last five you make will sit here.</p>
                  )}
                </div>
                <div className="p-4">
                  <div className="mb-2 text-[12.5px] text-ink-3">People are searching</div>
                  <ul className="space-y-1">
                    {trendingSearches.map((t) => (
                      <li key={t}><button type="button" onClick={() => setQ(t)} className="block w-full text-left text-[14px] text-ink hover:underline underline-offset-4">{t}</button></li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <div>
                {results.length === 0 && catHits.length === 0 && (
                  <div className="px-4 py-3 text-[13.5px] text-ink-2">Nothing matches “{q}”. Try a category, a brand, or what it works with.</div>
                )}
                {results.length > 0 && (
                  <ul className="divide-y divide-rule">
                    {results.map((p, i) => (
                      <li key={p.id} role="option" aria-selected={active === i}>
                        <button
                          type="button"
                          onMouseEnter={() => setActive(i)}
                          onClick={() => choose(i)}
                          className={cn('flex w-full items-center gap-3 px-3 py-2 text-left transition-colors', active === i ? 'bg-paper' : 'hover:bg-paper')}
                        >
                          <div className="h-12 w-16 shrink-0"><ProductImage product={p} /></div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[14px] font-medium text-ink">{highlight(`${p.brand} ${p.name}`)}</div>
                            <div className="truncate text-[12.5px] text-ink-2">{p.category}, {highlight(p.tagline)}</div>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1">
                            <span className="flex items-center gap-2">
                              <Tile>{signedPct(p.trend.delta)}</Tile>
                              <span className="reading text-[13px] text-ink">{fmt(p.price, currency, { compact: true })}</span>
                            </span>
                            <StockDot stock={p.stock} count={p.stockCount} />
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {catHits.length > 0 && (
                  <div className="border-t border-rule px-3 py-2.5">
                    <span className="mr-2 text-[12.5px] text-ink-3">Categories</span>
                    {catHits.map((c) => (
                      <button key={c.item} type="button" onClick={() => setOpen(false)} className="mr-3 text-[13.5px] text-ink hover:underline underline-offset-4">{c.item} <span className="text-ink-3">in {c.section}</span></button>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  role="option"
                  aria-selected={active === rows.length - 2}
                  onMouseEnter={() => setActive(rows.length - 2)}
                  onClick={() => choose(rows.length - 2)}
                  className={cn('flex w-full items-center border-t border-rule px-3 py-2.5 text-left text-[13.5px] transition-colors', active === rows.length - 2 ? 'bg-paper text-ink' : 'text-ink-2 hover:bg-paper')}
                >
                  See all results for “{q}”
                </button>
                <button
                  type="button"
                  role="option"
                  aria-selected={active === rows.length - 1}
                  onMouseEnter={() => setActive(rows.length - 1)}
                  onClick={() => choose(rows.length - 1)}
                  className={cn('flex w-full items-center border-t border-rule px-3 py-2.5 text-left text-[13.5px] transition-colors', active === rows.length - 1 ? 'bg-paper text-ink' : 'text-ink-2 hover:bg-paper')}
                >
                  Ask the Trend Scout about “{q}”
                </button>
              </div>
            )}
            <div className="flex items-center gap-3 border-t border-rule px-3 py-1.5 text-[11.5px] text-ink-3">
              <span className="flex items-center gap-1"><Kbd>↑</Kbd><Kbd>↓</Kbd> move</span>
              <span className="flex items-center gap-1"><Kbd>↵</Kbd> open</span>
              <span className="flex items-center gap-1"><Kbd>esc</Kbd> close</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
