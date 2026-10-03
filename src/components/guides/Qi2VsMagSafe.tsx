import { products } from '../../lib/data'
import { DEVICES } from '../../lib/devices'
import { useSetup } from '../../lib/store'
import { CollectionLink, H2, Live, Note, P, ProductLink } from './Prose'

export function Qi2VsMagSafe() {
  const setup = useSetup()
  const phones = setup.filter((s) => s.facts.phone)
  const magnetic = products.filter((p) => p.facts.magnetic)
  const withMagnets = DEVICES.filter((d) => d.kind === 'phone' && d.facts.phone?.magnets).map((d) => d.name)
  const without = DEVICES.filter((d) => d.kind === 'phone' && d.facts.phone && !d.facts.phone.magnets).map((d) => d.name)
  return (
    <div>
      <P>MagSafe is Apple's name for a ring of magnets around a wireless charging coil. Qi2 is the industry standard that borrowed the idea, so a Qi2 power bank snaps onto an iPhone and charges at 15 W, and a MagSafe accessory snaps onto a Qi2 phone. The catch is the word "phone": the magnets have to be in the phone, and on most Android phones they are not.</P>
      <H2>Which phones have the ring</H2>
      <P>Built in: {withMagnets.join(', ')}. Not built in: {without.join(', ')}. Samsung's Galaxy S25 and S26 are "Qi2 Ready", which means they charge at Qi2 speed with a magnetic case but have nothing to grab without one. The iPhone 16e is the one iPhone without MagSafe.</P>
      <H2>What goes wrong</H2>
      <P>A <ProductLink id="anker-maggo-10k">magnetic power bank</ProductLink> on a Pixel 9 still charges, slowly, as long as you hold it in place; it slides off the moment you put the phone in a pocket. A magnetic car mount holds nothing. A 3-in-1 pad charges the phone only if it is sitting dead centre.</P>
      <H2>The fix is a ring</H2>
      <P>A thin steel ring that sticks to the back of the phone or its case gives the magnets something to hold. The <ProductLink id="esr-halolock-ring">ESR HaloLock ring</ProductLink> is about a millimetre thick and comes with an alignment guide so the coil lines up. It does not make the phone charge faster; it makes the accessory stay put. The works-with check offers it automatically when it sees a phone without magnets and a magnetic product in the cart.</P>
      <Live title="your phones against the magnetic products">
        {phones.length === 0 ? <p className="text-[13.5px] text-ink-2">No phone is switched on in your setup.</p> : (
          <ul className="space-y-1 text-[13.5px] text-ink-2">
            {phones.map((p) => <li key={p.id}><span className="text-ink">{p.name}</span>: {p.facts.phone!.magnets ? `has magnets, so all ${magnetic.length} magnetic products snap on.` : `no magnets, so the ${magnetic.length} magnetic products need the ring first.`}</li>)}
          </ul>
        )}
        <p className="mt-3 text-[13.5px]"><CollectionLink slug="magnetic-charging">All magnetic charging products</CollectionLink></p>
      </Live>
      <Note>Qi2.2 raised the ceiling to 25 W in 2025. Whether a given phone or bank reaches it is a per-model fact; the specs on each product page say what the maker publishes and nothing more.</Note>
    </div>
  )
}
