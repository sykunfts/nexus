/*
  My setup: the devices every works-with check runs against. Editable, persisted in the browser.
*/
import { useMemo, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { CompatFacts, GearItem, GearKind, products, Region, REGION_LABEL } from '../lib/data'
import { customGear, DEVICES, toGear } from '../lib/devices'
import { query } from '../lib/catalog'
import { useRegion, useSetup, useStore } from '../lib/store'
import { ProductCard } from '../components/ProductCard'
import { Button, Toggle } from '../components/ui'
import { cn } from '../lib/cn'

const KINDS: { kind: GearKind; title: string; hint: string }[] = [
  { kind: 'phone', title: 'Phones', hint: 'App platform, magnets and finder network' },
  { kind: 'hub', title: 'Home hubs', hint: 'Which home app, Matter, and whether you have a Thread border router' },
  { kind: 'charger', title: 'Chargers', hint: 'The strongest USB-C charger you own' },
  { kind: 'source', title: 'Sources', hint: 'Things that plug into a projector or screen' },
]

function GearRow({ g }: { g: GearItem }) {
  const on = useStore((s) => !!s.gearOn[g.id])
  const toggle = useStore((s) => s.toggleGear)
  const remove = useStore((s) => s.removeGear)
  return (
    <li className="flex items-center justify-between gap-3 border-b border-rule px-4 py-2.5 last:border-b-0">
      <div className="min-w-0">
        <div className="truncate text-[14px] text-ink">{g.name}</div>
        <div className="truncate text-[12px] text-ink-3">{g.detail}</div>
      </div>
      <div className="flex items-center gap-3">
        <Toggle on={on} onChange={() => toggle(g.id)} label={`Include ${g.name} in the check`} />
        <button type="button" onClick={() => remove(g.id)} aria-label={`Remove ${g.name}`} className="text-ink-3 hover:text-fail"><X size={14} /></button>
      </div>
    </li>
  )
}

function AddDevice({ kind, onDone }: { kind: GearKind; onDone: () => void }) {
  const addGear = useStore((s) => s.addGear)
  const gear = useStore((s) => s.gear)
  const [custom, setCustom] = useState(false)
  const [name, setName] = useState('')
  const [facts, setFacts] = useState<CompatFacts>({})
  const options = DEVICES.filter((d) => d.kind === kind && !gear.some((g) => g.deviceId === d.id))

  const addCustom = () => {
    if (!name.trim()) return
    addGear(customGear(kind, name, facts))
    onDone()
  }
  const tick = (key: 'ios' | 'android' | 'magnets' | 'find-my' | 'find-hub' | 'homekit' | 'google' | 'alexa' | 'matter' | 'thread') => {
    setFacts((f) => {
      if (kind === 'phone') {
        const p = f.phone ?? { os: 'ios', magnets: false, trackerNet: 'find-my' }
        if (key === 'ios' || key === 'android') return { phone: { ...p, os: key, trackerNet: key === 'ios' ? 'find-my' : 'find-hub' } }
        if (key === 'magnets') return { phone: { ...p, magnets: !p.magnets } }
        return f
      }
      const hubs = new Set(f.hubs ?? [])
      if (hubs.has(key as never)) hubs.delete(key as never); else hubs.add(key as never)
      return { hubs: [...hubs] as CompatFacts['hubs'] }
    })
  }

  return (
    <div className="border-t border-rule bg-paper px-4 py-3">
      {!custom ? (
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-[13px] text-ink-2">
            Add
            <select defaultValue="" onChange={(e) => { const d = DEVICES.find((x) => x.id === e.target.value); if (d) { addGear(toGear(d)); onDone() } }} className="h-8 border border-rule-2 bg-sheet px-2 text-[13px] text-ink">
              <option value="">Choose a device</option>
              {options.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </label>
          <button type="button" onClick={() => setCustom(true)} className="text-[13px] text-ink-2 underline underline-offset-4 hover:text-ink">Something else</button>
          <button type="button" onClick={onDone} className="ml-auto text-[13px] text-ink-3 hover:text-ink">Cancel</button>
        </div>
      ) : (
        <div className="space-y-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name it, for example Galaxy A56" className="h-9 w-full border border-rule-2 bg-sheet px-3 text-[14px] text-ink placeholder:text-ink-3 sm:max-w-[320px]" />
          {kind === 'phone' && (
            <div className="flex flex-wrap gap-2 text-[13px]">
              {(['ios', 'android'] as const).map((os) => <button key={os} type="button" onClick={() => tick(os)} className={cn('border px-2.5 py-1', facts.phone?.os === os ? 'border-ink bg-ink text-paper' : 'border-rule-2 text-ink-2')}>{os === 'ios' ? 'iPhone' : 'Android'}</button>)}
              <button type="button" onClick={() => tick('magnets')} className={cn('border px-2.5 py-1', facts.phone?.magnets ? 'border-ink bg-ink text-paper' : 'border-rule-2 text-ink-2')}>Has Qi2 or MagSafe magnets</button>
            </div>
          )}
          {kind === 'hub' && (
            <div className="flex flex-wrap gap-2 text-[13px]">
              {(['homekit', 'google', 'alexa', 'matter', 'thread'] as const).map((p) => <button key={p} type="button" onClick={() => tick(p)} className={cn('border px-2.5 py-1', facts.hubs?.includes(p) ? 'border-ink bg-ink text-paper' : 'border-rule-2 text-ink-2')}>{{ homekit: 'Apple Home', google: 'Google Home', alexa: 'Alexa', matter: 'Matter', thread: 'Thread border router' }[p]}</button>)}
            </div>
          )}
          {kind === 'charger' && (
            <label className="flex items-center gap-2 text-[13px] text-ink-2">Watts <input type="number" min={5} max={300} onChange={(e) => setFacts({ pdOut: Number(e.target.value) || undefined })} className="h-8 w-24 border border-rule-2 bg-sheet px-2 text-ink" /></label>
          )}
          {kind === 'source' && (
            <div className="text-[13px] text-ink-2">A source needs an HDMI input on the product it plugs into.</div>
          )}
          <div className="flex gap-2">
            <Button size="sm" variant="primary" onClick={addCustom} disabled={!name.trim()}>Add</Button>
            <Button size="sm" variant="ghost" onClick={onDone}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  )
}

export function SetupPage() {
  const gear = useStore((s) => s.gear)
  const region = useRegion()
  const setRegion = useStore((s) => s.setRegion)
  const setup = useSetup()
  const go = useStore((s) => s.go)
  const [adding, setAdding] = useState<GearKind | null>(null)
  const passing = useMemo(() => query(products, { worksWithSetup: true }, 'trending', setup), [setup])
  const storageBlocked = useStore((s) => s.storageBlocked)

  return (
    <div className="mx-auto max-w-[1440px] px-4 pb-24 md:px-6 lg:pb-16">
      <nav aria-label="Breadcrumb" className="py-4 text-[13px] text-ink-3">
        <button type="button" onClick={() => go({ name: 'home' })} className="hover:text-ink">Home</button><span className="mx-1.5">/</span><span className="text-ink">My setup</span>
      </nav>
      <div className="grid grid-cols-12 gap-x-8 gap-y-8">
        <div className="col-span-12 lg:col-span-7">
          <h1 className="display-md text-[34px] text-ink sm:text-[44px]">My setup</h1>
          <p className="mt-2 max-w-[60ch] text-[15px] text-ink-2">Everything here is checked against every product before you pay: app platform, magnets, finder network, home hub and Thread, plug and voltage, inputs and charging power. Saved in this browser only.</p>
          {storageBlocked && <p className="mt-2 text-[12.5px] text-check">This browser is blocking storage, so your setup lasts until you close the tab.</p>}

          <div className="mt-6 border border-ink bg-sheet">
            <div className="flex items-center justify-between border-b border-rule px-4 py-2.5">
              <div><div className="text-[14px] text-ink">Where you are</div><div className="text-[12px] text-ink-3">Sets the plug and voltage check, the shipping zone and the checkout country</div></div>
              <select value={region} onChange={(e) => setRegion(e.target.value as Region)} className="h-8 border border-rule-2 bg-sheet px-2 text-[13px] text-ink">
                {(Object.keys(REGION_LABEL) as Region[]).map((r) => <option key={r} value={r}>{REGION_LABEL[r]}</option>)}
              </select>
            </div>
          </div>

          {KINDS.map((k) => {
            const items = gear.filter((g) => g.kind === k.kind)
            return (
              <section key={k.kind} className="mt-4 border border-rule bg-sheet" aria-labelledby={`kind-${k.kind}`}>
                <div className="flex items-center justify-between border-b border-rule px-4 py-2.5">
                  <div><h2 id={`kind-${k.kind}`} className="text-[14px] text-ink">{k.title}</h2><div className="text-[12px] text-ink-3">{k.hint}</div></div>
                  <button type="button" onClick={() => setAdding(adding === k.kind ? null : k.kind)} className="flex items-center gap-1 text-[13px] text-ink hover:underline underline-offset-4"><Plus size={14} /> Add</button>
                </div>
                <ul>
                  {items.length === 0 && <li className="px-4 py-3 text-[13px] text-ink-3">Nothing here yet.</li>}
                  {items.map((g) => <GearRow key={g.id} g={g} />)}
                </ul>
                {adding === k.kind && <AddDevice kind={k.kind} onDone={() => setAdding(null)} />}
              </section>
            )
          })}
        </div>

        <aside className="col-span-12 lg:col-span-5">
          <div className="border border-rule bg-sheet p-4">
            <div className="text-[14px] font-medium text-ink">What the check knows</div>
            <ul className="mt-2 space-y-1 text-[13.5px] text-ink-2">
              {setup.map((s) => <li key={s.id}>{s.name}</li>)}
              {setup.length === 0 && <li className="text-ink-3">Nothing switched on.</li>}
            </ul>
            <p className="mt-3 text-[12px] text-ink-3">{passing.length} of {products.length} products pass against this setup.</p>
          </div>
        </aside>
      </div>

      <section className="mt-12">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="display-md text-[26px] text-ink sm:text-[30px]">Works with everything here</h2>
          <button type="button" onClick={() => go({ name: 'collection', slug: 'trending', filters: { worksWithSetup: true } })} className="text-[13px] text-ink-2 underline underline-offset-4 hover:text-ink">See all {passing.length}</button>
        </div>
        <div className="scrollbar-none -mx-4 flex gap-px overflow-x-auto border-y border-rule bg-rule md:mx-0 md:grid md:grid-cols-4 md:overflow-visible md:border-x">
          {passing.slice(0, 4).map((p, i) => <div key={p.id} className="min-w-[270px] md:min-w-0"><ProductCard product={p} index={i} /></div>)}
        </div>
      </section>
    </div>
  )
}
