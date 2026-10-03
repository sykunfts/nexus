import { products } from '../../lib/data'
import { CollectionLink, H2, Live, Note, P, ProductLink } from './Prose'

export function RedVsNearInfrared() {
  const masks = products.filter((p) => p.category === 'Health' && /mask/i.test(p.name + ' ' + p.tagline))
  return (
    <div>
      <P>Every LED mask on the market lists two numbers in nanometres, usually around 630 and 830. They are not two strengths of the same thing. Red light you can see; near-infrared you cannot, and it travels deeper. Here is what the makers claim each one is for, what the published research supports, and how to read the spec rows without being sold to.</P>
      <H2>Red, about 630 nm</H2>
      <P>Visible red is absorbed in the outer layers of the skin. The maker framing is "collagen, tone and fine lines". The research behind that is mostly small trials of in-clinic devices with more power than a home mask, which is why home devices need longer, regular sessions and the makers say "weeks" rather than "days".</P>
      <H2>Near-infrared, about 830 nm</H2>
      <P>Near-infrared penetrates further, towards the dermis and below. The maker framing is "deeper repair, recovery and inflammation". It is also the wavelength you cannot see, so a mask that looks dim is not necessarily weak; the light is there, outside your eyes' range.</P>
      <H2>What the numbers on the box mean</H2>
      <P>LED count tells you coverage, not strength. Wavelength tells you depth. Irradiance in milliwatts per square centimetre would tell you dose, and most consumer makers do not publish it, which is why it is not a spec row here. Session length is the one number you can hold a maker to: a mask that needs 10 minutes a day is making a different promise from one that needs three.</P>
      <Live title="the masks, by wavelength and session">
        <ul className="space-y-1 text-[13.5px] text-ink-2">
          {masks.map((p) => { const rows = p.specs.flatMap((g) => g.rows); const leds = rows.find((r) => /led/i.test(r.label))?.value; const session = rows.find((r) => /session|treatment/i.test(r.label))?.value; return <li key={p.id}><ProductLink id={p.id}>{p.brand} {p.name}</ProductLink>: {leds ?? 'LEDs not stated'}; {session ? `session ${session}` : 'session length not stated'}</li> })}
        </ul>
        <p className="mt-3 text-[13.5px]"><CollectionLink slug="led-masks">All LED masks</CollectionLink></p>
      </Live>
      <H2>Clearance is not proof</H2>
      <P>"FDA-cleared" means a device was found substantially equivalent to one already on the market, for a stated use. "TGA-listed" means it is on the Australian register as a low-risk device. Neither is a verdict on whether it works for you. Where a maker states clearance we quote it on the specs row as the maker's statement; where a stockist states it we say so.</P>
      <Note>This is the maker's and the published research's framing, not medical advice. If you have a skin condition, photosensitivity or take medication that reacts to light, ask a clinician before using any light-therapy device. The <ProductLink id="omnilux-contour-face">Omnilux Contour Face</ProductLink> page lists what Omnilux publishes and what we could not verify.</Note>
    </div>
  )
}
