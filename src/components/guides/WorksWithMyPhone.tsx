import { useMemo, useState } from 'react'
import { byId, products } from '../../lib/data'
import { DEVICES } from '../../lib/devices'
import { checkBuild, resolveFacts } from '../../lib/compat'
import { useSetup } from '../../lib/store'
import { CollectionLink, H2, Live, Note, P, ProductLink } from './Prose'
import { cn } from '../../lib/cn'

export function WorksWithMyPhone() {
  const setup = useSetup()
  const [productId, setProductId] = useState('anker-maggo-10k')
  const [phoneId, setPhoneId] = useState('pixel-9')
  const phones = DEVICES.filter((d) => d.kind === 'phone')
  const result = useMemo(() => {
    const p = byId(productId)
    const phone = phones.find((d) => d.id === phoneId)!
    const build = [{ id: phone.id, name: phone.name, facts: phone.facts }, ...setup.filter((s) => !s.id.startsWith('g-iphone') && !s.id.startsWith('g-pixel') && !s.id.startsWith('d-iphone') && !s.id.startsWith('d-pixel') && !s.id.startsWith('d-galaxy'))]
    return checkBuild({ name: p.name, facts: resolveFacts(p, {}), product: p }, build)
  }, [productId, phoneId, setup, phones])

  return (
    <div>
      <P>Most "compatible with" lists on a product page are a logo strip. Ours is a check that runs the moment the page opens, against the phone, hubs, chargers and sources you told us you own, and again in the cart with everything else you are buying. It has seven rules, and every one of them is a typed fact on the product, not a line of marketing copy.</P>
      <H2>The seven checks</H2>
      <P><strong className="text-ink">App platform.</strong> A product with a companion app lists the platforms it runs on. A smart ring that only has an Android app is a blocker on an iPhone, not a warning.</P>
      <P><strong className="text-ink">Magnets.</strong> A Qi2 or MagSafe accessory needs a magnet ring in the phone. Every iPhone since the 12 has one, except the iPhone 16e; the Pixel 10 has one; the Pixel 9 and every Galaxy up to the S26 do not. A stick-on steel ring fixes the ones that do not, and the check offers it.</P>
      <P><strong className="text-ink">Finder network.</strong> A finder tag joins Apple's Find My or Google's Find Hub, and the other phone cannot see it. Tags that let you choose at setup get an option on the page; the check tells you which to pick.</P>
      <P><strong className="text-ink">Home platform and Thread.</strong> A smart-home device has to speak something one of your hubs understands, and a Matter-over-Thread device needs a Thread border router on the network. The <CollectionLink slug="matter-thread">Matter and Thread</CollectionLink> collection is everything that passes through Matter; the <ProductLink id="aqara-hub-m3">Aqara Hub M3</ProductLink> is the fix when you have no border router.</P>
      <P><strong className="text-ink">Plug and voltage.</strong> A product ships with a plug for a region. Plug families decide the match (an Australian plug works in New Zealand), and a 110 V-only device is a blocker anywhere with 230 V mains, because an adapter does not convert voltage.</P>
      <P><strong className="text-ink">Inputs.</strong> If you own a Switch or a PlayStation, a projector needs an HDMI input. If it only takes USB-C, the check says so.</P>
      <P><strong className="text-ink">Charging power.</strong> A projector that draws 65 W while playing will drain its battery on a 20 W charger. The check compares the strongest charger you own against what the product needs.</P>

      <Live title="pick a product and a phone">
        <div className="flex flex-wrap gap-3 text-[13px]">
          <label className="flex items-center gap-2 text-ink-2">Product
            <select value={productId} onChange={(e) => setProductId(e.target.value)} className="h-8 border border-rule-2 bg-sheet px-2 text-ink">
              {products.filter((p) => p.facts.app || p.facts.magnetic || p.facts.home || p.options?.some((o) => o.id === 'network')).map((p) => <option key={p.id} value={p.id}>{p.brand} {p.name}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2 text-ink-2">Phone
            <select value={phoneId} onChange={(e) => setPhoneId(e.target.value)} className="h-8 border border-rule-2 bg-sheet px-2 text-ink">
              {phones.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </label>
        </div>
        <div className={cn('mt-3 border px-3 py-2.5 text-[13.5px]', result.status === 'ok' ? 'border-pass bg-pass-tint text-pass' : result.status === 'warn' ? 'border-check bg-check-tint text-check' : 'border-fail bg-fail-tint text-fail')}>
          <div className="font-medium">{result.status === 'ok' ? 'Works' : result.status === 'warn' ? 'Needs attention' : 'Does not work'}: {result.summary}</div>
          <ul className="mt-1 space-y-1 text-ink-2">{result.issues.map((i) => <li key={i.id}>{i.title}. {i.because}{i.fix ? ` Fix: ${i.fix.label}.` : ''}</li>)}</ul>
        </div>
      </Live>

      <H2>What it does not check</H2>
      <P>Whether you will like it. Whether the app is any good. Whether the maker will still be around to run the servers in three years. Those are what the independent tests and the notes on each page are for, and what we do not pretend to know.</P>
      <Note>Your setup lives in this browser and is never uploaded. Edit it on the My setup page; every product page re-checks itself the moment you do.</Note>
    </div>
  )
}
