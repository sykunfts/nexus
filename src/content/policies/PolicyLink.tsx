/* An in-copy link to another policy page. */
import type { ReactNode } from 'react'
import { useStore } from '../../lib/store'

export function PolicyLink({ slug, children }: { slug: string; children: ReactNode }) {
  const go = useStore((s) => s.go)
  return <a href={`#/policies/${slug}`} onClick={(e) => { e.preventDefault(); go({ name: 'policy', slug }) }} className="text-ink underline decoration-rule-2 underline-offset-4 hover:decoration-ink">{children}</a>
}
