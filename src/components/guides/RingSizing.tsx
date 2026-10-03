import { products } from '../../lib/data'
import { H2, Live, Note, P, ProductLink } from './Prose'

export function RingSizing() {
  const rings = products.filter((p) => p.options?.some((o) => o.id === 'size'))
  return (
    <div>
      <P>A smart ring is the one product in the catalogue you cannot return for being the wrong size once the sensor has been against your skin, so the makers ship a plastic sizing kit first and the ring second. That is why the size option says "free sizing kit ships first". Here is how to use the kit well.</P>
      <H2>Which finger</H2>
      <P>Index finger, non-dominant hand, is what every maker recommends: the capillary bed is dense and the finger moves less than a thumb. The ring finger works too. Avoid the little finger; the readings get noisy.</P>
      <H2>Wear the sizer for a day</H2>
      <P>Fingers swell in heat, after salt, in the evening and during exercise, and shrink in the cold and first thing in the morning. Wear the sizer you think fits for a full day and a night. It should turn with a little effort and not slide over the knuckle on its own. If you are between two, the makers say go up for a sensor ring, because a tight ring reads badly when you swell.</P>
      <H2>Ranges by ring</H2>
      <Live title="sizes sold, from the catalogue">
        <ul className="space-y-1 text-[13.5px] text-ink-2">
          {rings.map((p) => { const sizes = p.options!.find((o) => o.id === 'size')!.choices; return <li key={p.id}><ProductLink id={p.id}>{p.brand} {p.name}</ProductLink>: {sizes[0].label} to {sizes[sizes.length - 1].label} ({sizes.length} sizes)</li> })}
        </ul>
      </Live>
      <H2>Sizes are not interchangeable</H2>
      <P>A RingConn 9 and an Oura 9 are not the same inner diameter, and neither matches a jeweller's US 9 exactly. Use the kit from the ring you are buying, not a jeweller's measurement and not another brand's kit.</P>
      <Note>The <ProductLink id="ringconn-gen-3">RingConn Gen 3</ProductLink> has no subscription; the <ProductLink id="oura-ring-5">Oura Ring 5</ProductLink> needs a membership for the full readouts. That is a specs row on each page, not a surprise at checkout.</Note>
    </div>
  )
}
