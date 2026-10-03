/*
  Trend Scout — the AI advisor pane. In production this is the Vercel AI SDK `useChat` against a
  Claude tool-calling route (search_products, get_trends, check_setup, price_kit). Here the model turn
  is scripted; the budget solver, trend ranking and setup check are real.
*/
import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowUp, Check, X } from 'lucide-react'
import { byId, Product, productById, products, trendNote } from '../lib/data'
import { fmt } from '../lib/currency'
import { useSetup, useStore, useZone } from '../lib/store'
import { checkBuild, CompatResult, resolveFacts } from '../lib/compat'
import { ProductImage } from './ProductVisual'
import { Sparkline } from './ProductCard'
import { Button, Tile } from './ui'
import { etaText } from '../lib/shipping'
import { cn } from '../lib/cn'
import { canBuy } from '../lib/office'

interface Role { role: string; why: string; options: string[]; optional?: boolean }
interface Kit { budget: number; roles: Role[] }
interface Msg { id: number; from: 'user' | 'ai'; text: string; kit?: Kit; trends?: string[]; check?: { product: Product; result: CompatResult } }

const PROMPTS = [
  'What is trending this week?',
  'Movie night setup under $2,000',
  'Gift for a runner under $600',
  'Does the MoGo 4 Laser work with my setup?',
]

function plan(prompt: string, owned: { id: string; name: string; facts: Product['facts'] }[]): Omit<Msg, 'id' | 'from'> {
  const p = prompt.toLowerCase()
  const m = p.match(/\$\s?(\d[\d,]*)/)
  const budget = m ? Number(m[1].replace(/,/g, '')) : 2000

  const named = products.find((x) => p.includes(x.name.toLowerCase()) || p.includes(`${x.brand} ${x.name}`.toLowerCase()))
  if (named && /(work|compatible|setup|phone|home|plug|switch)/.test(p)) {
    const result = checkBuild({ name: named.name, facts: resolveFacts(named, {}), product: named }, owned)
    const text =
      result.status === 'ok'
        ? `Yes. I checked the ${named.brand} ${named.name} against the ${owned.length} items in your setup: app, magnets, finder network, home hub, plug and power all pass.`
        : result.status === 'warn'
          ? `Mostly. The ${named.brand} ${named.name} works with your setup, with ${result.issues.length} thing${result.issues.length > 1 ? 's' : ''} to sort out first.`
          : `Not as configured. The ${named.brand} ${named.name} has ${result.issues.filter((i) => i.severity === 'bad').length} blocker${result.issues.filter((i) => i.severity === 'bad').length > 1 ? 's' : ''} with your setup.`
    return { text, check: { product: named, result } }
  }

  if (/(trend|viral|hot|popular|taking off|this week)/.test(p)) {
    const cat = /(smart home|home)/.test(p) ? 'Smart home' : /(wearable|ring|glasses)/.test(p) ? 'Wearables' : null
    const pool = cat ? products.filter((x) => x.category === cat) : products
    const top = [...pool].sort((a, b) => b.trend.delta - a.trend.delta).slice(0, 5).map((x) => x.id)
    return {
      text: cat
        ? `${cat} this week, ranked by 7-day search and social velocity. Figures are growth in interest, not sales.`
        : `Across the catalogue this week, ranked by 7-day search and social velocity. ${trendNote()}`,
      trends: top,
    }
  }

  if (/(movie|cinema|projector|film)/.test(p)) {
    return {
      text: `A movie-night kit under ${fmt(budget, 'AUD', { compact: true })}: a projector, a 100-inch screen for the yard, and a charger that keeps the battery topped up mid-film. Checked against your setup.`,
      kit: { budget, roles: [
        { role: 'Projector', why: 'Triple-laser 1080p with Google TV; the Vibe One is the cheaper LCD fallback', options: ['xgimi-mogo-4-laser', 'xgimi-vibe-one'] },
        { role: 'Screen', why: '100-inch matte white frame, folds into its bag', options: ['elite-yard-master-2-100'] },
        { role: 'Power', why: '100 W GaN, two USB-C, covers the 65 W draw with room to spare', options: ['anker-prime-100w'], optional: true },
      ] },
    }
  }

  if (/(gift|runner|run|present)/.test(p)) {
    return {
      text: `Gift for a runner under ${fmt(budget, 'AUD', { compact: true })}: open-ear buds are the safe pick because they work with any phone and do not block traffic noise. I added a finder tag and the ring as optional extras if the budget allows.`,
      kit: { budget, roles: [
        { role: 'Earbuds', why: 'Open-ear clip-ons, 9 h, IPX4', options: ['bose-ultra-open-2'] },
        { role: 'Tracker', why: 'For keys on the run, Find My or Find Hub', options: ['chipolo-pop'], optional: true },
        { role: 'Recovery', why: 'Sleep and HRV, 14 days a charge, no subscription', options: ['ringconn-gen-3'], optional: true },
      ] },
    }
  }

  return {
    text: `A desk upgrade under ${fmt(budget, 'AUD', { compact: true })}: a light strip for the wall, a camera for the room, and a magnetic power bank for the desk edge. Everything is checked against the phone and hub in your setup.`,
    kit: { budget, roles: [
      { role: 'Lighting', why: 'Matter over Thread, 2,200 lm', options: ['nanoleaf-matter-strip-5m'] },
      { role: 'Camera', why: 'Apple Home, Google Home or Alexa, microSD, no cloud fee', options: ['aqara-camera-e1'] },
      { role: 'Power', why: 'Qi2 magnetic, kickstand, 27 W USB-C', options: ['anker-maggo-10k'], optional: true },
      { role: 'Hub', why: 'Only if you lack a Thread border router', options: ['aqara-hub-m3'], optional: true },
    ] },
  }
}

