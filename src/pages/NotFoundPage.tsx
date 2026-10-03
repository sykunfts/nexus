import { nav } from '../lib/data'
import { useStore } from '../lib/store'
import { Button } from '../components/ui'

export function NotFoundPage({ hash }: { hash: string }) {
  const go = useStore((s) => s.go)
  const setSearchOpen = useStore((s) => s.setSearchOpen)
  return (
    <div className="mx-auto max-w-[1440px] px-4 py-16 md:px-6">
      <div className="max-w-[60ch]">
        <div className="reading text-[12px] text-ink-3">404</div>
        <h1 className="display-md mt-2 text-[34px] text-ink sm:text-[44px]">That link did not match anything.</h1>
        <p className="mt-3 text-[15px] text-ink-2">Nothing lives at <span className="reading text-[13px] text-ink">{hash || '#/'}</span>. Try a search, or start from a category.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button variant="primary" onClick={() => { go({ name: 'home' }); setSearchOpen(true); window.setTimeout(() => document.getElementById('site-search')?.focus(), 50) }}>Search the catalogue</Button>
          <Button variant="secondary" onClick={() => go({ name: 'home' })}>Home</Button>
        </div>
      </div>
      <div className="mt-10 sheet-grid sm:grid-cols-3 lg:grid-cols-7" aria-label="Categories">
        {nav.map((s) => (
          <button key={s.id} type="button" onClick={() => go({ name: 'collection', slug: s.id, filters: {} })} className="bg-paper px-4 py-3 text-left text-[14px] text-ink hover:bg-paper-2">{s.label}</button>
        ))}
      </div>
    </div>
  )
}
