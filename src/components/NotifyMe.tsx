/*
  "Not yet stocked, tell me when": the stand-in for Add to cart on products the office cannot order yet.
  Full form on the product page; compact (button that opens the field) on cards, quick view and the mobile bar.
*/
import { useId, useState } from 'react'
import { Check } from 'lucide-react'
import { notifyMe, OfficeClientError } from '../lib/office'
import { useStore } from '../lib/store'
import { validEmail } from '../lib/validate'
import { cn } from '../lib/cn'
import { Button } from './ui'

export const NOTIFY_LABEL = 'Not yet stocked, tell me when'
export const NOTIFY_DONE = "We'll email you when it's stocked."
export const NOTIFY_INPUT_ID = 'notify-email'

export function NotifyMe({ productId, compact = false, className }: { productId: string; compact?: boolean; className?: string }) {
  const [email, setEmail] = useState('')
  const [open, setOpen] = useState(!compact)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const toast = useStore((s) => s.toast)
  const uid = useId()
  const inputId = compact ? `${NOTIFY_INPUT_ID}-${uid}` : NOTIFY_INPUT_ID

  const submit = async () => {
    const value = email.trim()
    if (!validEmail(value)) { setError('Enter the email to alert.'); return }
    setBusy(true)
    setError(null)
    try {
      await notifyMe(productId, value)
      setDone(true)
      toast({ title: NOTIFY_DONE, body: 'One email, when it is in stock. Nothing else.' })
    } catch (e) {
      setError(e instanceof OfficeClientError && e.code === 'rate_limited' ? 'Too many requests from here. Try again in a minute.' : 'Could not save that just now. Try again in a moment.')
    } finally { setBusy(false) }
  }

  if (done) return <div className={cn('flex h-10 items-center gap-2 text-[13px] text-pass', className)} role="status"><Check size={15} strokeWidth={2.5} /> You are on the list.</div>

  if (compact && !open) {
    return <Button variant="secondary" size="md" className={className} onClick={() => setOpen(true)}>Tell me when</Button>
  }

  return (
    <form className={cn('flex flex-col gap-1.5', className)} onSubmit={(e) => { e.preventDefault(); void submit() }} aria-label="Stock alert">
      <div className="flex flex-wrap gap-2">
        <input
          id={inputId}
          type="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setError(null) }}
          placeholder="you@example.com"
          autoComplete="email"
          aria-label="Email for a stock alert"
          aria-invalid={!!error}
          className={cn('h-10 min-w-[200px] flex-1 rounded-[2px] border bg-sheet px-3 text-[14px] text-ink', error ? 'border-fail' : 'border-rule-2 focus:border-ink')}
        />
        <Button type="submit" variant="primary" size="md" disabled={busy} className="shrink-0 grow sm:grow-0">{compact ? 'Tell me when' : NOTIFY_LABEL}</Button>
      </div>
      {error ? <span className="text-[12px] text-fail" role="alert">{error}</span> : compact ? null : <span className="text-[12px] text-ink-3">Reference listing. We are not stocking this one yet; leave an email and we will tell you when we do.</span>}
    </form>
  )
}
