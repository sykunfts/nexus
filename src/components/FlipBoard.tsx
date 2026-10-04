/* Split-flap readout: the one load-time motion on the page. Each character flips a few times, then settles. */
import { useEffect, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import { cn } from '../lib/cn'
import { signedPct } from '../lib/text'

const POOL = '0123456789'

function FlapChar({ final, delay }: { final: string; delay: number }) {
  const reduce = useReducedMotion()
  const digit = /\d/.test(final)
  const [shown, setShown] = useState(reduce || !digit ? final : POOL[Math.floor(Math.random() * 10)])
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (reduce || !digit) return
    const steps = 5
    const timers: number[] = []
    for (let k = 1; k <= steps; k++) {
      timers.push(window.setTimeout(() => {
        setShown(k === steps ? final : POOL[Math.floor(Math.random() * 10)])
        setTick((t) => t + 1)
      }, delay + k * 110))
    }
    return () => timers.forEach((t) => window.clearTimeout(t))
  }, [final, delay, reduce, digit])

  return (
    <span key={tick} className={`flap ${tick ? 'is-flapping' : ''}`} aria-hidden>
      {shown}
    </span>
  )
}

/** An orange tile readout by default; pass a className to restyle it (the board's big ink numerals). */
export function FlipReadout({ value, delay = 0, className }: { value: string; delay?: number; className?: string }) {
  return (
    <span className={cn('tile !gap-0', className ?? '!text-[13px] !px-2 !py-1.5')} aria-label={value}>
      {value.split('').map((c, i) => <FlapChar key={`${i}-${c}`} final={c} delay={delay + i * 40} />)}
    </span>
  )
}

export function FlipBoard({ items }: { items: { label: string; delta: number }[] }) {
  return (
    <div className="scrollbar-none flex snap-x snap-mandatory gap-3 overflow-x-auto lg:grid lg:grid-cols-3 lg:overflow-visible xl:grid-cols-6" role="list" aria-label="Category movers, 7-day change in interest">
      {items.map((t, i) => (
        <div key={t.label} role="listitem" className="flex min-w-[132px] snap-start flex-col gap-1.5 rounded-[2px] border border-rule bg-sheet p-4 lg:min-w-0">
          <span className="truncate text-[14px] text-ink">{t.label}</span>
          <FlipReadout value={signedPct(t.delta)} delay={i * 90} className="!bg-transparent !p-0 !text-[22px] !font-normal !text-ink lg:!text-[26px]" />
        </div>
      ))}
    </div>
  )
}
