/* Shipping and returns: the live ETA table from shipping.ts, the returns rule as decided, and the ACL path. */
import { H2, Live, Note, P } from '../../components/guides/Prose'
import { ETA, ZONE_LABEL, type Zone } from '../../lib/shipping'
import type { Origin } from '../../lib/data'
import { BUSINESS, RETURNS_LINE } from './business'

const ORIGINS: { origin: Origin; label: string }[] = [
  { origin: 'AU', label: 'Sydney stock' },
  { origin: 'CN', label: 'Supplier direct, China' },
  { origin: 'US', label: 'Maker direct, United States' },
  { origin: 'EU', label: 'Maker direct, Europe' },
  { origin: 'UK', label: 'Maker direct, United Kingdom' },
]
const ZONES: Zone[] = ['AU', 'NZ', 'NA', 'UK', 'EU', 'ASIA', 'ROW']

export function ShippingReturns() {
  return (
    <>
      <H2>Two routes</H2>
      <P>"Sydney stock" ships from our warehouse. "Supplier direct" ships from the maker's region, mostly China, takes longer and usually costs less. Both are tracked and the tracking number is emailed when the parcel leaves. The destination decides tax: GST included for Australia, VAT added for the UK and Europe, duties collected on delivery where we cannot estimate them.</P>

      <Live title="delivery windows in days, by route and destination">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-[13px]">
            <thead>
              <tr className="text-left text-[12px] text-ink-3">
                <th className="py-1.5 pr-3 font-normal">Route</th>
                {ZONES.map((z) => <th key={z} className="py-1.5 pr-3 font-normal">{ZONE_LABEL[z]}</th>)}
              </tr>
            </thead>
            <tbody>
              {ORIGINS.map(({ origin, label }) => (
                <tr key={origin} className="border-t border-rule">
                  <td className="py-1.5 pr-3 text-ink">{label}</td>
                  {ZONES.map((z) => <td key={z} className="reading py-1.5 pr-3 text-ink-2">{ETA[origin][z][0]}-{ETA[origin][z][1]} days</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[12.5px] text-ink-3">Windows are the carrier's working-day estimates from dispatch; customs can add days outside Australia. The checkout shows the supplier's live quote for your address, which may be faster than the table.</p>
      </Live>

      <H2>Returns</H2>
      <P>The rule in one line: {RETURNS_LINE}.</P>
      <P>Change of mind: anything that shipped from Sydney stock can come back within 30 days of delivery, unused and in its packaging, for a refund of the product price. You pay the return postage. Supplier-direct products shipped from China cannot be returned for change of mind; the postage back to the maker would cost more than most of them, so we would rather say so before you buy than argue after.</P>
      <P>Faulty, not as described, or not doing what it should: the Australian Consumer Law guarantees apply to everything we sell, on both routes, and nothing above limits them. You are entitled to a repair, replacement or refund, and for a major failure you choose which.</P>

      <H2>How to make a claim</H2>
      <P>Email {BUSINESS.contactEmail} with the order number, a few photos or a short video of the problem, and what you would like done. We answer with an outcome within five business days. For a change-of-mind return we send a return address; for a fault we usually do not need the item back, and when we do we pay the postage. Refunds go to the card you paid with and take 5-10 business days to show.</P>

      <Note>This policy is a draft in plain language. The change-of-mind part is our choice; the consumer-guarantee part restates the law and will be reviewed by a lawyer before the shop goes live.</Note>
    </>
  )
}
