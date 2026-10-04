/* What the match rules threw out of today's CJ results, by term: each title as plain text and the rule that caught it. */
import type { Rejected, TermScore } from '../../../radar/src/types'

export function RejectedList({ items, terms, total = items.length }: { items: Rejected[]; terms: TermScore[]; total?: number }) {
  if (!items.length) return null
  const groups = new Map<string, Rejected[]>()
  for (const r of items) groups.set(r.termId, [...(groups.get(r.termId) ?? []), r])
  return (
    <details className="group mt-8 border-t border-rule pt-4">
      <summary className="cursor-pointer list-none text-[15px] font-medium text-ink underline decoration-rule-2 underline-offset-[5px] hover:decoration-ink [&::-webkit-details-marker]:hidden">{`Thrown out today (${Math.max(total, items.length)})`}</summary>
      <p className="mt-1.5 text-[12.5px] text-ink-3">CJ results the watch-term rules turned away before any detail or freight call. The reason names the word that decided it; &ldquo;detail:&rdquo; means the full product name failed.{total > items.length && ` Showing ${items.length} of ${total}, a share from each term.`}</p>
      <div className="mt-4 grid gap-x-8 gap-y-5 md:grid-cols-2">
        {[...groups].map(([termId, rs]) => (
          <section key={termId} className="min-w-0">
            <h3 className="text-[13px] font-medium text-ink">{terms.find((t) => t.id === termId)?.label ?? termId} <span className="reading text-[11px] text-ink-3">{rs.length}</span></h3>
            <ul className="mt-1.5 border-t border-rule">
              {rs.map((r) => (
                <li key={r.pid + r.reason} className="flex items-baseline justify-between gap-3 border-b border-rule py-1.5 text-[12.5px]">
                  <span className="min-w-0 text-ink-2">{r.name || 'No title on CJ'}</span>
                  <span className="reading shrink-0 text-[11px] text-ink-3">{r.reason}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </details>
  )
}
