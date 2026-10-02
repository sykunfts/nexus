import { motion } from 'framer-motion'
import { byId, NavSection } from '../lib/data'
import { fmt } from '../lib/currency'
import { useStore } from '../lib/store'
import { ProductVisual } from './ProductVisual'
import { Tile } from './ui'

export function MegaMenu({ section, onClose }: { section: NavSection; onClose: () => void }) {
  const featured = byId(section.featured)
  const currency = useStore((s) => s.currency)
  const go = useStore((s) => s.go)

  return (
    <motion.div
      key={section.id}
      role="region"
      aria-label={`${section.label} menu`}
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -2, transition: { duration: 0.12 } }}
      transition={{ duration: 0.16 }}
      className="absolute inset-x-0 top-full"
    >
      <div className="mx-auto grid max-w-[1440px] grid-cols-12 border-x border-b border-ink bg-sheet">
        <div className="col-span-8 grid grid-cols-3 divide-x divide-rule">
          {section.columns.map((col) => (
            <div key={col.title} className="px-6 py-6">
              <div className="mb-3 text-[13px] text-ink-3">{col.title}</div>
              <ul className="space-y-1.5">
                {col.items.map((item) => (
                  <li key={item}>
                    <a href="#" onClick={(e) => { e.preventDefault(); onClose() }} className="block text-[15px] text-ink hover:underline underline-offset-4 decoration-signal decoration-2">
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => { go({ name: 'pdp', id: featured.id }); onClose() }}
          className="group col-span-4 flex gap-5 border-l border-rule bg-paper p-6 text-left hover:bg-paper-2"
        >
          <div className="w-[46%] shrink-0 self-center">
            <ProductVisual visual={featured.visual} hue={featured.hue} glow={false} />
          </div>
          <div className="min-w-0 self-center">
            <div className="text-[12.5px] text-ink-3">This week in {section.label.toLowerCase()}</div>
            <div className="mt-1 text-[18px] font-medium leading-tight text-ink">{featured.brand} {featured.name}</div>
            <div className="mt-1 line-clamp-2 text-[13px] text-ink-2">{featured.tagline}</div>
            <div className="mt-3 flex items-center gap-2">
              <span className="reading text-[13px] text-ink">{fmt(featured.price, currency, { compact: true })}</span>
              <Tile>+{featured.trend.delta}%</Tile>
            </div>
          </div>
        </button>
      </div>
    </motion.div>
  )
}
