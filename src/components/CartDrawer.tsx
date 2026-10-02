import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, Minus, Plus, X } from 'lucide-react'
import { byId, gear } from '../lib/data'
import { CURRENCIES, Currency, fmt, shippingCost, taxOf } from '../lib/currency'
import { cartSubtotal, useStore } from '../lib/store'
import { checkBuild, resolveFacts } from '../lib/compat'
import { ProductImage } from './ProductVisual'
import { Button } from './ui'
import { cn } from '../lib/cn'

function useFocusTrap(active: boolean) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!active) return
    const prev = document.activeElement as HTMLElement | null
    const node = ref.current
    const q = 'button, [href], input, select, [tabindex]:not([tabindex="-1"])'
    node?.querySelector<HTMLElement>(q)?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !node) return
      const items = Array.from(node.querySelectorAll<HTMLElement>(q)).filter((el) => !el.hasAttribute('disabled'))
      if (!items.length) return
      const first = items[0], last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('keydown', onKey); prev?.focus?.() }
  }, [active])
  return ref
}

const STATE = {
  ok: { mark: 'bg-pass', text: 'text-pass', tint: 'bg-pass-tint' },
  warn: { mark: 'bg-check', text: 'text-check', tint: 'bg-check-tint' },
  bad: { mark: 'bg-fail', text: 'text-fail', tint: 'bg-fail-tint' },
}

