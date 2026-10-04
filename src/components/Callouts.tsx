/* Dimension callouts on the bench slab: height and width from the Size spec, weight from the Weight spec, as orange tiles. */
import type { Product } from '../lib/data'

const specRow = (p: Product, label: string) => p.specs.flatMap((g) => g.rows).find((r) => r.label === label)

/** ["207.6 mm", "96.5 mm", "1.32 kg"] for a product whose specs measure it; [] when there is no measurable Size row. */
export function callouts(product: Product): string[] {
  const size = specRow(product, 'Size')?.value.trim()
  if (!size) return []
  const dims = size.match(/(\d+(?:\.\d+)?)\s*[×x]\s*(\d+(?:\.\d+)?)/)
  const unit = size.match(/([A-Za-z]+)$/)?.[1]
  if (!dims || !unit) return []
  const out = [`${dims[1]} ${unit}`, `${dims[2]} ${unit}`]
  const weight = specRow(product, 'Weight')?.value.trim()
  if (weight && /^\d+(?:[.,]\d+)?\s*[A-Za-z]+$/.test(weight)) out.push(weight)
  return out
}

/** Absolutely positioned over a `relative` parent; the first chip overhangs the right edge on purpose.
    `lines={false}` drops the dimension lines, for views the shopper can rotate or zoom. */
export function Callouts({ product, lines = true }: { product: Product; lines?: boolean }) {
  const [height, width, weight] = callouts(product)
  if (!height) return null
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      {lines && (
        <svg viewBox="0 0 400 300" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid meet">
          <g className="dim-line" fill="none">
            <path d="M270 46 H278 M270 250 H278 M274 46 V250" />
            <path d="M146 262 V270 M254 262 V270 M146 266 H254" />
          </g>
        </svg>
      )}
      <span className="tile absolute" style={{ right: -22, top: '46%' }}>{height}</span>
      {width && <span className="tile absolute left-1/2 -translate-x-1/2" style={{ bottom: 14 }}>{width}</span>}
      {weight && <span className="tile absolute" style={{ left: 24, top: 16 }}>{weight}</span>}
    </div>
  )
}
