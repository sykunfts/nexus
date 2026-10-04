/* One candidate: profit per sale first, the trend and match behind it, everything else on expand. */
import type { Candidate, Dest, Flag, TermScore } from '../../../radar/src/types'
import { FLAG_NOTES } from '../../../radar/src/flags'
import { Sparkline } from '../../components/ProductCard'
import { Button } from '../../components/ui'
import { cn } from '../../lib/cn'
import { signedPct } from '../../lib/text'
import { issueUrl, matchLabel } from '../lib'
import { aud, marginTone, MoneyStrip, netTone } from './MoneyStrip'

const FLAG_MARK: Record<Flag, string> = { battery: 'Li', mains: '~V', radio: '((•))', skin: 'skin', kids: 'kids', heavy: 'kg' }
const DEST_LABEL: Record<Dest, string> = { AU: 'Australia', US: 'United States', GB: 'United Kingdom' }

export function CandidateCard(p: { c: Candidate; rank: number; delta: number; term?: TermScore; generatedAt: string; open: boolean; onToggle: () => void; skipped: boolean; onSkip: () => void; issueHref: string; repo: string }) {
  const { c } = p
  const newToday = c.firstSeen === p.generatedAt.slice(0, 10)
  const since = newToday ? 'new today' : `seen since ${new Date(c.firstSeen + 'T12:00:00Z').toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}`
  const label = p.term?.trendLabel ?? 'Steady'
  return (
    <li className={cn('border-b border-rule bg-sheet', p.skipped && 'opacity-60')}>
      <div className="grid gap-x-5 gap-y-3 px-4 py-4 md:grid-cols-[32px_96px_1fr_auto] md:px-5">
        <div className="reading hidden text-[13px] text-ink-3 md:block">{String(p.rank).padStart(2, '0')}</div>
        <div className="h-24 w-24 shrink-0 bg-paper">
          {c.image ? <img src={c.image} alt="" loading="lazy" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-[11px] text-ink-3">no photo</div>}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn('reading px-1.5 py-0.5 text-[11px]', label === 'Steady' ? 'bg-paper-2 text-ink-2' : 'bg-signal text-ink')}>{label} {signedPct(p.delta)}</span>
            <Sparkline series={p.term?.series ?? [0, 0, 0, 0, 0, 0, 0, 0]} />
            <span className="text-[12.5px] text-ink-3">{p.term?.label ?? c.termId}, {c.section}</span>
            <span className="border border-rule-2 px-1.5 text-[11px] text-ink-3" title={`${c.match === 1 ? 'The CJ title holds the watch phrase.' : "Passes this term's match rules without the exact watch phrase."}${c.cjScope === 'keyword' ? ' Found by keyword: no matching CJ category.' : ''}`}>{matchLabel(c)}</span>
            {c.stale && <span className="border border-check px-1.5 text-[11px] text-check">stale</span>}
          </div>
          <h2 className="mt-1.5 text-[16px] font-medium leading-snug text-ink">{c.name}</h2>
          <p className="mt-1 text-[13px] text-ink-2">{c.why}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-ink-3">
            <span className="reading">{c.listedNum.toLocaleString('en-US')} listed</span>
            <span>{c.freight.AU ? `${c.freight.AU.cheapest.name}, ${c.freight.AU.cheapest.days[0]}-${c.freight.AU.cheapest.days[1]} days, ${aud(c.money.freightAud)}` : 'no freight line to Australia'}</span>
            <span>{c.variant.auPlug ? 'AU plug' : c.variant.name}</span>
            <span>{since}</span>
            {c.flags.length > 0 && (
              <span className="flex gap-1">
                {c.flags.map((f) => <span key={f} title={FLAG_NOTES[f]} className="reading border border-rule-2 px-1 text-[10.5px] text-ink-2">{FLAG_MARK[f]}</span>)}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-start gap-3 md:items-end">
          <div className="flex flex-wrap items-baseline gap-x-2 md:justify-end">
            <span className={cn('numeral text-[26px] leading-none', netTone(c.money.netAud))}>{`A$${c.money.netAud.toFixed(2)}`}<span className="font-sans text-[14px] text-ink-2"> a sale</span></span>
            <span className="reading text-[12.5px] text-ink-3">{`at A$${c.money.retailAud.toFixed(2)}`}</span>
          </div>
          <MoneyStrip m={c.money} compact />
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={p.onSkip}>{p.skipped ? 'Unskip' : 'Skip'}</Button>
            <Button size="sm" variant="secondary" onClick={p.onToggle} aria-expanded={p.open}>Details</Button>
            <a href={issueUrl(p.repo, c)} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center bg-ink px-3 text-[13px] font-medium text-paper hover:bg-[#1f2730]">Add to shop</a>
          </div>
        </div>
      </div>
      {p.open && (
        <div className="grid gap-6 border-t border-rule bg-paper px-4 py-4 md:grid-cols-3 md:px-5">
          <div>
            <h3 className="text-[13px] font-medium text-ink">Money at the suggested price</h3>
            <dl className="reading mt-2 text-[12.5px] text-ink-2">
              {[
                ['CJ price', `US$${c.variant.priceUsd.toFixed(2)}`], ['Cost in AUD', aud(c.money.costAud)], ['Cheapest AU freight', aud(c.money.freightAud)], ['Landed', aud(c.money.landedAud)],
                ['Sell at, incl. GST', aud(c.money.retailAud)], ['GST in that price', aud(c.money.retailAud - c.money.retailAud / 1.1)], ['Card fees (est.)', aud(0.029 * c.money.retailAud + 0.3)],
                ['Net at suggested retail', `${aud(c.money.netAud)} (${Math.round(c.money.marginPct * 100)} %)`],
                ['Margin at 2× landed', `${Math.round(c.money.at2x * 100)} %`], ['Margin at 3× landed', `${Math.round(c.money.at3x * 100)} %`],
                ['Shop median, same section', c.money.sectionMedianAud ? aud(c.money.sectionMedianAud) : 'none yet'],
              ].map(([k, v]) => <div key={k} className="flex justify-between gap-3 border-b border-rule py-1"><dt className="font-sans">{k}</dt><dd className={cn(k === 'Net at suggested retail' && marginTone(c.money.marginPct))}>{v}</dd></div>)}
            </dl>
          </div>
          <div>
            <h3 className="text-[13px] font-medium text-ink">Freight from China</h3>
            <dl className="mt-2 text-[12.5px] text-ink-2">
              {(['AU', 'US', 'GB'] as Dest[]).map((d) => {
                const q = c.freight[d]
                return (
                  <div key={d} className="border-b border-rule py-1.5">
                    <dt className="text-ink">{DEST_LABEL[d]}</dt>
                    <dd className="reading">{q ? `${q.cheapest.name}: US$${q.cheapest.usd.toFixed(2)}, ${q.cheapest.days[0]}-${q.cheapest.days[1]} days; fastest ${q.fastest.name} US$${q.fastest.usd.toFixed(2)}, ${q.fastest.days[0]}-${q.fastest.days[1]} days; ${q.lines} lines` : 'no quote returned'}</dd>
                  </div>
                )
              })}
            </dl>
            <h3 className="mt-4 text-[13px] font-medium text-ink">Variant chosen</h3>
            <p className="mt-1 text-[12.5px] text-ink-2">{c.variant.name}, {c.variant.weightG} g, {c.variant.variantCount} variants on CJ. <a href={c.cjUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">Open on CJ</a>.</p>
          </div>
          <div>
            <h3 className="text-[13px] font-medium text-ink">Before you list it</h3>
            {c.flags.length ? (
              <ul className="mt-2 space-y-1.5 text-[12.5px] text-ink-2">{c.flags.map((f) => <li key={f}><span className="reading mr-1.5 border border-rule-2 px-1 text-[10.5px] text-ink-2">{FLAG_MARK[f]}</span>{FLAG_NOTES[f]}</li>)}</ul>
            ) : <p className="mt-2 text-[12.5px] text-ink-2">No compliance flags from the listing text. Check the supplier page anyway.</p>}
            <p className="mt-3 text-[12px] text-ink-3">Add to shop opens a GitHub issue filled in for you; submitting it writes the listing and rebuilds the site within a few minutes.</p>
          </div>
        </div>
      )}
    </li>
  )
}
