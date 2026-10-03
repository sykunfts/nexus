/*
  Checkout: contact → delivery → shipping per parcel → payment → review → place order.
  Each section unlocks when the previous validates. Two paths share the form: the prototype validates a
  card and never charges; with the office configured, the supplier quotes the freight live and the
  money is taken on Stripe's page, so there is no card step here at all.
*/
import { useEffect, useMemo, useState } from 'react'
import { Check } from 'lucide-react'
import { byId, Origin } from '../lib/data'
import { fmt, ShipMethod } from '../lib/currency'
import { canExpress, COUNTRIES, Country, etaText, originLabel, regionOf, ZONE_LABEL, zoneOf } from '../lib/shipping'
import { newOrderId, Order, orderTotals, splitShipments, toOrderLines, Totals } from '../lib/orders'
import { AddressInput, validateAddress, validateCard, validEmail, errorSummary } from '../lib/validate'
import { checkBuild, resolveFacts } from '../lib/compat'
import { useSetup, useStore } from '../lib/store'
import { canBuy, FreightReply, office, OfficeClientError, quoteFreight, redirect, startCheckout } from '../lib/office'
import { AddressForm, emptyAddress } from '../components/AddressForm'
import { ProductImage } from '../components/ProductVisual'
import { Button } from '../components/ui'
import { cn } from '../lib/cn'

type Step = 'contact' | 'delivery' | 'shipping' | 'payment' | 'review'
const STEPS: { id: Step; title: string }[] = [
  { id: 'contact', title: 'Contact' }, { id: 'delivery', title: 'Delivery address' }, { id: 'shipping', title: 'Shipping' }, { id: 'payment', title: 'Payment' }, { id: 'review', title: 'Review and place order' },
]
const LIVE_STEPS = STEPS.filter((s) => s.id !== 'payment')
type QuoteStatus = 'idle' | 'loading' | 'ok' | 'no_freight' | 'error'

function Section({ n, title, open, done, summary, onEdit, children }: { n: number; title: string; open: boolean; done: boolean; summary?: string; onEdit?: () => void; children: React.ReactNode }) {
  return (
    <section className={cn('border bg-sheet', open ? 'border-ink' : 'border-rule')} aria-labelledby={`step-${n}`}>
      <div className="flex items-center justify-between gap-3 border-b border-rule px-4 py-3 sm:px-5">
        <h2 id={`step-${n}`} className="flex items-center gap-3 text-[15px] font-medium text-ink">
          <span className={cn('reading grid h-6 w-6 place-items-center text-[12px]', done ? 'bg-pass text-paper' : open ? 'bg-ink text-paper' : 'border border-rule-2 text-ink-3')}>{done ? <Check size={13} strokeWidth={3} /> : n}</span>
          {title}
        </h2>
        {!open && done && onEdit && <button type="button" onClick={onEdit} className="text-[13px] text-ink-2 underline underline-offset-4 hover:text-ink">Edit</button>}
      </div>
      {!open && summary && <div className="px-4 py-2.5 text-[13.5px] text-ink-2 sm:px-5">{summary}</div>}
      {open && <div className="px-4 py-4 sm:px-5">{children}</div>}
    </section>
  )
}

