import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Menu, Search, ShoppingBag, User, X } from 'lucide-react'
import { nav, TREND_NOTE, trendStatus } from '../lib/data'
import { CURRENCIES, Currency } from '../lib/currency'
import { cartCount, useStore } from '../lib/store'
import { navTarget } from '../lib/collections'
import { MegaMenu } from './MegaMenu'
import { PredictiveSearch } from './PredictiveSearch'
import { cn } from '../lib/cn'

export function Logo({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex items-baseline gap-2" aria-label="NEXUS home">
      <span className="display text-[22px] text-ink">Nexus</span>
      <span className="hidden text-[12px] text-ink-3 sm:inline">checked, then shipped</span>
    </button>
  )
}

export function Header() {
  const [openId, setOpenId] = useState<string | null>(null)
  const [mobileNav, setMobileNav] = useState(false)
  const [mobileSearch, setMobileSearch] = useState(false)
  const [ccyOpen, setCcyOpen] = useState(false)
  const intent = useRef<number | null>(null)

  const cart = useStore((s) => s.cart)
  const openCart = useStore((s) => s.openCart)
  const go = useStore((s) => s.go)
  const currency = useStore((s) => s.currency)
  const setCurrency = useStore((s) => s.setCurrency)
  const setAdvisor = useStore((s) => s.setAdvisor)
  const count = cartCount(cart)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpenId(null); setCcyOpen(false); setMobileNav(false) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Hover intent: 120 ms to open, 160 ms grace to close.
  const enter = (id: string) => {
    if (intent.current) window.clearTimeout(intent.current)
    intent.current = window.setTimeout(() => setOpenId(id), 120)
  }
  const leave = () => {
    if (intent.current) window.clearTimeout(intent.current)
    intent.current = window.setTimeout(() => setOpenId(null), 160)
  }
  const stay = () => { if (intent.current) window.clearTimeout(intent.current) }
  const section = nav.find((s) => s.id === openId)

  return (
    <header className="sticky z-40 w-full border-b border-rule bg-paper" style={{ top: 'env(safe-area-inset-top, 0px)' }} onMouseLeave={leave}>
      <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-4 px-4 md:px-6">
        <button type="button" className="p-1 text-ink lg:hidden" aria-label="Open menu" onClick={() => setMobileNav(true)}>
          <Menu size={20} strokeWidth={1.75} />
        </button>

        <Logo onClick={() => go({ name: 'home' })} />

        <nav className="ml-2 hidden items-center gap-1 lg:flex" aria-label="Primary">
          {nav.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-expanded={openId === s.id}
              aria-haspopup="true"
              onMouseEnter={() => enter(s.id)}
              onFocus={() => setOpenId(s.id)}
              onClick={() => { setOpenId(null); go(navTarget(s.label)) }}
              className={cn(
                'relative whitespace-nowrap px-2.5 py-1.5 text-[14px] transition-colors duration-120',
                openId === s.id ? 'text-ink' : 'text-ink-2 hover:text-ink',
              )}
            >
              {s.label}
              {openId === s.id && <span className="absolute inset-x-2.5 -bottom-[17px] h-[2px] bg-ink" />}
            </button>
          ))}
        </nav>

        <div className="ml-auto hidden min-w-[200px] flex-1 max-w-[480px] md:block">
          <PredictiveSearch />
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1 md:ml-2">
          <span className="hidden items-center gap-1.5 whitespace-nowrap pr-2 text-[12.5px] text-ink-3 xl:flex" title={TREND_NOTE}>
            <span className="inline-block h-1.5 w-1.5 bg-check" aria-hidden />
            Trends: {trendStatus()}
          </span>

          <div className="relative">
            <button
              type="button"
              aria-haspopup="listbox"
              aria-expanded={ccyOpen}
              onClick={() => setCcyOpen((v) => !v)}
              className="reading h-9 whitespace-nowrap px-2 text-[12.5px] text-ink-2 hover:text-ink"
            >
              {currency}
            </button>
            <AnimatePresence>
              {ccyOpen && (
                <motion.ul
                  role="listbox"
                  initial={{ opacity: 0, y: -2 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -2 }}
                  transition={{ duration: 0.12 }}
                  className="absolute right-0 top-[calc(100%+6px)] z-50 w-44 border border-ink bg-sheet"
                >
                  {(Object.keys(CURRENCIES) as Currency[]).map((c) => (
                    <li key={c} role="option" aria-selected={c === currency}>
                      <button
                        type="button"
                        onClick={() => { setCurrency(c); setCcyOpen(false) }}
                        className={cn('flex w-full items-center justify-between px-3 py-2 text-[13px]', c === currency ? 'bg-paper text-ink' : 'text-ink-2 hover:bg-paper hover:text-ink')}
                      >
                        <span className="reading">{c}</span>
                        <span className="text-[12px] text-ink-3">{CURRENCIES[c].region}</span>
                      </button>
                    </li>
                  ))}
                </motion.ul>
              )}
            </AnimatePresence>
          </div>

          <button type="button" onClick={() => setAdvisor(true)} className="hidden h-9 items-center whitespace-nowrap border border-ink px-3 text-[13px] font-medium text-ink transition-colors hover:bg-ink hover:text-paper sm:flex">
            Trend Scout
          </button>

          <button type="button" className="h-9 w-9 text-ink md:hidden" aria-label="Search" onClick={() => setMobileSearch((v) => !v)}>
            <Search size={18} strokeWidth={1.75} className="mx-auto" />
          </button>

          <button type="button" onClick={() => go({ name: 'account' })} aria-label="Account" className="hidden h-9 w-9 text-ink lg:block">
            <User size={18} strokeWidth={1.75} className="mx-auto" />
          </button>

          <button
            type="button"
            onClick={() => openCart(true)}
            aria-label={`Cart, ${count} items`}
            className="flex h-9 items-center gap-1.5 px-2 text-ink"
          >
            <ShoppingBag size={18} strokeWidth={1.75} />
            <span className="reading text-[13px]">{count}</span>
          </button>
        </div>
      </div>

      <AnimatePresence>
        {mobileSearch && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.16 }} className="overflow-visible border-t border-rule px-4 py-3 md:hidden">
            <PredictiveSearch />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative hidden lg:block" onMouseEnter={stay} onMouseLeave={leave}>
        <AnimatePresence>{section && <MegaMenu section={section} onClose={() => setOpenId(null)} />}</AnimatePresence>
      </div>

      <AnimatePresence>
        {mobileNav && (
          <>
            <motion.div className="fixed inset-0 z-40 bg-ink/30" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMobileNav(false)} />
            <motion.aside
              role="dialog"
              aria-modal="true"
              aria-label="Menu"
              initial={{ x: -320 }}
              animate={{ x: 0 }}
              exit={{ x: -320 }}
              transition={{ type: 'spring', stiffness: 420, damping: 38 }}
              className="fixed inset-y-0 left-0 z-50 w-[300px] max-w-[85vw] overflow-y-auto border-r border-ink bg-sheet p-5"
            >
              <div className="flex items-center justify-between">
                <Logo onClick={() => { go({ name: 'home' }); setMobileNav(false) }} />
                <button type="button" aria-label="Close menu" onClick={() => setMobileNav(false)} className="p-2 text-ink"><X size={18} /></button>
              </div>
              <nav className="mt-6 divide-y divide-rule" aria-label="Mobile">
                {nav.map((s) => (
                  <div key={s.id} className="py-3">
                    <div className="text-[15px] font-medium text-ink">{s.label}</div>
                    <ul className="mt-1 space-y-0.5">
                      {s.columns[0].items.map((i) => (
                        <li key={i}><a href="#" onClick={(e) => { e.preventDefault(); setMobileNav(false); go(navTarget(i)) }} className="block py-0.5 text-[14px] text-ink-2 hover:text-ink">{i}</a></li>
                      ))}
                    </ul>
                  </div>
                ))}
              </nav>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </header>
  )
}
