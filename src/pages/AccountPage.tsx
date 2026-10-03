/* Account: email-only sign-in, saved setup, addresses, order history, currency, clear my data. */
import { useState } from 'react'
import { Currency, CURRENCIES } from '../lib/currency'
import { orderStatus } from '../lib/orders'
import { COUNTRIES } from '../lib/shipping'
import { AddressInput, validateAddress, validEmail } from '../lib/validate'
import { useStore } from '../lib/store'
import { AddressForm, emptyAddress } from '../components/AddressForm'
import { Button } from '../components/ui'
import { fmt } from '../lib/currency'
import { cn } from '../lib/cn'

const STATUS_LABEL = { placed: 'Placed', packed: 'Packed', shipped: 'Shipped', delivered: 'Delivered' }

function Card({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="border border-rule bg-sheet">
      <div className="flex items-center justify-between border-b border-rule px-4 py-2.5"><h2 className="text-[14px] text-ink">{title}</h2>{action}</div>
      <div className="px-4 py-3">{children}</div>
    </section>
  )
}

export function AccountPage() {
  const account = useStore((s) => s.account)
  const signIn = useStore((s) => s.signIn)
  const signOut = useStore((s) => s.signOut)
  const clearData = useStore((s) => s.clearData)
  const orders = useStore((s) => s.orders)
  const currency = useStore((s) => s.currency)
  const setCurrency = useStore((s) => s.setCurrency)
  const gear = useStore((s) => s.gear)
  const gearOn = useStore((s) => s.gearOn)
  const addAddress = useStore((s) => s.addAddress)
  const updateAddress = useStore((s) => s.updateAddress)
  const removeAddress = useStore((s) => s.removeAddress)
  const storageBlocked = useStore((s) => s.storageBlocked)
  const go = useStore((s) => s.go)
  const [email, setEmail] = useState('')
  const [emailErr, setEmailErr] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const [draft, setDraft] = useState<AddressInput>(emptyAddress())
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [confirmClear, setConfirmClear] = useState(false)

  const startEdit = (id: string | 'new') => {
    setEditing(id); setErrors({}); setTouched({})
    const a = id === 'new' ? null : account?.addresses.find((x) => x.id === id)
    setDraft(a ? { name: a.name, line1: a.line1, line2: a.line2 ?? '', city: a.city, region: a.region ?? '', postcode: a.postcode, country: a.country, phone: a.phone ?? '' } : emptyAddress())
  }
  const saveAddress = () => {
    const errs = validateAddress(draft); setErrors(errs); setTouched({ name: true, line1: true, city: true, region: true, postcode: true, phone: true })
    if (Object.keys(errs).length) return
    if (editing === 'new') addAddress({ ...draft, isDefault: !account?.addresses.length })
    else if (editing) { const old = account!.addresses.find((x) => x.id === editing)!; updateAddress({ ...old, ...draft }) }
    setEditing(null)
  }

  return (
    <div className="mx-auto max-w-[1440px] px-4 pb-24 md:px-6 lg:pb-16">
      <nav aria-label="Breadcrumb" className="py-4 text-[13px] text-ink-3">
        <button type="button" onClick={() => go({ name: 'home' })} className="hover:text-ink">Home</button><span className="mx-1.5">/</span><span className="text-ink">Account</span>
      </nav>

      {!account ? (
        <div className="grid grid-cols-12 gap-x-8 gap-y-6">
          <div className="col-span-12 lg:col-span-6">
            <h1 className="display-md text-[34px] text-ink sm:text-[44px]">Sign in</h1>
            <p className="mt-2 text-[15px] text-ink-2">Your email is the account. No password, nothing is sent; it is remembered in this browser.</p>
            {storageBlocked && <p className="mt-2 text-[12.5px] text-check">This browser is not keeping data between visits, so the account, cart and setup last until you close the tab.</p>}
            <label className="mt-6 block sm:max-w-[360px]">
              <span className="text-[12.5px] text-ink-2">Email</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { if (validEmail(email)) signIn(email); else setEmailErr('That email address does not look right.') } }} autoComplete="email" aria-invalid={!!emailErr} className={cn('mt-1 h-10 w-full border bg-sheet px-3 text-[14px] text-ink', emailErr ? 'border-fail' : 'border-rule-2 focus:border-ink')} />
              {emailErr && <span className="mt-1 block text-[12px] text-fail">{emailErr}</span>}
            </label>
            <Button variant="primary" className="mt-4" onClick={() => { if (validEmail(email)) signIn(email); else setEmailErr('That email address does not look right.') }}>Sign in</Button>
          </div>
          <div className="col-span-12 lg:col-span-6">
            <Card title="What an account remembers">
              <ul className="space-y-1 text-[13.5px] text-ink-2">
                <li>Your setup: phones, hubs, chargers, sources and region, for every works-with check.</li>
                <li>Delivery addresses, so checkout is one click of a saved cell.</li>
                <li>Orders and their shipments, with status that keeps moving.</li>
                <li>Recent searches and your display currency.</li>
              </ul>
              <p className="mt-3 text-[12px] text-ink-3">Everything stays in this browser. Nothing is uploaded.</p>
            </Card>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-x-8 gap-y-6">
          <div className="col-span-12 lg:col-span-7">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h1 className="display-md text-[34px] text-ink sm:text-[44px]">Account</h1>
                <p className="mt-1 text-[14.5px] text-ink-2">Signed in as <span className="text-ink">{account.email}</span></p>
              </div>
              <button type="button" onClick={signOut} className="text-[13px] text-ink-2 underline underline-offset-4 hover:text-ink">Sign out</button>
            </div>
            {storageBlocked && <p className="mt-2 text-[12.5px] text-check">This browser is not keeping data between visits, so the account lasts until you close the tab.</p>}

            <div className="mt-6 space-y-4">
              <Card title="My setup" action={<button type="button" onClick={() => go({ name: 'setup' })} className="text-[13px] text-ink-2 underline underline-offset-4 hover:text-ink">Edit</button>}>
                <ul className="flex flex-wrap gap-2 text-[13px]">
                  {gear.filter((g) => gearOn[g.id]).map((g) => <li key={g.id} className="tag">{g.name}</li>)}
                </ul>
              </Card>

              <Card title="Addresses" action={editing === null ? <button type="button" onClick={() => startEdit('new')} className="text-[13px] text-ink-2 underline underline-offset-4 hover:text-ink">Add</button> : undefined}>
                {account.addresses.length === 0 && editing === null && <p className="text-[13.5px] text-ink-3">No addresses yet. Checkout saves the first one.</p>}
                <ul className="sheet-grid sm:grid-cols-2">
                  {account.addresses.map((a) => (
                    <li key={a.id} className="bg-sheet px-3 py-2.5 text-[13.5px]">
                      <div className="flex items-start justify-between gap-2">
                        <div><div className="text-ink">{a.name}{a.isDefault && <span className="tag ml-2 text-[10.5px]">Default</span>}</div><div className="text-[12.5px] text-ink-2">{a.line1}{a.line2 ? `, ${a.line2}` : ''}, {a.city} {a.region} {a.postcode}, {COUNTRIES.find((c) => c.code === a.country)?.name}</div></div>
                      </div>
                      <div className="mt-2 flex gap-3 text-[12.5px] text-ink-2">
                        <button type="button" onClick={() => startEdit(a.id)} className="underline underline-offset-4 hover:text-ink">Edit</button>
                        {!a.isDefault && <button type="button" onClick={() => updateAddress({ ...a, isDefault: true })} className="underline underline-offset-4 hover:text-ink">Make default</button>}
                        <button type="button" onClick={() => removeAddress(a.id)} className="underline underline-offset-4 hover:text-fail">Remove</button>
                      </div>
                    </li>
                  ))}
                </ul>
                {editing !== null && (
                  <div className="mt-3 border-t border-rule pt-3">
                    <AddressForm value={draft} onChange={(v) => { setDraft(v); setErrors(validateAddress(v)) }} errors={Object.fromEntries(Object.entries(errors).filter(([k]) => touched[k]))} onBlurField={(f) => setTouched((t) => ({ ...t, [f]: true }))} />
                    <div className="mt-3 flex gap-2"><Button size="sm" variant="primary" onClick={saveAddress}>Save address</Button><Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button></div>
                  </div>
                )}
              </Card>

              <Card title="Orders" action={<button type="button" onClick={() => go({ name: 'orders' })} className="text-[13px] text-ink-2 underline underline-offset-4 hover:text-ink">All orders</button>}>
                {orders.length === 0 ? <p className="text-[13.5px] text-ink-3">No orders yet.</p> : (
                  <ul className="divide-y divide-rule">
                    {orders.slice(0, 3).map((o) => (
                      <li key={o.id} className="flex items-center justify-between gap-3 py-2 text-[13.5px]">
                        <button type="button" onClick={() => go({ name: 'order', id: o.id })} className="reading text-ink hover:underline underline-offset-4">{o.id}</button>
                        <span className="text-ink-2">{new Date(o.placedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}</span>
                        <span className="text-ink-2">{STATUS_LABEL[orderStatus(o, new Date())]}</span>
                        <span className="reading text-ink">{fmt(o.totals.total, o.totals.currency)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          </div>

          <aside className="col-span-12 space-y-4 lg:col-span-5">
            <Card title="Display currency">
              <select value={currency} onChange={(e) => setCurrency(e.target.value as Currency)} className="h-9 border border-rule-2 bg-sheet px-2 text-[13px] text-ink">
                {(Object.keys(CURRENCIES) as Currency[]).map((c) => <option key={c} value={c}>{c}, {CURRENCIES[c].region}</option>)}
              </select>
              <p className="mt-2 text-[12px] text-ink-3">Prices are AUD underneath; tax follows the delivery country, not the currency.</p>
            </Card>
            <Card title="Clear my data">
              <p className="text-[13.5px] text-ink-2">Removes your setup, cart, addresses and orders from this browser.</p>
              {!confirmClear ? (
                <Button size="sm" variant="danger" className="mt-3" onClick={() => setConfirmClear(true)}>Clear my data</Button>
              ) : (
                <div className="mt-3 flex items-center gap-3 text-[13px] text-ink-2">Are you sure? <Button size="sm" variant="danger" onClick={() => { clearData(); setConfirmClear(false) }}>Yes, clear it</Button><Button size="sm" variant="ghost" onClick={() => setConfirmClear(false)}>Keep it</Button></div>
              )}
            </Card>
          </aside>
        </div>
      )}
    </div>
  )
}
