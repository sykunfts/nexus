import { products } from '../../lib/data'
import { useSetup, useStore } from '../../lib/store'
import { CollectionLink, H2, Live, Note, P, ProductLink } from './Prose'

export function DoINeedAHub() {
  const setup = useSetup()
  const go = useStore((s) => s.go)
  const hubs = setup.filter((s) => s.facts.hubs)
  const hasThread = hubs.some((h) => h.facts.hubs!.includes('thread'))
  const needThread = products.filter((p) => p.facts.needsThread)
  const matter = products.filter((p) => p.facts.home?.includes('matter'))

  return (
    <div>
      <P>Probably not for the first device, and almost certainly yes by the third. Here is the short version of a long story, then a look at what your own hubs can and cannot do.</P>
      <H2>Three words that get mixed up</H2>
      <P><strong className="text-ink">Matter</strong> is a language. A Matter device can be added to Apple Home, Google Home or Alexa without the maker caring which. It replaces the old game of checking logos on the box.</P>
      <P><strong className="text-ink">Thread</strong> is a radio. It is low power and mesh, which is why battery devices such as locks and sensors like it. Matter can travel over Wi-Fi or over Thread; a device that only speaks Matter over Thread needs something on your network that bridges Thread to Wi-Fi.</P>
      <P><strong className="text-ink">A border router</strong> is that something. It is not a separate box you buy: it is a job some hubs already do. HomePod mini, Apple TV 4K (the Wi-Fi + Ethernet model, not the Wi-Fi-only one), Nest Hub 2nd gen, Nest Wifi Pro, Echo 4th gen and Echo Hub all are. Nest Mini and the Wi-Fi-only Apple TV are not. The device list on My setup carries that fact for each of them.</P>

      <Live title="your hubs and what needs Thread">
        {hubs.length === 0 ? (
          <p className="text-[13.5px] text-ink-2">No hub is switched on in your setup, so every smart-home product will say it stays in its own app. <button type="button" onClick={() => go({ name: 'setup' })} className="underline underline-offset-4">Add one</button>.</p>
        ) : (
          <ul className="text-[13.5px] text-ink-2">
            {hubs.map((h) => <li key={h.id}><span className="text-ink">{h.name}</span>: {h.facts.hubs!.includes('thread') ? 'Thread border router, so Matter-over-Thread devices will join.' : 'no Thread radio.'}</li>)}
          </ul>
        )}
        <p className="mt-3 text-[13.5px] text-ink-2">{hasThread ? 'You have a border router, so these pass:' : 'These need a border router you do not have yet:'}</p>
        <ul className="mt-1 flex flex-wrap gap-2">
          {needThread.map((p) => <li key={p.id}><ProductLink id={p.id}>{p.brand} {p.name}</ProductLink></li>)}
        </ul>
        {!hasThread && <p className="mt-3 text-[13.5px] text-ink-2">The fix the checker offers is the <ProductLink id="aqara-hub-m3">Aqara Hub M3</ProductLink>, which is a Matter controller and a Thread border router in one, and also bridges Zigbee.</p>}
      </Live>

      <H2>When you do need one</H2>
      <P>When you buy a Thread-only device (the <ProductLink id="nanoleaf-matter-strip-5m">Nanoleaf Thread strip</ProductLink> and the <ProductLink id="aqara-smart-lock-u300">Aqara U300 lock</ProductLink> in this catalogue) and have no border router. When you want Zigbee sensors, which Matter does not cover without a bridge. When you want automations to keep running with the internet down, which a local hub does and a cloud-only device does not.</P>
      <H2>When you do not</H2>
      <P>A Matter-over-Wi-Fi device such as the <ProductLink id="govee-rgbic-neon-rope-light-2">Govee rope light</ProductLink> joins any home app directly. A camera that records to Apple Home or Google Home over Wi-Fi needs no hub either. {matter.length} products in the catalogue speak Matter; the <CollectionLink slug="matter-thread">Matter and Thread</CollectionLink> collection lists them, and the works-with row on each page says whether it joins your home app or stays in its own.</P>
      <Note>Which hubs are border routers was checked on 3 October 2026 against the published list of Thread border routers and the makers' pages. Firmware updates add Thread to devices from time to time; if yours gained it, add it as a custom hub on My setup and tick Thread.</Note>
    </div>
  )
}