export function CheckoutPage() {
  const cart = useStore((s) => s.cart)
  const currency = useStore((s) => s.currency)
  const account = useStore((s) => s.account)
  const signIn = useStore((s) => s.signIn)
  const addAddress = useStore((s) => s.addAddress)
  const addOrder = useStore((s) => s.addOrder)
  const clearCart = useStore((s) => s.clearCart)
  const go = useStore((s) => s.go)
  const setup = useSetup()
  const regionNow = useStore((s) => s.gear.find((g) => g.kind === 'region')?.facts.region ?? 'AU')
  const defaultCountry = (COUNTRIES.find((c) => c.region === regionNow)?.code ?? 'AU') as Country

  const [step, setStep] = useState<Step>('contact')
  const [done, setDone] = useState<Record<Step, boolean>>({ contact: false, delivery: false, shipping: false, payment: false, review: false })
  const [email, setEmail] = useState(account?.email ?? '')
  const [emailErr, setEmailErr] = useState<string | null>(null)
  const savedDefault = account?.addresses.find((a) => a.isDefault) ?? account?.addresses[0]
  const [addressId, setAddressId] = useState<string | 'new'>(savedDefault ? savedDefault.id : 'new')
  const [address, setAddress] = useState<AddressInput>(emptyAddress(defaultCountry))
  const [addrErrors, setAddrErrors] = useState<Record<string, string>>({})
  const [addrSubmitted, setAddrSubmitted] = useState(false)
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [methods, setMethods] = useState<Partial<Record<Origin, ShipMethod>>>({})
  const [card, setCard] = useState({ number: '', expiry: '', cvc: '', name: '' })
  const [cardErrors, setCardErrors] = useState<Record<string, string>>({})
  const [cardSubmitted, setCardSubmitted] = useState(false)
  const [placing, setPlacing] = useState(false)
  /* the office path */
  const live = office.enabled
  const remove = useStore((s) => s.remove)
  const [method, setMethod] = useState<'standard' | 'express'>('standard')
  const [quotes, setQuotes] = useState<{ standard?: FreightReply; express?: FreightReply }>({})
  const [quoteStatus, setQuoteStatus] = useState<QuoteStatus>('idle')
  const [paying, setPaying] = useState(false)
  const [payError, setPayError] = useState<string | null>(null)
  const [unavailable, setUnavailable] = useState<number[]>([])   // cart line indexes the office refused

  const chosenAddress: AddressInput = addressId === 'new' ? address : (account?.addresses.find((a) => a.id === addressId) ?? address)
  const country = chosenAddress.country
  const lines = useMemo(() => toOrderLines(cart), [cart])
  const shipments = useMemo(() => splitShipments(lines, country, methods), [lines, country, methods])
  const localTotals = useMemo(() => orderTotals(lines, shipments, country, currency), [lines, shipments, country, currency])
  const cartLines = useMemo(() => cart.map((l) => ({ productId: l.productId, variantId: l.variantId, qty: l.qty })), [cart])
  const cartKey = cart.map((l) => `${l.key}:${l.qty}`).join('|')
  const postcode = chosenAddress.postcode

  useEffect(() => {
    if (!live || step !== 'shipping') return
    let cancelled = false
    setQuoteStatus('loading')
    const base = { lines: cartLines, address: { country, postcode } }
    Promise.all([quoteFreight({ ...base, method: 'standard' }), quoteFreight({ ...base, method: 'express' }).catch(() => null)])
      .then(([standard, express]) => { if (cancelled) return; setQuotes({ standard, express: express ?? undefined }); setQuoteStatus('ok') })
      .catch((e) => { if (cancelled) return; setQuotes({}); setQuoteStatus(e instanceof OfficeClientError && e.code === 'no_freight' ? 'no_freight' : 'error') })
    return () => { cancelled = true }
  }, [live, step, country, postcode, cartLines])

  const quote = live && quoteStatus === 'ok' ? (quotes[method] ?? quotes.standard) : undefined
  const totals: Totals = quote
    ? { subtotal: localTotals.subtotal, shipping: quote.shipping.aud, tax: quote.tax.amount, taxIncluded: quote.tax.included, taxLabel: quote.tax.label, total: quote.total, currency: 'AUD' }
    : localTotals
  const money = (n: number) => fmt(n, live ? 'AUD' : currency, { compact: true })
  const staleLines = useMemo(() => (live ? cart.map((l, i) => (!canBuy(byId(l.productId)) ? i : -1)).filter((i) => i >= 0) : []), [live, cart])
  const blocked = [...new Set([...staleLines, ...unavailable])]
  const compat = useMemo(() => {
    const items = cart.map((l) => ({ id: l.key, name: byId(l.productId).name, facts: resolveFacts(byId(l.productId), l.selection), product: byId(l.productId) }))
    const owned = [...setup.filter((s) => s.id !== 'g-region'), { id: 'g-region', name: 'Delivery country', facts: { region: regionOf(country) } }]
    const issues = items.flatMap((s) => checkBuild({ name: s.name, facts: s.facts, product: s.product }, [...owned, ...items.filter((x) => x !== s)]).issues)
    return { status: issues.some((i) => i.severity === 'bad') ? 'bad' : issues.length ? 'warn' : 'ok', issues } as const
  }, [cart, setup, country])

  if (cart.length === 0 && !placing) {
    return (
      <div className="mx-auto max-w-[1440px] px-4 py-16 md:px-6">
        <h1 className="display-md text-[34px] text-ink">Your cart is empty.</h1>
        <p className="mt-2 text-[15px] text-ink-2">Add something first, then come back here.</p>
        <Button variant="primary" className="mt-6" onClick={() => go({ name: 'collection', slug: 'trending', filters: {} })}>Browse what is trending</Button>
      </div>
    )
  }

  const next = (from: Step, to: Step) => { setDone((d) => ({ ...d, [from]: true })); setStep(to) }
  const submitContact = () => { if (!validEmail(email)) { setEmailErr('An email address is needed for the order confirmation.'); return } setEmailErr(null); next('contact', 'delivery') }
  const submitDelivery = () => {
    if (live && addressId !== 'new' && !chosenAddress.phone) { setAddressId('new'); setAddress({ ...chosenAddress }); setAddrErrors({ phone: 'The carrier needs a phone number for the parcel.' }); setTouched({ phone: true }); setAddrSubmitted(true); return }
    if (addressId === 'new') {
      const errs = validateAddress(address, { requirePhone: live })
      setAddrErrors(errs); setTouched({ name: true, line1: true, city: true, region: true, postcode: true, phone: true }); setAddrSubmitted(true)
      if (Object.keys(errs).length) return
    }
    next('delivery', 'shipping')
  }
  const submitPayment = () => { const errs = validateCard(card, new Date()); setCardErrors(errs); setCardSubmitted(true); if (Object.keys(errs).length) return; next('payment', 'review') }
  const ADDRESS_LABELS = { name: 'Name', line1: 'Street address', city: 'City', region: 'State or region', postcode: 'Postcode', phone: 'Phone' }
  const CARD_LABELS = { number: 'Card number', expiry: 'Expiry', cvc: 'CVC', name: 'Name on card' }
  const addrStepError = addrSubmitted ? errorSummary(addrErrors, ADDRESS_LABELS) : null
  const cardStepError = cardSubmitted ? errorSummary(cardErrors, CARD_LABELS) : null
  const pay = async () => {
    setPaying(true); setPayError(null)
    try {
      const { url } = await startCheckout({ lines: cartLines, email: email.trim().toLowerCase(), address: { ...chosenAddress, country }, method })
      if (!account || account.email !== email.trim().toLowerCase()) signIn(email)
      if (addressId === 'new' && !account?.addresses.some((a) => a.line1 === address.line1 && a.postcode === address.postcode)) addAddress({ ...address, isDefault: !account?.addresses.length })
      redirect.to(url)
    } catch (e) {
      const err = e instanceof OfficeClientError ? e : null
      const line = err?.field?.match(/^lines\[(\d+)\]$/)
      if (line) { setUnavailable([Number(line[1])]); setPayError(err?.code === 'not_sellable' ? 'One item is no longer available. Remove it to continue.' : 'One item in the cart cannot be ordered right now. Remove it to continue.') }
      else if (err?.code === 'no_freight') setPayError(`We cannot ship this order to ${COUNTRIES.find((c) => c.code === country)?.name} yet. Change the delivery address to continue.`)
      else if (err?.code === 'rate_limited') setPayError('Too many attempts from this connection. Wait a minute and try again.')
      else if (err?.code === 'offline' || err?.code === 'stripe_unavailable') setPayError('The payment page could not be reached. Nothing was charged; try again in a moment.')
      else if (err?.field) setPayError(`Something in the ${err.field.startsWith('address') ? 'delivery address' : err.field} needs a second look (${err.code}).`)
      else setPayError('Could not start the payment. Nothing was charged; try again in a moment.')
      setPaying(false)
    }
  }
  const place = () => {
    setPlacing(true)
    if (!account || account.email !== email.trim().toLowerCase()) signIn(email)
    let saved = addressId === 'new' ? null : account?.addresses.find((a) => a.id === addressId) ?? null
    if (!saved) saved = addAddress({ ...address, isDefault: !account?.addresses.length })
    const order: Order = {
      id: newOrderId(new Date(), cart.length, useStore.getState().orders.map((o) => o.id)), placedAt: new Date().toISOString(), email: email.trim().toLowerCase(), address: saved, lines, shipments, totals,
      compat: { status: compat.status, issues: compat.issues.map((i) => i.title) },
    }
    addOrder(order)
    clearCart()
    go({ name: 'confirmed', id: order.id })
  }

  const addrSummary = `${chosenAddress.name}, ${chosenAddress.line1}, ${chosenAddress.city} ${chosenAddress.postcode}, ${COUNTRIES.find((c) => c.code === country)?.name}`
  const liveErrors = Object.fromEntries(Object.entries(addrErrors).filter(([k]) => touched[k]))

  return (
    <div className="mx-auto max-w-[1440px] px-4 pb-24 md:px-6 lg:pb-16">
      <nav aria-label="Breadcrumb" className="py-4 text-[13px] text-ink-3">
        <button type="button" onClick={() => go({ name: 'home' })} className="hover:text-ink">Home</button><span className="mx-1.5">/</span><span className="text-ink">Checkout</span>
      </nav>
      <div className="grid grid-cols-12 gap-x-8 gap-y-6">
        <div className="col-span-12 space-y-3 lg:col-span-7">
          <h1 className="display-md text-[34px] text-ink sm:text-[44px]">Checkout</h1>
          <p className="text-[13.5px] text-ink-2">{live ? 'You pay on Stripe\u2019s secure page at the last step. Prices are in Australian dollars.' : 'No payment is taken in this prototype. The card is checked and never stored.'}</p>

          <Section n={1} title="Contact" open={step === 'contact'} done={done.contact} summary={email} onEdit={() => setStep('contact')}>
            <label className="block sm:max-w-[360px]">
              <span className="text-[12.5px] text-ink-2">Email for the order confirmation</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} onBlur={() => setEmailErr(email && !validEmail(email) ? 'That email address does not look right.' : null)} autoComplete="email" aria-invalid={!!emailErr} className={cn('mt-1 h-10 w-full border bg-sheet px-3 text-[14px] text-ink', emailErr ? 'border-fail' : 'border-rule-2 focus:border-ink')} />
              {emailErr && <span className="mt-1 block text-[12px] text-fail">{emailErr}</span>}
            </label>
            {!account && <p className="mt-2 text-[12.5px] text-ink-3">This email becomes your account: no password, nothing sent.</p>}
            <Button variant="primary" className="mt-4" onClick={submitContact}>Continue to delivery</Button>
          </Section>

          <Section n={2} title="Delivery address" open={step === 'delivery'} done={done.delivery} summary={done.delivery ? addrSummary : undefined} onEdit={() => setStep('delivery')}>
            {account && account.addresses.length > 0 && (
              <div className="mb-4 sheet-grid sm:grid-cols-2" role="radiogroup" aria-label="Saved addresses">
                {account.addresses.map((a) => (
                  <button key={a.id} type="button" role="radio" aria-checked={addressId === a.id} onClick={() => setAddressId(a.id)} className={cn('bg-sheet px-3 py-2.5 text-left text-[13.5px]', addressId === a.id ? 'text-ink shadow-[inset_0_0_0_2px_var(--color-ink)]' : 'text-ink-2 hover:bg-paper')}>
                    <div className="font-medium">{a.name}</div><div className="text-[12.5px]">{a.line1}, {a.city} {a.postcode}, {a.country}</div>
                  </button>
                ))}
                <button type="button" role="radio" aria-checked={addressId === 'new'} onClick={() => setAddressId('new')} className={cn('bg-sheet px-3 py-2.5 text-left text-[13.5px]', addressId === 'new' ? 'text-ink shadow-[inset_0_0_0_2px_var(--color-ink)]' : 'text-ink-2 hover:bg-paper')}>New address</button>
              </div>
            )}
            {addrStepError && <p role="alert" className="mb-3 border border-fail bg-fail-tint px-3 py-2 text-[13px] text-fail">{addrStepError}</p>}
            {addressId === 'new' && (
              <AddressForm value={address} requirePhone={live} onChange={(v) => { setAddress(v); setAddrErrors(validateAddress(v, { requirePhone: live })) }} errors={liveErrors} onBlurField={(f) => { setTouched((t) => ({ ...t, [f]: true })); setAddrErrors(validateAddress(address, { requirePhone: live })) }} />
            )}
            <Button variant="primary" className="mt-4" onClick={submitDelivery}>Continue to shipping</Button>
          </Section>

          <Section n={3} title="Shipping" open={step === 'shipping'} done={done.shipping} summary={done.shipping ? (quote ? `${quote.shipping.logisticName}, ${quote.shipping.days[0]}–${quote.shipping.days[1]} days, ${money(quote.shipping.aud)}` : `${shipments.length} ${shipments.length === 1 ? 'shipment' : 'shipments'} to ${ZONE_LABEL[zoneOf(country)]}`) : undefined} onEdit={() => setStep('shipping')}>
            {live ? (
              <LiveShipping status={quoteStatus} quotes={quotes} method={method} onMethod={setMethod} country={country} estimate={localTotals.shipping} money={money} lines={lines} onEditAddress={() => setStep('delivery')} />
            ) : (
            <div className="space-y-3">
              {shipments.map((s) => (
                <div key={s.origin} className="border border-rule">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rule bg-paper px-3 py-2 text-[13.5px]">
                    <span className="text-ink">{originLabel({ route: s.origin === 'AU' ? 'warehouse' : 'supplier', origin: s.origin })}</span>
                    <span className="text-ink-3">{s.lineKeys.length} {s.lineKeys.length === 1 ? 'item' : 'items'}</span>
                  </div>
                  <ul className="px-3 py-2 text-[13px] text-ink-2">
                    {lines.filter((l) => s.lineKeys.includes(l.key)).map((l) => <li key={l.key}>{l.qty} × {l.brand} {l.name}</li>)}
                  </ul>
                  <div className="grid gap-px border-t border-rule bg-rule sm:grid-cols-2" role="radiogroup" aria-label={`Shipping from ${s.origin}`}>
                    {(['standard', 'express'] as ShipMethod[]).filter((m) => m === 'standard' || canExpress(s.origin, s.zone)).map((m) => {
                      const on = (methods[s.origin] ?? 'standard') === m
                      const cost = m === 'express' ? splitShipments(lines, country, { ...methods, [s.origin]: 'express' }).find((x) => x.origin === s.origin)!.cost : splitShipments(lines, country, { ...methods, [s.origin]: 'standard' }).find((x) => x.origin === s.origin)!.cost
                      return (
                        <button key={m} type="button" role="radio" aria-checked={on} onClick={() => setMethods((x) => ({ ...x, [s.origin]: m }))} className={cn('flex items-center justify-between bg-sheet px-3 py-2.5 text-left text-[13.5px]', on ? 'text-ink shadow-[inset_0_0_0_2px_var(--color-ink)]' : 'text-ink-2 hover:bg-paper')}>
                          <span>{m === 'standard' ? 'Standard' : 'Express'}<span className="block text-[12px] text-ink-3">{m === 'express' ? 'Priority line' : etaText(s.origin, s.zone)}</span></span>
                          <span className="reading">{cost === 0 ? 'Free' : fmt(cost, currency, { compact: true })}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
            )}
            {live
              ? (quoteStatus === 'ok' || quoteStatus === 'error') && <Button variant="primary" className="mt-4" onClick={() => next('shipping', 'review')}>Review the order</Button>
              : <Button variant="primary" className="mt-4" onClick={() => next('shipping', 'payment')}>Continue to payment</Button>}
          </Section>

          {!live && <Section n={4} title="Payment" open={step === 'payment'} done={done.payment} summary={done.payment ? `Card ending ${card.number.replace(/\D/g, '').slice(-4)}, not charged` : undefined} onEdit={() => setStep('payment')}>
            {cardStepError && <p role="alert" className="mb-3 border border-fail bg-fail-tint px-3 py-2 text-[13px] text-fail">{cardStepError}</p>}
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block sm:col-span-2"><span className="text-[12.5px] text-ink-2">Card number</span>
                <input inputMode="numeric" autoComplete="cc-number" value={card.number} onChange={(e) => setCard({ ...card, number: e.target.value })} placeholder="4242 4242 4242 4242" aria-invalid={!!cardErrors.number} className={cn('reading mt-1 h-10 w-full border bg-sheet px-3 text-[14px] text-ink placeholder:text-ink-3', cardErrors.number ? 'border-fail' : 'border-rule-2 focus:border-ink')} />
                {cardErrors.number && <span className="mt-1 block text-[12px] text-fail">{cardErrors.number}</span>}</label>
              <label className="block"><span className="text-[12.5px] text-ink-2">Expiry (MM/YY)</span>
                <input inputMode="numeric" autoComplete="cc-exp" value={card.expiry} onChange={(e) => setCard({ ...card, expiry: e.target.value })} placeholder="12/27" aria-invalid={!!cardErrors.expiry} className={cn('reading mt-1 h-10 w-full border bg-sheet px-3 text-[14px] text-ink placeholder:text-ink-3', cardErrors.expiry ? 'border-fail' : 'border-rule-2 focus:border-ink')} />
                {cardErrors.expiry && <span className="mt-1 block text-[12px] text-fail">{cardErrors.expiry}</span>}</label>
              <label className="block"><span className="text-[12.5px] text-ink-2">CVC</span>
                <input inputMode="numeric" autoComplete="cc-csc" value={card.cvc} onChange={(e) => setCard({ ...card, cvc: e.target.value })} placeholder="123" aria-invalid={!!cardErrors.cvc} className={cn('reading mt-1 h-10 w-full border bg-sheet px-3 text-[14px] text-ink placeholder:text-ink-3', cardErrors.cvc ? 'border-fail' : 'border-rule-2 focus:border-ink')} />
                {cardErrors.cvc && <span className="mt-1 block text-[12px] text-fail">{cardErrors.cvc}</span>}</label>
              <label className="block sm:col-span-2"><span className="text-[12.5px] text-ink-2">Name on card</span>
                <input autoComplete="cc-name" value={card.name} onChange={(e) => setCard({ ...card, name: e.target.value })} aria-invalid={!!cardErrors.name} className={cn('mt-1 h-10 w-full border bg-sheet px-3 text-[14px] text-ink', cardErrors.name ? 'border-fail' : 'border-rule-2 focus:border-ink')} />
                {cardErrors.name && <span className="mt-1 block text-[12px] text-fail">{cardErrors.name}</span>}</label>
            </div>
            <p className="mt-3 text-[12.5px] text-ink-3">No payment is taken in this prototype. Use 4242 4242 4242 4242 with any future expiry.</p>
            <Button variant="primary" className="mt-4" onClick={submitPayment}>Review the order</Button>
          </Section>}

          <Section n={live ? 4 : 5} title={live ? 'Review and pay' : 'Review and place order'} open={step === 'review'} done={false}>
            {payError && <p role="alert" className="mb-3 border border-fail bg-fail-tint px-3 py-2 text-[13px] text-fail">{payError}</p>}
            <ul className="divide-y divide-rule border border-rule">
              {lines.map((l, i) => {
                const gone = blocked.includes(i)
                return (
                  <li key={l.key} className={cn('flex items-center gap-3 px-3 py-2.5', gone && 'bg-fail-tint')}>
                    <div className="h-12 w-16 shrink-0 bg-paper"><ProductImage product={byId(l.productId)} hue={l.hue} swatch={l.swatch} /></div>
                    <div className="min-w-0 flex-1"><div className="truncate text-[13.5px] text-ink">{l.brand} {l.name}</div><div className={cn('truncate text-[12px]', gone ? 'text-fail' : 'text-ink-3')}>{gone ? 'No longer available' : `${l.variantLabel}, ${l.qty} × ${money(l.unitPrice)}`}</div></div>
                    {gone
                      ? <Button size="sm" variant="danger" onClick={() => { remove(l.key); setUnavailable([]); setPayError(null) }}>Remove</Button>
                      : <div className="reading text-[13px] text-ink">{money(l.unitPrice * l.qty)}</div>}
                  </li>
                )
              })}
            </ul>
            <div className={cn('mt-3 flex items-start gap-3 border px-3 py-2.5 text-[13px]', compat.status === 'ok' ? 'border-pass bg-pass-tint text-pass' : compat.status === 'warn' ? 'border-check bg-check-tint text-check' : 'border-fail bg-fail-tint text-fail')}>
              <span className={cn('mt-1 h-2 w-2 shrink-0', compat.status === 'ok' ? 'bg-pass' : compat.status === 'warn' ? 'bg-check' : 'bg-fail')} aria-hidden />
              <div>
                <div className="font-medium">{compat.status === 'ok' ? 'Everything works with your setup and the delivery country' : `${compat.issues.length} thing${compat.issues.length > 1 ? 's' : ''} to know before you order`}</div>
                {compat.issues.length > 0 && <ul className="mt-1 list-disc pl-4 text-ink-2">{compat.issues.map((i) => <li key={i.id + i.title}>{i.title}</li>)}</ul>}
              </div>
            </div>
            {live ? (
              <div className="mt-4">
                <Button variant="primary" size="lg" className="w-full sm:w-auto" onClick={() => void pay()} disabled={paying || blocked.length > 0 || quoteStatus === 'no_freight' || quoteStatus === 'loading'}>{paying ? 'Opening Stripe…' : `Pay with Stripe, ${money(totals.total)}`}</Button>
                <p className="mt-3 text-[12.5px] text-ink-3">You will be taken to Stripe’s secure page to pay by card. Nothing is charged until you confirm there{quote ? '' : '; the freight shown here is an estimate and the final amount is confirmed at payment'}. The supplier ships from China once payment clears.</p>
                <p className="mt-1 text-[12.5px] text-ink-3">By paying you agree to the <a href="#/policies/terms" className="underline underline-offset-4 hover:text-ink">terms</a> and the <a href="#/policies/shipping-returns" className="underline underline-offset-4 hover:text-ink">shipping and returns policy</a>.</p>
              </div>
            ) : (
              <Button variant="primary" size="lg" className="mt-4 w-full sm:w-auto" onClick={place} disabled={placing}>Place order, {fmt(totals.total, currency, { compact: true })}</Button>
            )}
          </Section>
        </div>

        <aside className="col-span-12 lg:col-span-5">
          <div className="border border-ink bg-sheet lg:sticky lg:top-[72px]">
            <div className="border-b border-rule px-4 py-2.5 text-[13.5px] text-ink">Order summary</div>
            <ul className="divide-y divide-rule px-4 text-[13px] text-ink-2">
              {lines.map((l) => <li key={l.key} className="flex justify-between py-2"><span className="truncate pr-3">{l.qty} × {l.brand} {l.name}</span><span className="reading text-ink">{money(l.unitPrice * l.qty)}</span></li>)}
            </ul>
            <dl className="reading border-t border-rule px-4 py-3 text-[12.5px] text-ink-2">
              <div className="flex justify-between py-0.5"><dt>Subtotal</dt><dd>{fmt(totals.subtotal, totals.currency)}</dd></div>
              {quote
                ? <div className="flex justify-between py-0.5"><dt>Shipping from China, {quote.shipping.logisticName}</dt><dd>{fmt(quote.shipping.aud, 'AUD')}</dd></div>
                : shipments.map((s) => <div key={s.origin} className="flex justify-between py-0.5"><dt>Shipping from {s.origin === 'AU' ? 'Sydney' : s.origin === 'CN' ? 'China' : s.origin}, {s.method}{live && step !== 'contact' && step !== 'delivery' ? ' (estimate)' : ''}</dt><dd>{s.cost === 0 ? 'Free' : fmt(s.cost, totals.currency)}</dd></div>)}
              <div className="flex justify-between py-0.5"><dt>{totals.taxLabel}</dt><dd>{fmt(totals.tax, totals.currency)}</dd></div>
              <div className="mt-1 flex items-baseline justify-between border-t border-ink pt-2 text-ink"><dt className="font-sans text-[14px] font-medium">Total</dt><dd className="text-[18px]">{fmt(totals.total, totals.currency)}</dd></div>
            </dl>
            <div className="border-t border-rule px-4 py-2 text-[11.5px] text-ink-3">Delivering to {COUNTRIES.find((c) => c.code === country)?.name}. {(live ? LIVE_STEPS : STEPS).findIndex((s) => s.id === step) + 1} of {(live ? LIVE_STEPS : STEPS).length} steps.</div>
          </div>
        </aside>
      </div>
    </div>
  )
}

/* The supplier's own lanes for this address: the cheapest as standard, the fastest as express when there is one. */
function LiveShipping({ status, quotes, method, onMethod, country, estimate, money, lines, onEditAddress }: { status: QuoteStatus; quotes: { standard?: FreightReply; express?: FreightReply }; method: 'standard' | 'express'; onMethod: (m: 'standard' | 'express') => void; country: Country; estimate: number; money: (n: number) => string; lines: ReturnType<typeof toOrderLines>; onEditAddress: () => void }) {
  const name = COUNTRIES.find((c) => c.code === country)?.name ?? country
  if (status === 'loading' || status === 'idle') return <div className="space-y-2" aria-busy="true"><div className="skeleton h-10" /><div className="skeleton h-10" /><p className="text-[12.5px] text-ink-3">Getting a freight quote from the supplier for {name}…</p></div>
  if (status === 'no_freight') {
    return (
      <div className="border border-fail bg-fail-tint px-3 py-3 text-[13.5px] text-fail" role="alert">
        <div className="font-medium">We cannot ship this order to {name} yet.</div>
        <p className="mt-1 text-ink-2">The supplier has no lane for one of these items to that address. Try another address, or remove the item.</p>
        <Button size="sm" variant="secondary" className="mt-3" onClick={onEditAddress}>Change the address</Button>
      </div>
    )
  }
  if (status === 'error') {
    return (
      <div className="border border-check bg-check-tint px-3 py-3 text-[13.5px] text-check">
        <div className="font-medium">Shipping shown as an estimate: {money(estimate)}</div>
        <p className="mt-1 text-ink-2">The supplier could not be reached for a live quote just now. The final freight is confirmed at payment, before anything is charged.</p>
      </div>
    )
  }
  const std = quotes.standard
  const exp = quotes.express && !quotes.express.fellBack && quotes.express.shipping.logisticName !== quotes.standard?.shipping.logisticName ? quotes.express : undefined
  const option = (m: 'standard' | 'express', q: FreightReply) => {
    const on = method === m
    return (
      <button key={m} type="button" role="radio" aria-checked={on} onClick={() => onMethod(m)} className={cn('flex items-center justify-between bg-sheet px-3 py-2.5 text-left text-[13.5px]', on ? 'text-ink shadow-[inset_0_0_0_2px_var(--color-ink)]' : 'text-ink-2 hover:bg-paper')}>
        <span>{m === 'standard' ? 'Standard' : 'Express'}<span className="block text-[12px] text-ink-3">{q.shipping.logisticName}, {q.shipping.days[0]}–{q.shipping.days[1]} days</span></span>
        <span className="reading">{money(q.shipping.aud)}</span>
      </button>
    )
  }
  return (
    <div className="border border-rule">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rule bg-paper px-3 py-2 text-[13.5px]">
        <span className="text-ink">{originLabel({ route: 'supplier', origin: 'CN' })}</span>
        <span className="text-ink-3">{lines.length} {lines.length === 1 ? 'item' : 'items'}, tracked</span>
      </div>
      <ul className="px-3 py-2 text-[13px] text-ink-2">{lines.map((l) => <li key={l.key}>{l.qty} × {l.brand} {l.name}</li>)}</ul>
      <div className="grid gap-px border-t border-rule bg-rule sm:grid-cols-2" role="radiogroup" aria-label="Shipping from CN">
        {std && option('standard', std)}
        {exp ? option('express', exp) : <div className="bg-sheet px-3 py-2.5 text-[12.5px] text-ink-3">No faster lane for this address.</div>}
      </div>
    </div>
  )
}
