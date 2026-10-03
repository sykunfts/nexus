import { priceCheckedText, products } from '../lib/data'
import { useStore } from '../lib/store'
import { H2, Note, P } from '../components/guides/Prose'

export function HowWePickPage() {
  const go = useStore((s) => s.go)
  const rated = products.filter((p) => p.rating).length
  const sourced = products.filter((p) => p.priceSource).length
  return (
    <div className="mx-auto max-w-[1440px] px-4 pb-24 md:px-6 lg:pb-16">
      <nav aria-label="Breadcrumb" className="py-4 text-[13px] text-ink-3"><button type="button" onClick={() => go({ name: 'home' })} className="hover:text-ink">Home</button><span className="mx-1.5">/</span><span className="text-ink">How we pick</span></nav>
      <article className="max-w-[72ch]">
        <h1 className="display-md max-w-[18ch] text-[36px] text-ink sm:text-[48px]">How we pick what to list</h1>
        <P>Nexus sells trending tech. "Trending" is a measurement, "sells" is a promise, and the gap between the two is where most stores put the marketing. Here is how we close it.</P>
        <H2>Velocity gets a product onto the list</H2>
        <P>A product earns a look when interest in it is climbing: searches, articles, forum threads. The movers board and the trend tiles show that growth, as a percentage over seven days, never as sales. Today those figures are sample data; a daily worker that reads public, free sources replaces them, and the header says which you are looking at.</P>
        <H2>A verified price and verified specs keep it there</H2>
        <P>Every product page carries the date its price was checked and where. {sourced} of the {products.length} products were priced outside Australia, and those pages show the listed amount and currency alongside the converted price. Specs come from the maker's page or a major retailer in the product's home market. Anything we could not verify is a note on the page, not a fact in the table.</P>
        <H2>Works-with facts are typed, not scraped</H2>
        <P>App platform, magnets, home protocols and Thread, plug and voltage, inputs and charging power are fields on each product, and the same engine reads them on the product page, in the cart and at checkout. A fact we do not have is a check we do not run; we do not fill the gap with "compatible".</P>
        <H2>Independent tests until our own</H2>
        <P>The product-of-the-week card shows what the maker claims next to what reviewers measured, with a link to each review. We have not measured anything ourselves yet, and the card says so. When a unit has been through the Sydney bench, our numbers replace theirs, with the same sourcing.</P>
        <H2>Ratings only where they exist</H2>
        <P>{rated} products show a rating. Each one is a maker's or retailer's figure where both the value and the review count were visible on one page, and the page names where. The rest say "No reviews yet". We do not write reviews and we do not invent bench numbers.</P>
        <H2>Two routes, one standard</H2>
        <P>"Sydney stock" ships from our warehouse in two to four days within Australia. "Supplier direct" ships from the maker's region, mostly China, and takes longer and usually costs less. Both are tracked, both carry the same returns window, and the destination decides shipping and tax: GST included for Australia, VAT added for the UK and Europe, duties on delivery where we cannot estimate them.</P>
        <Note>Prices move. The date on each page is the day we last looked, and a product whose price we can no longer verify comes off the shelf rather than staying at a stale number.</Note>
      </article>

      <h2 className="display-md mt-14 text-[26px] text-ink sm:text-[30px]">Sources, by product</h2>
      <div className="mt-3 overflow-x-auto border border-rule">
        <table className="w-full min-w-[640px] border-collapse text-[13px]">
          <thead><tr className="bg-sheet text-left text-[12.5px] text-ink-3"><th className="px-4 py-2 font-normal">Product</th><th className="px-4 py-2 font-normal">Checked at</th><th className="px-4 py-2 font-normal">Date</th><th className="px-4 py-2 font-normal">Listed as</th></tr></thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className="border-t border-rule bg-sheet">
                <td className="px-4 py-1.5"><button type="button" onClick={() => go({ name: 'product', id: p.id })} className="text-ink hover:underline underline-offset-4">{p.brand} {p.name}</button></td>
                <td className="px-4 py-1.5 text-ink-2">{p.sources.join(', ')}</td>
                <td className="reading px-4 py-1.5 text-[12px] text-ink-2">{priceCheckedText(p.priceCheckedAt)}</td>
                <td className="reading px-4 py-1.5 text-[12px] text-ink-2">{p.priceSource ? `${p.priceSource.currency} ${p.priceSource.amount}` : 'AUD'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