/* Deterministic budget solver: keep only what can be bought, drop optional roles, then downgrade from the bottom, then drop. */
function solve(kit: Kit, swaps: Record<string, number>) {
  const stocked = kit.roles.map((r) => ({ ...r, options: r.options.filter((id) => canBuy(byId(id))) }))
  const unstocked = stocked.filter((r) => r.options.length === 0).map((r) => r.role)
  const choice = stocked.filter((r) => r.options.length > 0).map((r) => ({ role: r, idx: Math.min(swaps[r.role] ?? 0, r.options.length - 1) }))
  const total = () => choice.reduce((n, c) => n + (c.idx < 0 ? 0 : byId(c.role.options[c.idx]).price), 0)
  const pinned = (c: { role: Role }) => swaps[c.role.role] !== undefined
  for (let i = choice.length - 1; i >= 0 && total() > kit.budget; i--) if (choice[i].role.optional && !pinned(choice[i])) choice[i].idx = -1
  for (let i = choice.length - 1; i >= 0 && total() > kit.budget; i--) {
    const c = choice[i]
    if (c.idx < 0 || pinned(c)) continue
    while (total() > kit.budget && c.idx < c.role.options.length - 1) c.idx++
  }
  for (let i = choice.length - 1; i >= 0 && total() > kit.budget; i--) if (!pinned(choice[i])) choice[i].idx = -1
  const picks = choice.filter((c) => c.idx >= 0).map((c) => ({ role: c.role, product: byId(c.role.options[c.idx]) }))
  return { picks, total: total(), dropped: choice.filter((c) => c.idx < 0).map((c) => c.role.role), unstocked }
}

