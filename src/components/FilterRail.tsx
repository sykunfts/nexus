/* Ruled filter rail: facet groups as checkboxes with counts, four price bands, the works-with toggle. */
import { Facets } from '../lib/catalog'
import { Badge, Filters, Platform } from '../lib/routes'
import { cn } from '../lib/cn'
import { Toggle } from './ui'

interface Props {
  filters: Filters
  facets: Facets
  locked: Filters          // the collection's own filters, shown but not editable
  onChange: (next: Filters) => void
  header?: boolean         // false inside the mobile sheet, which has its own
}

export const activeCount = (f: Filters) =>
  (f.brand?.length ?? 0) + (f.platform?.length ?? 0) + (f.badge?.length ?? 0) + (f.price ? 1 : 0) + (f.route ? 1 : 0) + (f.inStock ? 1 : 0) + (f.worksWithSetup ? 1 : 0)

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-rule py-3">
      <div className="mb-1.5 text-[12.5px] text-ink-3">{title}</div>
      <ul className="space-y-0.5">{children}</ul>
    </div>
  )
}

function Check({ label, count, on, onChange, disabled }: { label: string; count: number; on: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <li>
      <label className={cn('flex cursor-pointer items-center justify-between gap-2 py-0.5 text-[13.5px]', disabled ? 'text-ink-3' : 'text-ink')}>
        <span className="flex items-center gap-2">
          <input type="checkbox" checked={on} onChange={onChange} disabled={disabled} className="h-3.5 w-3.5 appearance-none border border-rule-2 bg-sheet checked:border-ink checked:bg-ink" />
          {label}
        </span>
        <span className="reading text-[11px] text-ink-3">{count}</span>
      </label>
    </li>
  )
}

export function FilterRail({ filters, facets, locked, onChange, header = true }: Props) {
  const toggleIn = <T extends string>(key: 'brand' | 'platform' | 'badge', value: T) => {
    const cur = (filters[key] as T[] | undefined) ?? []
    const next = cur.includes(value) ? cur.filter((x) => x !== value) : [...cur, value]
    onChange({ ...filters, [key]: next.length ? next : undefined })
  }
  const n = activeCount(filters)
  return (
    <div className="text-ink">
      {header && (
        <div className="flex items-center justify-between border-b border-ink pb-2">
          <span className="text-[13.5px] font-medium">Filters{n ? ` (${n})` : ''}</span>
          {n > 0 && <button type="button" onClick={() => onChange({})} className="text-[12.5px] text-ink-2 underline underline-offset-4 hover:text-ink">Clear all</button>}
        </div>
      )}

      <div className="border-b border-rule py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[13.5px]">Works with my setup</div>
            <div className="text-[12px] text-ink-3">{facets.worksWithSetup} pass against your phone, home and plug</div>
          </div>
          <Toggle on={!!filters.worksWithSetup} onChange={() => onChange({ ...filters, worksWithSetup: filters.worksWithSetup ? undefined : true })} label="Only show products that work with my setup" />
        </div>
      </div>

      <Group title="Price">
        {facets.price.map((b) => {
          const on = !!filters.price && filters.price[0] === b.range[0] && filters.price[1] === b.range[1]
          return <Check key={b.label} label={b.label} count={b.count} on={on} onChange={() => onChange({ ...filters, price: on ? undefined : b.range })} disabled={!!locked.price} />
        })}
      </Group>

      {!locked.route && (
        <Group title="Ships from">
          {facets.route.map((r) => (
            <Check key={r.value} label={r.value === 'warehouse' ? 'Sydney stock' : 'Supplier direct'} count={r.count} on={filters.route === r.value} onChange={() => onChange({ ...filters, route: filters.route === r.value ? undefined : r.value })} />
          ))}
        </Group>
      )}

      {!locked.platform && (
        <Group title="Works with">
          {facets.platform.filter((p) => p.count > 0).map((p) => (
            <Check key={p.value} label={p.label} count={p.count} on={!!filters.platform?.includes(p.value)} onChange={() => toggleIn<Platform>('platform', p.value)} />
          ))}
        </Group>
      )}

      {!locked.brand && facets.brand.length > 1 && (
        <Group title="Brand">
          {facets.brand.map((b) => (
            <Check key={b.value} label={b.value} count={b.count} on={!!filters.brand?.includes(b.value)} onChange={() => toggleIn('brand', b.value)} />
          ))}
        </Group>
      )}

      {!locked.badge && facets.badge.length > 0 && (
        <Group title="Signal">
          {facets.badge.map((b) => (
            <Check key={b.value} label={b.value} count={b.count} on={!!filters.badge?.includes(b.value)} onChange={() => toggleIn<Badge>('badge', b.value)} />
          ))}
        </Group>
      )}

      <ul className="py-3">
        <Check label="In stock only" count={facets.route.reduce((n, r) => n + r.count, 0)} on={!!filters.inStock} onChange={() => onChange({ ...filters, inStock: filters.inStock ? undefined : true })} />
      </ul>
    </div>
  )
}
