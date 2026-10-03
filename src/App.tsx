import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Home as HomeIcon, Search, ShoppingBag, TrendingUp, User, X } from 'lucide-react'
import { productById } from './lib/data'
import { formatRoute, pageKey, parseRoute, Route } from './lib/routes'
import { NotFoundPage } from './pages/NotFoundPage'
import { CollectionPage } from './pages/CollectionPage'
import { SetupPage } from './pages/SetupPage'
import { ComparePage } from './pages/ComparePage'
import { CheckoutPage } from './pages/CheckoutPage'
import { ConfirmedPage } from './pages/ConfirmedPage'
import { AccountPage } from './pages/AccountPage'
import { OrderPage, OrdersPage } from './pages/OrdersPage'
import { GuidePage, GuidesPage } from './pages/GuidesPage'
import { HowWePickPage } from './pages/HowWePickPage'
import { collectionBySlug, FOOTER } from './lib/collections'
import { cartCount, useStore } from './lib/store'
import { Header } from './components/Header'
import { Home } from './components/Home'
import { ProductPage } from './components/ProductPage'
import { CartDrawer } from './components/CartDrawer'
import { QuickView } from './components/QuickView'
import { Advisor } from './components/Advisor'
import { ProductImage } from './components/ProductVisual'
import { Button } from './components/ui'
import { cn } from './lib/cn'