function KitCard({ kit }: { kit: Kit }) {
  const currency = useStore((s) => s.currency)
  const zone = useZone()
  const add = useStore((s) => s.add)
  const go = useStore((s) => s.go)
  const toast = useStore((s) => s.toast)
  const owned = useSetup()
  const [swaps, setSwaps] = useState<Record<string, number>>({})
  const [shown, setShown] = useState(0)
  const [added, setAdded] = useState(false)
  const { picks, total, dropped, unstocked } = useMemo(() => solve(kit, swaps), [kit, swaps])

  useEffect(() => {
    if (shown >= picks.length) return
    const id = window.setTimeout(() => setShown((n) => n + 1), 320)
    return () => window.clearTimeout(id)
  }, [shown, picks.length])

  const compat = useMemo(() => {
    const items = picks.map((p) => ({ id: p.product.id, name: p.product.name, facts: resolveFacts(p.product, {}), product: p.product }))
    const results = items.map((s) => checkBuild({ name: s.name, facts: s.facts, product: s.product }, [...owned, ...items.filter((x) => x !== s)]))
    const issues = results.flatMap((r) => r.issues)
    return { status: issues.some((i) => i.severity === 'bad') ? 'bad' : issues.length ? 'warn' : 'ok', issues, checked: owned.length + items.length }
  }, [picks, owned])

  const pct = Math.min(100, (total / kit.budget) * 100)
  const over = total > kit.budget

  return (
    <div className="mt-3 border border-rule bg-sheet">
      <div className="border-b border-rule px-4 py-3">
        <div className="flex items-baseline justify-between">
          <span className="text-[13px] text-ink">Kit total</span>
          <span className="reading text-[15px] text-ink">{fmt(total, currency, { compact: true })} <span className="text-[11px] text-ink-3">of {fmt(kit.budget, currency, { compact: true })}</span></span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden bg-rule" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label="Budget used">
          <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ type: 'spring', stiffness: 120, damping: 20 }} className={cn('h-full', over ? 'bg-fail' : 'bg-signal')} />
        </div>
        <div className="mt-1.5 text-[12px] text-ink-3">{over ? `${fmt(total - kit.budget, currency, { compact: true })} over budget` : `${fmt(kit.budget - total, currency, { compact: true })} under budget`}{dropped.length ? `, left out ${dropped.join(', ').toLowerCase()} to fit` : ''}{unstocked.length ? `${picks.length ? ', ' : '. '}${unstocked.join(', ').toLowerCase()} not stocked yet` : ''}</div>
      </div>
      <ul className="divide-y divide-rule">
        <AnimatePresence initial={false}>
          {picks.slice(0, shown).map(({ role, product }) => (
            <motion.li key={role.role + product.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 px-4 py-2.5">
              <div className="h-11 w-14 shrink-0 bg-paper"><ProductImage product={product} /></div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-[11.5px] text-ink-3">{role.role}</span>
                  <button type="button" onClick={() => go({ name: 'product', id: product.id })} className="truncate text-[13.5px] font-medium text-ink hover:underline underline-offset-4">{product.brand} {product.name}</button>
                </div>
                <div className="truncate text-[12px] text-ink-2">{role.why}, {etaText(product.fulfil.origin, zone)}</div>
              </div>
              <div className="shrink-0 text-right">
                <div className="reading text-[12.5px] text-ink">{fmt(product.price, currency, { compact: true })}</div>
                {role.options.length > 1 && (
                  <button type="button" onClick={() => setSwaps((s) => ({ ...s, [role.role]: ((s[role.role] ?? role.options.indexOf(product.id)) + 1) % role.options.length }))} className="mt-0.5 text-[11.5px] text-ink-3 underline underline-offset-4 hover:text-ink">Swap</button>
                )}
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
        {shown < picks.length && <li className="px-4 py-3"><div className="skeleton h-10" /></li>}
      </ul>
      {shown >= picks.length && (
        <div className={cn('flex items-center gap-2 border-t border-rule px-4 py-2 text-[12.5px]', compat.status === 'ok' ? 'bg-pass-tint text-pass' : compat.status === 'warn' ? 'bg-check-tint text-check' : 'bg-fail-tint text-fail')}>
          <span className={cn('h-2 w-2 shrink-0', compat.status === 'ok' ? 'bg-pass' : compat.status === 'warn' ? 'bg-check' : 'bg-fail')} aria-hidden />
          <span className="truncate">{compat.status === 'ok' ? `Works with your setup, ${compat.checked} items checked` : compat.issues[0].title}</span>
        </div>
      )}
      <div className="flex gap-2 border-t border-rule p-3">
        <Button variant="primary" className="flex-1" disabled={shown < picks.length || picks.length === 0} onClick={() => { picks.forEach((p) => add(p.product, p.product.variants[0].id)); useStore.getState().openCart(false); setAdded(true); toast({ title: `Added ${picks.length} items to your cart`, body: 'Each item was re-checked against your setup.' }) }}>
          {added ? <><Check size={15} strokeWidth={2.5} /> Kit added</> : 'Add kit to cart'}
        </Button>
        <Button variant="secondary" onClick={() => toast({ title: 'Kit saved', body: 'nexus.store/k/7Qx2 copied to clipboard.' })}>Save</Button>
      </div>
    </div>
  )
}

function TrendCard({ ids }: { ids: string[] }) {
  const go = useStore((s) => s.go)
  const currency = useStore((s) => s.currency)
  const zone = useZone()
  return (
    <ul className="mt-3 divide-y divide-rule border border-rule bg-sheet">
      {ids.map((id, i) => {
        const p = byId(id)
        return (
          <li key={id} className="flex items-center gap-3 px-3 py-2.5">
            <span className="reading w-4 text-[11px] text-ink-3">{i + 1}</span>
            <div className="h-10 w-12 shrink-0 bg-paper"><ProductImage product={p} /></div>
            <div className="min-w-0 flex-1">
              <button type="button" onClick={() => go({ name: 'product', id })} className="block truncate text-[13.5px] font-medium text-ink hover:underline underline-offset-4">{p.brand} {p.name}</button>
              <div className="truncate text-[12px] text-ink-3">{p.category}, {fmt(p.price, currency, { compact: true })}, {etaText(p.fulfil.origin, zone)}</div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Sparkline series={p.trend.series} />
              <Tile>+{p.trend.delta}%</Tile>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function CheckCard({ product, result }: { product: Product; result: CompatResult }) {
  const go = useStore((s) => s.go)
  return (
    <div className="mt-3 border border-rule bg-sheet">
      <button type="button" onClick={() => go({ name: 'product', id: product.id })} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-paper">
        <div className="h-10 w-12 shrink-0 bg-paper"><ProductImage product={product} /></div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13.5px] font-medium text-ink">{product.brand} {product.name}</div>
          <div className={cn('text-[12px]', result.status === 'ok' ? 'text-pass' : result.status === 'warn' ? 'text-check' : 'text-fail')}>{result.summary}</div>
        </div>
      </button>
      {result.issues.length > 0 && (
        <ul className="divide-y divide-rule border-t border-rule">
          {result.issues.map((i) => (
            <li key={i.id} className="flex items-start gap-2 px-3 py-2 text-[12.5px]">
              <span className={cn('mt-1.5 h-2 w-2 shrink-0', i.severity === 'bad' ? 'bg-fail' : 'bg-check')} aria-hidden />
              <div><div className="font-medium text-ink">{i.title}</div><div className="text-ink-2">{i.because}</div></div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function Advisor() {
  const open = useStore((s) => s.advisorOpen)
  const close = () => useStore.getState().setAdvisor(false)
  const route = useStore((s) => s.route)
  const owned = useSetup()
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const scroller = useRef<HTMLDivElement>(null)
  const seq = useRef(0)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  useEffect(() => { scroller.current?.scrollTo({ top: 1e6, behavior: 'smooth' }) }, [msgs, thinking])

  const send = (text: string) => {
    if (!text.trim() || thinking) return
    setMsgs((m) => [...m, { id: ++seq.current, from: 'user', text }])
    setInput('')
    setThinking(true)
    window.setTimeout(() => {
      const r = plan(text, owned)
      setMsgs((m) => [...m, { id: ++seq.current, from: 'ai', ...r }])
      setThinking(false)
    }, 900)
  }

  const viewing = route.name === 'product' ? productById(route.id) : undefined
  const context = viewing ? `Viewing ${viewing.brand} ${viewing.name}` : 'Home'

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="fixed inset-0 z-50 bg-ink/30 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close} />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="advisor-title"
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 40, opacity: 0, transition: { duration: 0.16 } }}
            transition={{ type: 'spring', stiffness: 400, damping: 36 }}
            className="fixed bottom-0 right-0 top-0 z-50 flex w-full max-w-[420px] flex-col border-l border-ink bg-sheet lg:top-[72px] lg:bottom-4 lg:right-4 lg:border"
            style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
          >
            <div className="flex items-center justify-between border-b border-ink px-4 py-3">
              <div>
                <h2 id="advisor-title" className="text-[16px] font-medium text-ink">Trend Scout</h2>
                <div className="text-[12px] text-ink-3">Live stock, your setup, {context}</div>
              </div>
              <button type="button" aria-label="Close advisor" onClick={close} className="p-2 text-ink"><X size={17} /></button>
            </div>

            <div ref={scroller} className="panel-scroll flex-1 overflow-y-auto px-4 py-4">
              {msgs.length === 0 && (
                <div>
                  <p className="text-[14px] leading-relaxed text-ink-2">Ask what is taking off, what to get someone, or whether something works with your phone and home. I only recommend what is in stock, and every kit is checked against your setup before you see it.</p>
                  <div className="mt-4 border border-rule">
                    {PROMPTS.map((p) => (
                      <button key={p} type="button" onClick={() => send(p)} className="block w-full border-b border-rule px-3 py-2.5 text-left text-[13.5px] text-ink last:border-b-0 hover:bg-paper">
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="space-y-4">
                {msgs.map((m) => (
                  <div key={m.id} className={cn('flex', m.from === 'user' ? 'justify-end' : 'justify-start')}>
                    <div className={cn('max-w-[92%]', m.from === 'user' ? 'bg-ink px-3.5 py-2 text-[13.5px] text-paper' : 'w-full')}>
                      {m.from === 'ai' ? (
                        <div>
                          <p className="text-[13.5px] leading-relaxed text-ink-2">{m.text}</p>
                          {m.kit && <KitCard kit={m.kit} />}
                          {m.trends && <TrendCard ids={m.trends} />}
                          {m.check && <CheckCard product={m.check.product} result={m.check.result} />}
                        </div>
                      ) : m.text}
                    </div>
                  </div>
                ))}
                {thinking && (
                  <div className="flex items-center gap-1.5 text-ink-3" aria-live="polite" aria-label="Trend Scout is thinking">
                    {[0, 1, 2].map((i) => <motion.span key={i} animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: i * 0.18 }} className="h-1.5 w-1.5 bg-signal" />)}
                    <span className="ml-1 text-[12px]">reading trend signals, checking your setup</span>
                  </div>
                )}
              </div>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); send(input) }} className="border-t border-ink p-3" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}>
              <div className="flex items-center gap-2 border border-rule-2 bg-sheet pl-3 pr-1.5 focus-within:border-ink">
                <input id="advisor-input" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask about a trend, a gift, or your setup…" aria-label="Message the Trend Scout" className="h-11 min-w-0 flex-1 bg-transparent text-[14px] text-ink placeholder:text-ink-3 focus:outline-none" />
                <button type="submit" aria-label="Send" disabled={!input.trim() || thinking} className="grid h-8 w-8 place-items-center bg-ink text-paper disabled:opacity-40"><ArrowUp size={16} strokeWidth={2.5} /></button>
              </div>
            </form>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
