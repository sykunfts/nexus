import { useState } from 'react'
import { products } from '../../lib/data'
import { useStore } from '../../lib/store'
import { Button } from '../ui'
import { CollectionLink, H2, Live, Note, P, ProductLink } from './Prose'

export function MovieNight() {
  const setAdvisor = useStore((s) => s.setAdvisor)
  const projectors = products.filter((p) => p.category === 'Home cinema' && /projector/i.test(p.tagline + ' ' + p.name))
  const [id, setId] = useState('xgimi-mogo-4-laser')
  const [distance, setDistance] = useState(2.7)
  const p = projectors.find((x) => x.id === id) ?? projectors[0]
  const ratio = p.throwRatio?.value
  const widthM = ratio ? distance / ratio : null
  const heightM = widthM ? widthM * 9 / 16 : null
  const diagonalIn = widthM ? Math.sqrt(widthM ** 2 + heightM! ** 2) / 0.0254 : null

  return (
    <div>
      <P>A projector is sold on lumens and a screen on inches, and neither tells you what you will see on the night. What matters is how far the lens sits from the wall, how much light is in the room, and whether the sound and the power are sorted before the film starts. This guide does the arithmetic and then builds the kit.</P>
      <H2>How big the picture gets</H2>
      <P>Every projector has a throw ratio: the distance to the wall divided by the width of the picture. The <ProductLink id="xgimi-mogo-4-laser">MoGo 4 Laser</ProductLink> is 1.2:1, so at 2.4 metres the picture is 2 metres wide, which is a 90-inch diagonal; a 100-inch picture needs about 2.7 metres. The <ProductLink id="xgimi-vibe-one">Vibe One</ProductLink> is 1.3:1 and needs a little more room for the same size. Makers that do not publish the ratio get an honest blank below rather than a guess.</P>

      <Live title="throw distance calculator">
        <div className="flex flex-wrap items-end gap-4 text-[13px]">
          <label className="flex flex-col gap-1 text-ink-2">Projector
            <select value={id} onChange={(e) => setId(e.target.value)} className="h-8 border border-rule-2 bg-sheet px-2 text-ink">
              {projectors.map((x) => <option key={x.id} value={x.id}>{x.brand} {x.name}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-ink-2">Distance to the wall, metres
            <input type="range" min={0.5} max={10} step={0.1} value={distance} onChange={(e) => setDistance(Number(e.target.value))} className="w-56 accent-ink" aria-valuetext={`${distance} metres`} />
          </label>
          <span className="reading text-[15px] text-ink">{distance.toFixed(1)} m</span>
        </div>
        <div className="mt-4 grid gap-px bg-rule sm:grid-cols-3">
          {ratio ? (
            <>
              <div className="bg-sheet p-3"><div className="text-[12px] text-ink-3">Diagonal</div><div className="reading text-[22px] text-ink" data-diagonal>{Math.round(diagonalIn!)}″</div></div>
              <div className="bg-sheet p-3"><div className="text-[12px] text-ink-3">Picture, 16:9</div><div className="reading text-[22px] text-ink">{widthM!.toFixed(2)} × {heightM!.toFixed(2)} m</div></div>
              <div className="bg-sheet p-3"><div className="text-[12px] text-ink-3">Throw ratio</div><div className="reading text-[22px] text-ink">{ratio}:1</div><div className="text-[11px] text-ink-3">per {new URL(p.throwRatio!.source).hostname}</div></div>
            </>
          ) : (
            <div className="bg-sheet p-3 sm:col-span-3 text-[13.5px] text-ink-2">Throw ratio not published for the {p.brand} {p.name} on a page we read, so the calculator will not guess. The product page lists what the maker does state.</div>
          )}
        </div>
        {ratio && diagonalIn! > 120 && <p className="mt-2 text-[12.5px] text-check">Over 120 inches the brightness thins out fast on a battery projector; bring the wall closer or dim the room.</p>}
      </Live>

      <H2>Light is the enemy</H2>
      <P>Reviewers measured the MoGo 4 Laser at roughly 370 to 390 ANSI lumens in its standard mode against a 550 ISO claim, which is the figure on our product-of-the-week card with its source. That is plenty on a wall at night and not enough beside a lamp. A matte white screen like the <ProductLink id="elite-yard-master-2-100">Yard Master 2</ProductLink> gives a flatter, brighter picture than paint; an ALR screen would reject side light but none in the catalogue has a verified price yet.</P>
      <H2>Power and sound</H2>
      <P>The battery claim is 2.5 hours in Eco; an independent test ran 1 hour 53 minutes in Standard. A film is longer than that. The <ProductLink id="anker-prime-100w">Anker Prime 100 W</ProductLink> covers the 65 W draw with room for a phone, and the works-with check will warn you if the charger you own is weaker. For sound, the built-in speakers are fine for a bedroom; outdoors, a Bluetooth speaker or open-ear buds for two beat them.</P>
      <Live title="the kit, priced and checked">
        <p className="text-[13.5px] text-ink-2">The Trend Scout builds the movie-night kit against your setup and budget: projector, screen and charger, swapped to fit.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="primary" size="sm" onClick={() => setAdvisor(true)}>Build my movie-night kit</Button>
          <CollectionLink slug="battery-projectors">All battery projectors</CollectionLink>
        </div>
      </Live>
      <Note>The throw ratios here come from the maker's spec page or ProjectorCentral's database, with the source shown under the figure. If the number is not on a page we read, we say so.</Note>
    </div>
  )
}
