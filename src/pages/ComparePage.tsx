/* Compare up to four products: header rows, then every spec row any column has, winners marked. */
import { useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { byId, products, SpecRow } from '../lib/data'
import { fmt } from '../lib/currency'
import { statusFor } from '../lib/catalog'
import { etaText, originShort } from '../lib/shipping'
import { useSetup, useStore, useZone } from '../lib/store'
import { ProductImage } from '../components/ProductVisual'
import { Button, Stars } from '../components/ui'
import { cn } from '../lib/cn'

const STATUS = { ok: { mark: 'bg-pass', text: 'text-pass', label: 'Works with your setup' }, warn: { mark: 'bg-check', text: 'text-check', label: 'Needs attention' }, bad: { mark: 'bg-fail', text: 'text-fail', label: 'Does not work' } }

export function ComparePage({ ids }: { ids: string[] }) {
  const go = useStore((s) => s.go)
  const currency = useStore((s) => s.currency)
  const zone = useZone()
  const setup = useSetup()
  const [picking, setPicking] = useState(false)
  const items = useMemo(() => ids.filter((id) => products.some((p) => p.id === id)).slice(0, 4).map(byId), [ids])
  const set = (next: string[]) => go({ name: 'compare', ids: next })

  const rows = useMemo(() => {
    const labels: string[] = []
    for (const p of items) for (const g of p.specs) for (const r of g.rows) if (!labels.includes(r.label)) labels.push(r.label)
    return labels.map((label) => {
      const cells = items.map((p) => p.specs.flatMap((g) => g.rows).find((r) => r.label === label) ?? null)
      const numeric = cells.filter((c): c is SpecRow => !!c && c.n !== undefined)
      let winner: number | null = null
      if (numeric.length > 1 && new Set(numeric.map((c) => c.n)).size > 1) {
        const better = numeric[0].better ?? 'high'
        const best = better === 'low' ? Math.min(...numeric.map((c) => c.n!)) : Math.max(...numeric.map((c) => c.n!))
        winner = cells.findIndex((c) => c?.n === best)
      }
      return { label, cells, winner }
    })
  }, [items])

  const candidates = items.length ? products.filter((p) => p.category === items[0].category && !items.some((x) => x.id === p.id)) : products

  return (
    <div className="mx-auto max-w-[1440px] px-4 pb-24 md:px-6 lg:pb-16">
      <nav aria-label="Breadcrumb" className="py-4 text-[13px] text-ink-3">
        <button type="button" onClick={() => go({ name: 'home' })} className="hover:text-ink">Home</button><span className="mx-1.5">/</span><span className="text-ink">Compare</span>
      </nav>
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-ink pb-4">
        <div>
          <h1 className="display-md text-[34px] text-ink sm:text-[44px]">Compare</h1>
          <p className="mt-1 text-[14.5px] text-ink-2">Specs aligned by row, the better number marked, and every column checked against your setup.</p>
        </div>
        {items.length < 4 && <Button variant="secondary" size="sm" onClick={() => setPicking((v) => !v)}>Add a product</Button>}
      </div>

      {picking && (
        <div className="mt-3 border border-rule bg-sheet p-3">
          <div className="mb-2 text-[12.5px] text-ink-3">{items.length ? `More in ${items[0].category.toLowerCase()}` : 'Pick a product'}</div>
          <div className="flex flex-wrap gap-2">
            {candidates.slice(0, 16).map((p) => (
              <button key={p.id} type="button" onClick={() => { set([...items.map((x) => x.id), p.id]); setPicking(false) }} className="border border-rule-2 px-2.5 py-1 text-[13px] text-ink hover:border-ink">{p.brand} {p.name}</button>
            ))}
            {candidates.length === 0 && <span className="text-[13px] text-ink-3">Nothing else in this category yet.</span>}
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <div className="mt-6 border border-rule bg-sheet p-6">
          <div className="text-[18px] font-medium text-ink">Nothing to compare yet.</div>
          <p className="mt-1 text-[13.5px] text-ink-2">Tick "Compare" on any two product cards, or start with the pairs that matter.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button variant="primary" size="sm" onClick={() => set(['ringconn-gen-3', 'oura-ring-5'])}>RingConn vs Oura</Button>
            <Button variant="secondary" size="sm" onClick={() => set(['xgimi-mogo-4-laser', 'xgimi-vibe-one'])}>MoGo 4 Laser vs Vibe One</Button>
            <Button variant="ghost" size="sm" onClick={() => go({ name: 'collection', slug: 'smart-rings', filters: {} })}>Smart rings</Button>
            <Button variant="ghost" size="sm" onClick={() => go({ name: 'collection', slug: 'cinema', filters: {} })}>Cinema</Button>
          </div>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto border border-rule">
          <table className="w-full min-w-[640px] border-collapse text-[13.5px]">
            <thead>
              <tr className="bg-sheet align-top">
                <th className="w-[160px] px-4 py-3 text-left font-normal text-ink-3">Product</th>
                {items.map((p) => (
                  <th key={p.id} className="px-4 py-3 text-left font-normal">
                    <div className="flex items-start justify-between gap-2">
                      <button type="button" onClick={() => go({ name: 'product', id: p.id })} className="block h-24 w-32 bg-paper"><ProductImage product={p} /></button>
                      <button type="button" onClick={() => set(items.filter((x) => x.id !== p.id).map((x) => x.id))} aria-label={`Remove ${p.name}`} className="text-ink-3 hover:text-fail"><X size={14} /></button>
                    </div>
                    <button type="button" onClick={() => go({ name: 'product', id: p.id })} className="mt-2 block text-left text-[15px] font-medium text-ink hover:underline underline-offset-4">{p.brand} {p.name}</button>
                    <div className="reading mt-0.5 text-[14px] text-ink">{fmt(p.price, currency, { compact: true })}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-rule bg-sheet">
                <td className="px-4 py-2 text-ink-2">Ships from</td>
                {items.map((p) => <td key={p.id} className="px-4 py-2 text-ink">{originShort(p.fulfil)}, {etaText(p.fulfil.origin, zone)}</td>)}
              </tr>
              <tr className="border-t border-rule bg-sheet">
                <td className="px-4 py-2 text-ink-2">Rating</td>
                {items.map((p) => <td key={p.id} className="px-4 py-2"><Stars rating={p.rating} /></td>)}
              </tr>
              <tr className="border-t border-rule bg-sheet">
                <td className="px-4 py-2 text-ink-2">Works with your setup</td>
                {items.map((p) => { const st = STATUS[statusFor(p, setup)]; return <td key={p.id} className={cn('px-4 py-2', st.text)}><span className={cn('mr-2 inline-block h-2 w-2', st.mark)} aria-hidden />{st.label}</td> })}
              </tr>
              {rows.map((r) => (
                <tr key={r.label} className="border-t border-rule bg-sheet">
                  <td className="px-4 py-2 text-ink-2">{r.label}</td>
                  {r.cells.map((c, i) => <td key={i} className={cn('reading px-4 py-2 text-[12.5px]', r.winner === i ? 'text-pass' : c ? 'text-ink' : 'text-ink-3')} data-winner={r.winner === i ? 'true' : undefined}>{c?.value ?? '—'}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
