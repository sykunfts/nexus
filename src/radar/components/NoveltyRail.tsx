/*
  What This Is Why I'm Broke posted lately: titles and links only, with the matched term when there is one.
  Alcohol, tobacco, weapons and adult items are hidden here as well as in the pipeline, so an older file is cleaned too.
*/
import type { NoveltyItem, TermScore } from '../../../radar/src/types'
import { filterNovelty } from '../../../radar/src/novelty'

export function NoveltyRail({ items, terms, hiddenInFile = 0 }: { items: NoveltyItem[]; terms: TermScore[]; hiddenInFile?: number }) {
  const { items: shown, hidden } = filterNovelty(items)
  const hiddenTotal = hidden + hiddenInFile
  if (!shown.length && !hiddenTotal) return null
  return (
    <section className="mt-10" aria-labelledby="novelty">
      <h2 id="novelty" className="text-[15px] font-medium text-ink">What This Is Why I&rsquo;m Broke is posting</h2>
      <p className="mt-1 text-[12.5px] text-ink-3">A small novelty signal. Titles and links from their public feed; nothing else is copied.</p>
      <ul className="mt-3 grid border-l border-t border-rule sm:grid-cols-2 lg:grid-cols-3">
        {shown.slice(0, 12).map((n) => (
          <li key={n.link + n.title} className="flex items-start justify-between gap-3 border-b border-r border-rule bg-sheet px-3 py-2.5 text-[13px]">
            <a href={n.link} target="_blank" rel="noopener noreferrer" className="text-ink underline decoration-rule-2 underline-offset-4 hover:decoration-ink">{n.title}</a>
            {n.termId && <span className="reading shrink-0 text-[11px] text-ink-3">{terms.find((t) => t.id === n.termId)?.label ?? n.termId}</span>}
          </li>
        ))}
      </ul>
      {hiddenTotal > 0 && <p className="mt-2 text-[12px] text-ink-3">{`${hiddenTotal} hidden (alcohol, tobacco, weapons or adult)`}</p>}
    </section>
  )
}
