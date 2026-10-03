/* Every watch term with its delta, label, confidence and the sources that answered: the trend half of the tool, shown whenever there are no candidates to rank. */
import type { SourceId, TermScore } from '../../../radar/src/types'
import { Sparkline } from '../../components/ProductCard'
import { cn } from '../../lib/cn'

const SHORT: Record<SourceId, string> = { wikipedia: 'W', hackernews: 'HN', reddit: 'R', tiwib: 'T' }

export function TermsTable({ terms, reason }: { terms: TermScore[]; reason: string | null }) {
  const rows = [...terms].sort((a, b) => b.delta - a.delta)
  return (
    <section className="mt-6" aria-labelledby="terms-heading">
      {reason && <p className="mb-4 border border-check bg-check-tint px-3 py-2 text-[13.5px] text-check">{reason}</p>}
      <h2 id="terms-heading" className="text-[15px] font-medium text-ink">Terms watched</h2>
      <p className="mt-1 text-[12.5px] text-ink-3">Week-over-week change in interest for each watch term. W Wikipedia, HN Hacker News, R Reddit, T This Is Why I&rsquo;m Broke.</p>
      <table className="mt-3 w-full border-collapse text-[13px]" aria-label="Terms watched">
        <thead>
          <tr className="border-b border-ink text-left text-[12px] text-ink-3"><th className="py-1.5 pr-3 font-normal">Term</th><th className="py-1.5 pr-3 font-normal">Section</th><th className="reading py-1.5 pr-3 text-right font-normal">Change</th><th className="py-1.5 pr-3 font-normal">Label</th><th className="py-1.5 pr-3 font-normal">Shape</th><th className="py-1.5 pr-3 font-normal">Sources</th></tr>
        </thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.id} className="border-b border-rule">
              <td className="py-1.5 pr-3 text-ink">{t.label}</td>
              <td className="py-1.5 pr-3 text-ink-2">{t.section}</td>
              <td className={cn('reading py-1.5 pr-3 text-right', t.delta >= 50 ? 'text-ink' : 'text-ink-3')}>{t.delta >= 0 ? '+' : '−'}{Math.abs(t.delta)} %</td>
              <td className="py-1.5 pr-3"><span className={cn('reading px-1.5 py-0.5 text-[11px]', t.trendLabel === 'Steady' ? 'bg-paper-2 text-ink-2' : 'bg-signal text-ink')}>{t.trendLabel}</span></td>
              <td className="py-1.5 pr-3"><Sparkline series={t.series.length ? t.series : [0, 0, 0, 0, 0, 0, 0, 0]} /></td>
              <td className="reading py-1.5 pr-3 text-[11.5px] text-ink-2">{(Object.keys(t.sources) as SourceId[]).filter((s) => t.sources[s]).map((s) => SHORT[s]).join(' ') || 'none'} <span className="text-ink-3">({t.confidence})</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
