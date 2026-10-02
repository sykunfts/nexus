import { forwardRef, ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '../lib/cn'

/* ---------- Button ---------- */
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg' | 'icon'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  leading?: ReactNode
  trailing?: ReactNode
}

const variants: Record<Variant, string> = {
  primary: 'bg-ink text-paper hover:bg-[#1f2730] active:bg-ink',
  secondary: 'bg-transparent text-ink border border-ink hover:bg-ink hover:text-paper',
  ghost: 'text-ink-2 hover:text-ink hover:bg-paper-2',
  danger: 'bg-transparent text-fail border border-fail hover:bg-fail-tint',
}
const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px] gap-1.5',
  md: 'h-10 px-4 text-[14px] gap-2',
  lg: 'h-12 px-5 text-[15px] gap-2',
  icon: 'h-9 w-9',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', className, leading, trailing, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center select-none whitespace-nowrap rounded-[2px] font-medium transition-colors duration-120 disabled:opacity-40 disabled:pointer-events-none',
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {leading}
      {children}
      {trailing}
    </button>
  )
})

/* ---------- Option cell (radio in a ruled grid) ---------- */
export function Chip({
  selected,
  children,
  className,
  sub,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean; sub?: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        'relative flex flex-col items-start bg-sheet px-3 py-2.5 text-left text-[14px] transition-colors duration-120',
        selected ? 'text-ink shadow-[inset_0_0_0_2px_var(--color-ink)]' : 'text-ink-2 hover:bg-paper hover:text-ink',
        className,
      )}
      {...rest}
    >
      <span className="font-medium leading-tight">{children}</span>
      {sub && <span className="mt-0.5 text-[12px] text-ink-3">{sub}</span>}
    </button>
  )
}

/* ---------- Tile (signal fill, ink text) and Tag (ruled outline) ---------- */
export function Tile({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn('tile', className)}>{children}</span>
}

export function Pill({ tone = 'neutral', children, className }: { tone?: 'neutral' | 'signal' | 'pass' | 'check' | 'fail'; children: ReactNode; className?: string }) {
  if (tone === 'signal') return <Tile className={className}>{children}</Tile>
  const tones = {
    neutral: 'tag',
    pass: 'tag !border-pass !text-pass bg-pass-tint',
    check: 'tag !border-check !text-check bg-check-tint',
    fail: 'tag !border-fail !text-fail bg-fail-tint',
  }
  return <span className={cn(tones[tone], className)}>{children}</span>
}

/* ---------- Stock mark ---------- */
export function StockDot({ stock, count }: { stock: 'in' | 'low' | 'out'; count?: number }) {
  const map = {
    in: { tone: 'text-pass', mark: 'bg-pass', label: 'In stock' },
    low: { tone: 'text-check', mark: 'bg-check', label: count ? `Only ${count} left` : 'Low stock' },
    out: { tone: 'text-fail', mark: 'bg-fail', label: 'Backorder, 2 to 3 weeks' },
  }[stock]
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-[12.5px] font-medium', map.tone)}>
      <span className={cn('inline-block h-2 w-2', map.mark)} aria-hidden />
      {map.label}
    </span>
  )
}

/* ---------- Rating ---------- */
export function Stars({ rating, reviews, size = 11 }: { rating: number; reviews?: number; size?: number }) {
  const pct = Math.round((rating / 5) * 100)
  return (
    <span className="inline-flex items-center gap-1.5" aria-label={`${rating} out of 5${reviews ? `, ${reviews} reviews` : ''}`}>
      <span className="relative inline-block overflow-hidden leading-none text-rule-2" style={{ fontSize: size + 2 }} aria-hidden>
        ★★★★★
        <span className="absolute inset-y-0 left-0 overflow-hidden whitespace-nowrap text-ink" style={{ width: `${pct}%` }}>★★★★★</span>
      </span>
      {reviews !== undefined && (
        <span className="reading text-[11.5px] font-normal text-ink-2">
          {rating.toFixed(1)} ({reviews.toLocaleString()})
        </span>
      )}
    </span>
  )
}

/* ---------- Kbd ---------- */
export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-[2px] border border-rule-2 bg-sheet px-1 font-mono text-[10.5px] text-ink-2">
      {children}
    </kbd>
  )
}

/* ---------- Section label (sentence case, small) ---------- */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('text-[13px] text-ink-2', className)}>{children}</div>
}

/* ---------- Toggle ---------- */
export function Toggle({ on, onChange, label }: { on: boolean; onChange: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onChange}
      className={cn('relative h-6 w-10 shrink-0 rounded-[2px] border transition-colors duration-150', on ? 'border-ink bg-ink' : 'border-rule-2 bg-sheet')}
    >
      <span className={cn('absolute top-0.5 left-0.5 h-[18px] w-[18px] rounded-[1px] transition-transform duration-150', on ? 'translate-x-4 bg-signal' : 'translate-x-0 bg-rule-2')} />
    </button>
  )
}

/* ---------- Ruled row (label / value) ---------- */
export function Row({ label, value, className }: { label: ReactNode; value: ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-baseline justify-between gap-4 border-t border-rule py-2 text-[13.5px]', className)}>
      <span className="text-ink-2">{label}</span>
      <span className="reading text-right text-[13px] text-ink">{value}</span>
    </div>
  )
}