function Toasts() {
  const toasts = useStore((s) => s.toasts)
  const dismiss = useStore((s) => s.dismissToast)
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6" aria-live="polite">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.16 }}
            className="pointer-events-auto flex w-full max-w-[440px] items-center gap-3 border border-ink bg-sheet px-4 py-3"
          >
            <div className="min-w-0 flex-1">
              <div className="text-[13.5px] font-medium text-ink">{t.title}</div>
              {t.body && <div className="text-[12.5px] text-ink-2">{t.body}</div>}
            </div>
            {t.action && (
              <button type="button" onClick={() => { t.action!.onClick(); dismiss(t.id) }} className="border border-ink px-2.5 py-1 text-[12.5px] font-medium text-ink hover:bg-ink hover:text-paper">
                {t.action.label}
              </button>
            )}
            <button type="button" aria-label="Dismiss" onClick={() => dismiss(t.id)} className="text-ink-3 hover:text-ink"><X size={14} /></button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

function CompareTray() {
  const compare = useStore((s) => s.compare)
  const toggle = useStore((s) => s.toggleCompare)
  const go = useStore((s) => s.go)
  return (
    <AnimatePresence>
      {compare.length > 0 && (
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 40, opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed bottom-[76px] left-1/2 z-30 hidden -translate-x-1/2 items-center gap-3 border border-ink bg-sheet py-2 pl-3 pr-2 md:flex lg:bottom-6"
        >
          <span className="text-[13px] text-ink-2">Comparing {compare.length} of 4</span>
          <div className="flex gap-1">
            {compare.flatMap((id) => { const p = productById(id); return p ? [p] : [] }).map((p) => (
              <button key={p.id} type="button" onClick={() => toggle(p.id)} aria-label={`Remove ${p.name} from compare`} className="h-9 w-11 border border-rule bg-paper hover:border-ink">
                <ProductImage product={p} />
              </button>
            ))}
          </div>
          <Button size="sm" variant="primary" onClick={() => go({ name: 'compare', ids: compare })}>Compare</Button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function MobileTabBar() {
  const route = useStore((s) => s.route)
  const go = useStore((s) => s.go)
  const openCart = useStore((s) => s.openCart)
  const setAdvisor = useStore((s) => s.setAdvisor)
  const setSearchOpen = useStore((s) => s.setSearchOpen)
  const count = cartCount(useStore((s) => s.cart))
  const items = [
    { id: 'home', label: 'Home', icon: HomeIcon, on: route.name === 'home', act: () => go({ name: 'home' }) },
    { id: 'search', label: 'Search', icon: Search, on: false, act: () => { go({ name: 'home' }); setSearchOpen(true); window.setTimeout(() => document.getElementById('site-search')?.focus(), 50) } },
    { id: 'scout', label: 'Scout', icon: TrendingUp, on: false, act: () => setAdvisor(true) },
    { id: 'cart', label: 'Cart', icon: ShoppingBag, on: false, act: () => openCart(true), badge: count },
    { id: 'account', label: 'Account', icon: User, on: route.name === 'account', act: () => go({ name: 'account' }) },
  ]
  if (route.name === 'product' || route.name === 'checkout') return null
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-ink bg-paper lg:hidden" aria-label="Mobile" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <ul className="grid h-16 grid-cols-5">
        {items.map((i) => (
          <li key={i.id}>
            <button type="button" onClick={i.act} aria-current={i.on ? 'page' : undefined} className={cn('relative flex h-full w-full flex-col items-center justify-center gap-1 text-[11px]', i.on ? 'text-ink' : 'text-ink-3')}>
              {i.on && <span className="absolute inset-x-6 top-0 h-[2px] bg-signal" />}
              <span className="relative">
                <i.icon size={20} strokeWidth={1.75} />
                {i.badge ? <span className="reading absolute -right-2.5 -top-1.5 min-w-4 bg-signal px-1 text-center text-[10px] text-ink">{i.badge}</span> : null}
              </span>
              {i.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}

function Footer() {
  return (
    <footer className="mt-16 border-t border-ink">
      <div className="mx-auto grid max-w-[1440px] gap-8 px-4 py-10 md:grid-cols-5 md:px-6">
        <div className="md:col-span-2">
          <div className="display text-[28px] text-ink">Nexus</div>
          <p className="mt-2 max-w-[38ch] text-[13.5px] text-ink-2">Trending tech, specs and prices checked against the maker, checked against your phone, home and plug, and shipped from Sydney or straight from the maker.</p>
          <div className="mt-4 flex items-center gap-2 text-[12.5px] text-ink-3"><span className="inline-block h-1.5 w-1.5 bg-pass" /> All systems operational, status.nexus.store</div>
        </div>
        {FOOTER.map((g) => (
          <div key={g.title}>
            <div className="mb-2 text-[13px] text-ink-3">{g.title}</div>
            <ul className="space-y-1 text-[14px] text-ink">
              {g.items.map((i) => <li key={i.label}><a href={formatRoute(i.route)} onClick={(e) => { e.preventDefault(); useStore.getState().go(i.route) }} className="hover:underline underline-offset-4">{i.label}</a></li>)}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-rule">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-2 px-4 py-3 text-[12px] text-ink-3 md:px-6">
          <span>2026 Nexus Technologies Pty Ltd. Prototype.</span>
          <span>Privacy, Terms, Accessibility (WCAG 2.1 AA)</span>
        </div>
      </div>
    </footer>
  )
}

/* Route → page. Pages land here as the build adds them; until then a route renders the 404. */
function Page({ route }: { route: Route }) {
  switch (route.name) {
    case 'home': return <Home />
    case 'product': { const p = productById(route.id); return p ? <ProductPage key={p.id} product={p} /> : <NotFoundPage hash={formatRoute(route)} /> }
    case 'collection': {
      const c = collectionBySlug(route.slug)
      if (!c) return <NotFoundPage hash={formatRoute(route)} />
      return <CollectionPage key={c.slug} title={c.title} blurb={c.blurb} base={c.filters} filters={route.filters} sort={route.sort} defaultSort={c.sort} onChange={(filters, sort) => useStore.getState().go({ ...route, filters, sort })} />
    }
    case 'search': return <CollectionPage key={route.q} title={`Results for “${route.q}”`} base={{ text: route.q }} filters={route.filters} sort={route.sort} q={route.q} onChange={(filters, sort) => useStore.getState().go({ ...route, filters, sort })} />
    case 'setup': return <SetupPage />
    case 'compare': return <ComparePage ids={route.ids} />
    case 'checkout': return <CheckoutPage />
    case 'confirmed': return <ConfirmedPage id={route.id} />
    case 'account': return <AccountPage />
    case 'orders': return <OrdersPage />
    case 'order': return <OrderPage id={route.id} />
    case 'guides': return <GuidesPage />
    case 'guide': return <GuidePage slug={route.slug} />
    case 'how-we-pick': return <HowWePickPage />
    case 'not-found': return <NotFoundPage hash={route.hash} />
    default: return <NotFoundPage hash={formatRoute(route)} />
  }
}

export default function App() {
  const route = useStore((s) => s.route)

  useEffect(() => {
    const fromHash = () => {
      let next: Route
      try { next = parseRoute(location.hash) } catch { next = { name: 'not-found', hash: location.hash } }
      if (formatRoute(next) !== formatRoute(useStore.getState().route)) useStore.getState().go(next)
    }
    if (location.hash) fromHash()
    window.addEventListener('hashchange', fromHash)
    return () => window.removeEventListener('hashchange', fromHash)
  }, [])
  /* A new page is a history entry, so Back returns to the previous page; a filter or sort change on the same page replaces the entry. */
  useEffect(() => {
    const next = formatRoute(route)
    try {
      if (location.hash === next) return
      let prev: Route
      try { prev = parseRoute(location.hash) } catch { prev = { name: 'not-found', hash: location.hash } }
      if (pageKey(prev) === pageKey(route)) history.replaceState(null, '', next)
      else history.pushState(null, '', next)
    } catch { /* sandboxed frame */ }
  }, [route])

  return (
    <div className="min-h-screen bg-paper text-ink">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:bg-ink focus:px-3 focus:py-2 focus:text-paper">Skip to content</a>
      <Header />
      <main id="main">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={pageKey(route)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.1 } }} transition={{ duration: 0.16 }}>
            <Page route={route} />
          </motion.div>
        </AnimatePresence>
      </main>
      <Footer />
      <CartDrawer />
      <QuickView />
      <Advisor />
      <CompareTray />
      <Toasts />
      <MobileTabBar />
    </div>
  )
}
