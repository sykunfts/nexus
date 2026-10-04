/* Claimed, then measured: what the maker claims against what independent reviewers measured, as three tiles and a disclosure for the rest. */
import { benchFor, verdictText, type BenchRow } from '../lib/bench'
import { cn } from '../lib/cn'

const SPANS = ['lg:col-span-5', 'lg:col-span-4', 'lg:col-span-3']

function Verdict({ row }: { row: BenchRow }) {
  return (
    <span className={cn('flex items-center gap-2 text-[14px]', row.verdict === 'pass' ? 'text-pass' : 'text-check')}>
      <span aria-hidden="true" className={cn('inline-block h-2.5 w-2.5 shrink-0', row.verdict === 'pass' ? 'bg-pass' : 'bg-check')} />
      {verdictText(row)}
    </span>
  )
}

export function BenchResults({ productId }: { productId: string }) {
  const rows = benchFor(productId)
  if (rows.length === 0) return null
  const tiles = rows.slice(0, 3)
  const rest = rows.slice(3)
  return (
    <section aria-labelledby="bench-h">
      <h2 id="bench-h" className="display text-[30px] text-ink lg:text-[40px]">Claimed, then measured</h2>
      <p className="mt-2 max-w-[70ch] text-[15px] text-ink-2">What the maker claims against what independent reviewers measured. Replaced by Nexus bench results once a unit has been through the Sydney bench.</p>
      <div className="mt-7 grid grid-cols-12 gap-4">
        {tiles.map((r, i) => (
          <div key={r.metric} className={cn('col-span-12 flex flex-col gap-3.5 rounded-[2px] border border-rule bg-sheet p-6 md:col-span-6', SPANS[i])}>
            <span className="text-[14.5px] text-ink-2">{r.metric}</span>
            <span className="numeral text-[26px] text-ink lg:text-[34px]">{r.measured}</span>
            <span className="text-[14px] text-ink-2">{r.claimed ? `Claimed ${r.claimed}` : 'Not claimed'}</span>
            <Verdict row={r} />
            <a href={r.url} target="_blank" rel="noreferrer" className="self-start text-[13px] text-ink-3 underline decoration-rule-2 underline-offset-4 hover:text-ink hover:decoration-ink">Measured by {r.by}</a>
          </div>
        ))}
      </div>
      {rest.length > 0 && (
        <details className="group mt-5">
          <summary className="cursor-pointer list-none text-[15px] text-ink underline decoration-rule-2 underline-offset-[5px] hover:decoration-ink [&::-webkit-details-marker]:hidden">All {rows.length} measurements</summary>
          <ul className="mt-4 border-t border-ink">
            {rest.map((r) => (
              <li key={r.metric} className="grid grid-cols-1 gap-x-6 gap-y-1 border-b border-rule px-1 py-3.5 last:border-b-0 md:grid-cols-[1fr_auto_220px] md:items-center">
                <span className="text-[15px] text-ink">{r.metric}{r.claimed ? <span className="text-ink-3">, claimed {r.claimed}</span> : null}</span>
                <a href={r.url} target="_blank" rel="noreferrer" title={`Measured by ${r.by}`} className="numeral text-[15px] text-ink underline decoration-rule-2 underline-offset-4 hover:decoration-ink">{r.measured}</a>
                <Verdict row={r} />
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}
