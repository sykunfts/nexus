/* The one bold thing on the page: landed cost → suggested retail → net per sale, three numbers in the reading face joined by a rule.
   The suggested price always earns the 45 % target, so the third number is dollars, which do vary; the margin sits in the expanded table. */
import type { Money } from '../../../radar/src/types'
import { cn } from '../../lib/cn'

export const aud = (n: number) => `$${n.toFixed(2)}`
export const marginTone = (pct: number) => (pct >= 0.45 ? 'text-pass' : pct >= 0.3 ? 'text-check' : 'text-fail')
export const netTone = (net: number) => (net >= 30 ? 'text-pass' : net >= 15 ? 'text-check' : 'text-ink')

export function MoneyStrip({ m, compact = false }: { m: Money; compact?: boolean }) {
  const step = (label: string, value: string, tone = 'text-ink') => (
    <div className="min-w-0">
      <div className="text-[11px] text-ink-3">{label}</div>
      <div className={cn('reading leading-none', compact ? 'text-[16px]' : 'text-[20px]', tone)}>{value}</div>
    </div>
  )
  return (
    <div className="flex items-end gap-3">
      {step('Landed', aud(m.landedAud))}
      <span aria-hidden className="mb-1.5 h-px w-4 shrink-0 bg-ink" />
      {step('Sell at', aud(m.retailAud))}
      <span aria-hidden className="mb-1.5 h-px w-4 shrink-0 bg-ink" />
      {step('Net per sale', aud(m.netAud), netTone(m.netAud))}
    </div>
  )
}
