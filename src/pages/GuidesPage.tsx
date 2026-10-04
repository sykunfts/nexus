import { GUIDES, guideBySlug } from '../lib/guides'
import { useStore } from '../lib/store'
import { NotFoundPage } from './NotFoundPage'

function Crumb({ label }: { label?: string }) {
  const go = useStore((s) => s.go)
  return (
    <nav aria-label="Breadcrumb" className="py-4 text-[13px] text-ink-3">
      <button type="button" onClick={() => go({ name: 'home' })} className="hover:text-ink">Home</button><span className="mx-1.5">/</span>
      {label ? <><button type="button" onClick={() => go({ name: 'guides' })} className="hover:text-ink">Guides</button><span className="mx-1.5">/</span><span className="text-ink">{label}</span></> : <span className="text-ink">Guides</span>}
    </nav>
  )
}

export function GuidesPage() {
  const go = useStore((s) => s.go)
  return (
    <div className="mx-auto max-w-[1440px] px-4 pb-24 md:px-6 lg:pb-16">
      <Crumb />
      <h1 className="display-md text-[34px] text-ink sm:text-[44px]">Guides</h1>
      <p className="mt-1 max-w-[60ch] text-[14.5px] text-ink-2">Short, written for real, each with one live element that reads the catalogue and your setup.</p>
      <div className="mt-6 sheet-grid md:grid-cols-2 xl:grid-cols-3">
        {GUIDES.map((g) => (
          <button key={g.slug} type="button" onClick={() => go({ name: 'guide', slug: g.slug })} className="flex flex-col bg-paper p-5 text-left hover:bg-paper-2">
            <div className="flex items-center gap-2 text-[12px] text-ink-3"><span>{g.section}, {g.minutes} min</span></div>
            <div className="mt-1 text-[19px] font-medium leading-tight text-ink">{g.title}</div>
            <p className="mt-1.5 text-[13.5px] text-ink-2">{g.summary}</p>
          </button>
        ))}
        <button type="button" onClick={() => go({ name: 'how-we-pick' })} className="flex flex-col bg-sheet p-5 text-left hover:bg-paper-2">
          <div className="text-[12px] text-ink-3">About</div>
          <div className="mt-1 text-[19px] font-medium leading-tight text-ink">How we pick</div>
          <p className="mt-1.5 text-[13.5px] text-ink-2">What gets a product onto the list, what keeps it there, and what we refuse to make up.</p>
        </button>
      </div>
    </div>
  )
}

export function GuidePage({ slug }: { slug: string }) {
  const g = guideBySlug(slug)
  if (!g) return <NotFoundPage hash={`#/guides/${slug}`} />
  const others = GUIDES.filter((x) => x.slug !== g.slug).slice(0, 3)
  const go = useStore((s) => s.go)
  return (
    <div className="mx-auto max-w-[1440px] px-4 pb-24 md:px-6 lg:pb-16">
      <Crumb label={g.title} />
      <div className="grid grid-cols-12 gap-x-8">
        <article className="col-span-12 lg:col-span-8">
          <div className="flex items-center gap-2 text-[12.5px] text-ink-3"><span>{g.section}, {g.minutes} min read</span></div>
          <h1 className="display-md mt-2 max-w-[18ch] text-[36px] text-ink sm:text-[48px]">{g.title}</h1>
          <p className="mt-3 max-w-[60ch] text-[17px] text-ink-2">{g.summary}</p>
          <g.Component />
        </article>
        <aside className="col-span-12 mt-10 lg:col-span-4 lg:mt-0">
          <div className="border border-rule bg-sheet lg:sticky lg:top-[88px]">
            <div className="border-b border-rule px-4 py-2.5 text-[13px] text-ink-3">More guides</div>
            <ul className="divide-y divide-rule">
              {others.map((o) => <li key={o.slug}><button type="button" onClick={() => go({ name: 'guide', slug: o.slug })} className="block w-full px-4 py-2.5 text-left text-[14px] text-ink hover:bg-paper">{o.title}<span className="block text-[12px] text-ink-3">{o.minutes} min</span></button></li>)}
              <li><button type="button" onClick={() => go({ name: 'how-we-pick' })} className="block w-full px-4 py-2.5 text-left text-[14px] text-ink hover:bg-paper">How we pick</button></li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  )
}
