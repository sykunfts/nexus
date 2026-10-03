/* Shared reading-style primitives for guides. */
import type { ReactNode } from 'react'
import { useStore } from '../../lib/store'

export const P = ({ children }: { children: ReactNode }) => <p className="mt-4 max-w-[64ch] text-[16px] leading-[1.6] text-ink-2">{children}</p>
export const H2 = ({ children }: { children: ReactNode }) => <h2 className="mt-10 max-w-[40ch] text-[22px] font-medium leading-tight text-ink">{children}</h2>
export const Note = ({ children }: { children: ReactNode }) => <div className="mt-6 max-w-[64ch] border-l-2 border-signal bg-sheet px-4 py-3 text-[14px] text-ink-2">{children}</div>
export const Live = ({ title, children }: { title: string; children: ReactNode }) => (
  <div className="mt-6 border border-ink bg-sheet">
    <div className="flex items-center gap-2 border-b border-rule px-4 py-2 text-[12.5px] text-ink-3"><span className="inline-block h-1.5 w-1.5 bg-signal" aria-hidden />Live, reads the catalogue and your setup: {title}</div>
    <div className="px-4 py-4">{children}</div>
  </div>
)
export function ProductLink({ id, children }: { id: string; children: ReactNode }) {
  const go = useStore((s) => s.go)
  return <button type="button" onClick={() => go({ name: 'product', id })} className="text-ink underline decoration-rule-2 underline-offset-4 hover:decoration-ink">{children}</button>
}
export function GuideLink({ slug, children }: { slug: string; children: ReactNode }) {
  const go = useStore((s) => s.go)
  return <button type="button" onClick={() => go({ name: 'guide', slug })} className="text-ink underline decoration-rule-2 underline-offset-4 hover:decoration-ink">{children}</button>
}
export function CollectionLink({ slug, children }: { slug: string; children: ReactNode }) {
  const go = useStore((s) => s.go)
  return <button type="button" onClick={() => go({ name: 'collection', slug, filters: {} })} className="text-ink underline decoration-rule-2 underline-offset-4 hover:decoration-ink">{children}</button>
}
