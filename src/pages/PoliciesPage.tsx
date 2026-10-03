/* One policy page, laid out like a guide, with the others listed beside it. */
import { DRAFT_NOTICE, POLICIES, policyBySlug } from '../content/policies'
import { useStore } from '../lib/store'
import { NotFoundPage } from './NotFoundPage'

const longDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })

export function PoliciesPage({ slug }: { slug: string }) {
  const p = policyBySlug(slug)
  const go = useStore((s) => s.go)
  if (!p) return <NotFoundPage hash={`#/policies/${slug}`} />
  const others = POLICIES.filter((x) => x.slug !== p.slug)
  return (
    <div className="mx-auto max-w-[1440px] px-4 pb-24 md:px-6 lg:pb-16">
      <nav aria-label="Breadcrumb" className="py-4 text-[13px] text-ink-3">
        <button type="button" onClick={() => go({ name: 'home' })} className="hover:text-ink">Home</button><span className="mx-1.5">/</span><span className="text-ink">{p.title}</span>
      </nav>
      <div className="grid grid-cols-12 gap-x-8">
        <article className="col-span-12 lg:col-span-8">
          <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-ink-3"><span>Policy, updated {longDate(p.updated)}</span><span aria-hidden>·</span><span className="border border-check px-1.5 py-0.5 text-check">{DRAFT_NOTICE}</span></div>
          <h1 className="display-md mt-2 max-w-[18ch] text-[36px] text-ink sm:text-[48px]">{p.title}</h1>
          <p className="mt-3 max-w-[60ch] text-[17px] text-ink-2">{p.summary}</p>
          <p.Component />
        </article>
        <aside className="col-span-12 mt-10 lg:col-span-4 lg:mt-0">
          <div className="border border-rule bg-sheet lg:sticky lg:top-[72px]">
            <div className="border-b border-rule px-4 py-2.5 text-[13px] text-ink-3">Other policies</div>
            <ul className="divide-y divide-rule">
              {others.map((o) => <li key={o.slug}><button type="button" onClick={() => go({ name: 'policy', slug: o.slug })} className="block w-full px-4 py-2.5 text-left text-[14px] text-ink hover:bg-paper">{o.title}<span className="block text-[12px] text-ink-3">{o.summary}</span></button></li>)}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  )
}
