/* How Nexus ships, as four big numbers. The slab above overhangs this band at desktop widths. */
import { priceCheckedText, products } from '../../lib/data'
import { etaText } from '../../lib/shipping'
import { useZone } from '../../lib/store'
import { LATEST_CHECK } from './rails'

export function Facts() {
  const zone = useZone()
  const items: [string, string, string][] = [
    [etaText('AU', zone), 'Sydney stock, tracked', 'lg:col-span-3'],
    [etaText('CN', zone), 'Supplier direct from China, priced lower', 'lg:col-span-3'],
    [`${products.length} products`, `Real, sold today, prices checked ${priceCheckedText(LATEST_CHECK)}`, 'lg:col-span-3'],
    ['30 days', 'Change of mind on Sydney stock, consumer guarantees on everything', 'lg:col-span-3'],
  ]
  return (
    <section aria-label="How Nexus ships" className="mt-10 border-t border-rule pt-10 lg:pt-32">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-8 lg:grid-cols-12 lg:gap-x-8">
        {items.map(([value, label, span]) => (
          <div key={label} className={span}>
            <dt className="numeral whitespace-nowrap text-[20px] text-ink sm:text-[24px] lg:text-[26px] xl:text-[34px]">{value}</dt>
            <dd className="mt-2 text-[13.5px] text-ink-2 lg:mt-3 lg:text-[15px]">{label}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