export function CartDrawer() {
  const open = useStore((s) => s.cartOpen)
  const close = () => useStore.getState().openCart(false)
  const cart = useStore((s) => s.cart)
  const setQty = useStore((s) => s.setQty)
  const remove = useStore((s) => s.remove)
  const lastAdded = useStore((s) => s.lastAdded)
  const currency = useStore((s) => s.currency)
  const setCurrency = useStore((s) => s.setCurrency)
  const shipMethod = useStore((s) => s.shipMethod)
  const setShipMethod = useStore((s) => s.setShipMethod)
  const gearOn = useStore((s) => s.gearOn)
  const toast = useStore((s) => s.toast)
  const [placing, setPlacing] = useState<null | 'express' | 'oneclick' | 'done'>(null)
  const trap = useFocusTrap(open)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [open])

  const subtotal = cartSubtotal(cart)
  const info = CURRENCIES[currency]
  const shipping = cart.length ? shippingCost(subtotal, shipMethod, info.region) : 0
  const tax = taxOf(subtotal + shipping, currency)
  const total = subtotal + shipping + (tax.included ? 0 : tax.amount)
  const parcels = new Set(cart.map((l) => byId(l.productId).fulfil.route)).size

  const compat = useMemo(() => {
    if (!cart.length) return null
    const owned = gear.filter((g) => gearOn[g.id]).map((g) => ({ id: g.id, name: g.name, facts: g.facts }))
    const lines = cart.map((l) => ({ id: l.key, name: byId(l.productId).name, facts: resolveFacts(byId(l.productId), l.selection), product: byId(l.productId) }))
    const results = lines.map((subject) => checkBuild({ name: subject.name, facts: subject.facts, product: subject.product }, [...owned, ...lines.filter((x) => x.id !== subject.id)]))
    const issues = results.flatMap((r) => r.issues)
    const status = issues.some((i) => i.severity === 'bad') ? 'bad' : issues.length ? 'warn' : 'ok'
    return { status, issues, count: cart.length + owned.length } as const
  }, [cart, gearOn])

  const placeOrder = (kind: 'express' | 'oneclick') => {
    setPlacing(kind)
    window.setTimeout(() => {
      setPlacing('done')
      window.setTimeout(() => {
        useStore.setState({ cart: [] })
        setPlacing(null)
        close()
        toast({ title: 'Order placed, NX-48213', body: 'Local items ship today; supplier items go to the partner. Undo within 5 seconds to cancel.', action: { label: 'Undo', onClick: () => toast({ title: 'Order cancelled', body: 'Nothing was charged.' }) } })
      }, 900)
    }, 1100)
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="fixed inset-0 z-50 bg-ink/30" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }} onClick={close} />
          <motion.aside
            ref={trap}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cart-title"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%', transition: { type: 'spring', stiffness: 420, damping: 40 } }}
            transition={{ type: 'spring', stiffness: 380, damping: 36 }}
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[460px] flex-col border-l border-ink bg-sheet"
            style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
          >
            <div className="flex items-center justify-between border-b border-ink px-5 py-3.5">
              <div>
                <h2 id="cart-title" className="text-[18px] font-medium text-ink">Cart</h2>
                <div className="text-[12.5px] text-ink-3">{cart.reduce((n, l) => n + l.qty, 0)} items, held for 15 minutes</div>
              </div>
              <button type="button" onClick={close} aria-label="Close cart" className="p-2 text-ink"><X size={18} /></button>
            </div>

            {compat && (
              <div className={cn('flex items-start gap-3 border-b border-rule px-5 py-2.5 text-[13px]', STATE[compat.status].tint)} role="status" aria-live="polite">
                <span className={cn('mt-1.5 h-2.5 w-2.5 shrink-0', STATE[compat.status].mark)} aria-hidden />
                <div className="min-w-0">
                  <div className={cn('font-medium', STATE[compat.status].text)}>
                    {compat.status === 'ok' ? `Everything works with your setup, ${compat.count} items checked` : compat.issues[0].title}
                  </div>
                  {compat.status !== 'ok' && <div className="text-ink-2">{compat.issues[0].because}</div>}
                </div>
              </div>
            )}

            <div className="panel-scroll flex-1 overflow-y-auto">
              {cart.length === 0 ? (
                <div className="flex h-full flex-col items-start justify-center gap-3 px-6 py-16">
                  <div className="display-md text-[26px] text-ink">Nothing in the cart yet.</div>
                  <p className="max-w-[30ch] text-[14px] text-ink-2">Add something, or ask the Trend Scout what is taking off this week.</p>
                  <Button variant="secondary" size="sm" onClick={() => { close(); useStore.getState().setAdvisor(true) }}>Ask the Trend Scout</Button>
                </div>
              ) : (
                <ul>
                  <AnimatePresence initial={false}>
                    {cart.map((l) => {
                      const p = byId(l.productId)
                      const v = p.variants.find((x) => x.id === l.variantId) ?? p.variants[0]
                      const sel = (p.options ?? []).map((g) => g.choices.find((c) => c.id === l.selection[g.id])?.label).filter(Boolean)
                      const hot = lastAdded === l.key
                      return (
                        <motion.li
                          key={l.key}
                          layout
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1, backgroundColor: hot ? '#ffd9cd' : '#ffffff' }}
                          exit={{ opacity: 0, height: 0, transition: { duration: 0.16 } }}
                          transition={{ duration: 0.2 }}
                          className="flex gap-3 border-b border-rule px-5 py-3"
                        >
                          <div className="h-16 w-20 shrink-0 bg-paper"><ProductImage product={p} hue={v.hue} swatch={v.swatch} /></div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="truncate text-[14px] font-medium text-ink">{p.brand} {p.name}</div>
                                <div className="truncate text-[12.5px] text-ink-3">{[v.label, ...sel].join(', ')}</div>
                                <div className={cn('text-[12px]', p.fulfil.route === 'warehouse' ? 'text-pass' : 'text-ink-3')}>{p.fulfil.route === 'warehouse' ? 'Sydney stock' : 'Supplier direct'}, {p.fulfil.eta}</div>
                              </div>
                              <div className="reading shrink-0 text-[14px] text-ink">{fmt(l.unitPrice * l.qty, currency, { compact: true })}</div>
                            </div>
                            <div className="mt-2 flex items-center justify-between">
                              <div className="flex items-center border border-rule-2">
                                <button type="button" aria-label="Decrease quantity" onClick={() => setQty(l.key, l.qty - 1)} className="grid h-7 w-7 place-items-center text-ink-2 hover:bg-paper hover:text-ink"><Minus size={13} /></button>
                                <span className="reading w-7 text-center text-[13px] text-ink" aria-live="polite">{l.qty}</span>
                                <button type="button" aria-label="Increase quantity" onClick={() => setQty(l.key, l.qty + 1)} className="grid h-7 w-7 place-items-center text-ink-2 hover:bg-paper hover:text-ink"><Plus size={13} /></button>
                              </div>
                              <button type="button" onClick={() => remove(l.key)} className="text-[12.5px] text-ink-3 underline underline-offset-4 hover:text-fail">Remove</button>
                            </div>
                          </div>
                        </motion.li>
                      )
                    })}
                  </AnimatePresence>
                </ul>
              )}
            </div>

            {cart.length > 0 && (
              <div className="border-t border-ink bg-paper px-5 pb-4 pt-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex border border-rule-2 bg-sheet" role="radiogroup" aria-label="Shipping method">
                    {(['standard', 'express'] as const).map((m) => (
                      <button key={m} type="button" role="radio" aria-checked={shipMethod === m} onClick={() => setShipMethod(m)} className={cn('px-2.5 py-1 text-[12.5px] transition-colors', shipMethod === m ? 'bg-ink text-paper' : 'text-ink-2 hover:text-ink')}>
                        {m === 'standard' ? 'Standard, as listed' : 'Express, next day'}
                      </button>
                    ))}
                  </div>
                  <label className="flex items-center gap-1.5 text-[12px] text-ink-3">
                    <span className="sr-only">Currency</span>
                    <select id="cart-currency" value={currency} onChange={(e) => setCurrency(e.target.value as Currency)} className="reading h-7 border border-rule-2 bg-sheet px-2 text-[12px] text-ink">
                      {(Object.keys(CURRENCIES) as Currency[]).map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </label>
                </div>

                {/* receipt */}
                <dl className="reading mt-3 text-[12.5px] text-ink-2">
                  <div className="flex justify-between py-0.5"><dt>Subtotal</dt><dd>{fmt(subtotal, currency)}</dd></div>
                  <div className="flex justify-between py-0.5"><dt>Shipping to {info.region}{parcels > 1 ? `, ${parcels} parcels` : ''}</dt><dd>{shipping === 0 ? 'Free' : fmt(shipping, currency)}</dd></div>
                  <div className="flex justify-between py-0.5"><dt>{info.taxLabel}</dt><dd>{fmt(tax.amount, currency)}</dd></div>
                  <div className="mt-1 flex items-baseline justify-between border-t border-ink pt-2 text-ink">
                    <dt className="font-sans text-[14px] font-medium">Total</dt>
                    <dd className="text-[18px]" aria-live="polite">{fmt(total, currency)}</dd>
                  </div>
                </dl>

                <div className="mt-3 grid grid-cols-3 gap-px bg-rule-2 border border-rule-2">
                  <button type="button" onClick={() => placeOrder('express')} className="h-10 bg-ink text-[13px] font-medium text-paper">Apple Pay</button>
                  <button type="button" onClick={() => placeOrder('express')} className="h-10 bg-sheet text-[13px] font-medium text-ink hover:bg-paper">Google Pay</button>
                  <button type="button" onClick={() => placeOrder('express')} className="h-10 bg-sheet text-[13px] font-medium text-ink hover:bg-paper">Crypto</button>
                </div>

                <button type="button" onClick={() => placeOrder('oneclick')} disabled={placing !== null} className="mt-2 flex h-12 w-full items-center justify-between bg-ink px-4 text-paper hover:bg-[#1f2730] disabled:opacity-80">
                  <span className="flex items-center gap-2 text-[14px] font-medium">
                    {placing === 'done' && <Check size={16} strokeWidth={2.5} />}
                    {placing === null ? 'Buy now' : placing === 'done' ? 'Order placed' : 'Authorising'}
                  </span>
                  <span className="text-[12px] opacity-80">Home address, Visa 4242</span>
                </button>
                <button type="button" className="mt-2 h-10 w-full border border-ink text-[13.5px] font-medium text-ink hover:bg-ink hover:text-paper">Full checkout</button>
                <p className="mt-2 text-[11.5px] text-ink-3">Prices held in {currency} for this session. 30-day returns on both routes.</p>
              </div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
