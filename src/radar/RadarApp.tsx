/*
  The Trend Radar: Nick's instrument panel. One ranked list of CJ candidates with the numbers that
  decide a listing (landed cost, retail, margin), the trend behind each, freight, flags, and two
  actions: Skip (this browser) and Add to shop (a prefilled GitHub issue the listing job acts on).
  Data is baked at build from data/radar.json; `?demo=1` shows made-up candidates for the layout.
*/
import { useEffect, useMemo, useState } from 'react'
import radarJson from '../../data/radar.json'
import sampleJson from './fixtures/radar.sample.json'
import type { Candidate, Flag, RadarFile } from '../../radar/src/types'
import { DEFAULT_FILTERS, filterCandidates, RadarFilters, RadarSort, REPO, sortCandidates, staleBanner, termDeltas } from './lib'
import { RadarHeader } from './components/RadarHeader'
import { RadarRail } from './components/RadarRail'
import { CandidateCard } from './components/CandidateCard'
import { NoveltyRail } from './components/NoveltyRail'
import { EmptyState } from './components/EmptyState'
import { TermsTable } from './components/TermsTable'
import { OrdersTab } from './components/OrdersTab'

const SKIP_KEY = 'nexus.radar.skipped'
export type RadarTab = 'radar' | 'orders'
const tabFromHash = (): RadarTab => (typeof location !== 'undefined' && location.hash === '#orders' ? 'orders' : 'radar')

/* Why a run that scored its terms has nothing to rank: the most likely first-run state. */
function noCandidatesReason(f: RadarFile): string {
  const cj = f.sources.cj
  if (cj === 'skipped') return 'No CJ candidates: the run had no CJ_API_KEY. Add it under Settings → Secrets and variables → Actions, then run the Radar again.'
  if (cj.startsWith('failed')) return `CJ could not be read this run (${cj.replace(/^failed:\s*/, '')}). The trends below are current; candidates return on the next successful run.`
  return 'CJ returned nothing usable for the rising terms this run.'
}
const readSkipped = (): Set<string> => { try { return new Set(JSON.parse(localStorage.getItem(SKIP_KEY) ?? '[]') as string[]) } catch { return new Set() } }
const writeSkipped = (s: Set<string>) => { try { localStorage.setItem(SKIP_KEY, JSON.stringify([...s])) } catch { /* storage blocked: skips last for this page only */ } }

export function RadarApp() {
  const demo = typeof location !== 'undefined' && new URLSearchParams(location.search).get('demo') === '1'
  const file = (demo ? sampleJson : radarJson) as unknown as RadarFile
  const [filters, setFilters] = useState<RadarFilters>(DEFAULT_FILTERS)
  const [sort, setSort] = useState<RadarSort>('score')
  const [skipped, setSkipped] = useState<Set<string>>(() => readSkipped())
  const [open, setOpen] = useState<string | null>(null)
  const [tab, setTab] = useState<RadarTab>(() => tabFromHash())
  useEffect(() => { const on = () => setTab(tabFromHash()); window.addEventListener('hashchange', on); return () => window.removeEventListener('hashchange', on) }, [])
  useEffect(() => { document.title = tab === 'orders' ? 'Orders, Nexus office' : demo ? 'Trend Radar, demo data' : 'Trend Radar' }, [demo, tab])

  const deltas = useMemo(() => termDeltas(file), [file])
  const sections = useMemo(() => [...new Set(file.candidates.map((c) => c.section))].sort(), [file])
  const flagsPresent = useMemo(() => [...new Set(file.candidates.flatMap((c) => c.flags))] as Flag[], [file])
  const visible = useMemo(() => sortCandidates(filterCandidates(file.candidates, filters, skipped), sort, deltas), [file, filters, skipped, sort, deltas])
  const skippedCount = file.candidates.filter((c) => skipped.has(c.pid)).length
  const toggleSkip = (c: Candidate) => { const next = new Set(skipped); if (next.has(c.pid)) next.delete(c.pid); else next.add(c.pid); setSkipped(next); writeSkipped(next) }
  const stale = staleBanner(file)
  const hasRun = file.terms.length > 0

  return (
    <div className="min-h-screen bg-paper text-ink">
      <RadarHeader file={file} count={visible.length} total={file.candidates.length} demo={demo} tab={tab} />
      {tab === 'radar' && stale && <div className="border-b border-check bg-check-tint px-4 py-2 text-[13px] text-check md:px-6">{stale}</div>}
      <main id="main" className="mx-auto max-w-[1440px] px-4 pb-16 md:px-6">
        {tab === 'orders' ? (
          <OrdersTab />
        ) : !hasRun ? (
          <EmptyState file={file} />
        ) : (
          <div className="grid gap-6 pt-6 lg:grid-cols-[240px_1fr]">
            <RadarRail
              filters={filters} onChange={setFilters} sort={sort} onSort={setSort}
              sections={sections} flags={flagsPresent} skippedCount={skippedCount}
              onToggleSkipped={() => setFilters({ ...filters, hideSkipped: !filters.hideSkipped })}
            />
            <div>
              {file.candidates.length === 0 ? (
                <TermsTable terms={file.terms} reason={noCandidatesReason(file)} />
              ) : visible.length === 0 ? (
                <div className="border border-rule bg-sheet px-5 py-10 text-[15px] text-ink-2">Nothing clears these filters. Loosen the net-per-sale or flag filters to see more.</div>
              ) : (
                <ol className="border-t border-ink">
                  {visible.map((c, i) => (
                    <CandidateCard
                      key={c.pid} c={c} rank={i + 1} delta={deltas[c.termId] ?? 0} term={file.terms.find((t) => t.id === c.termId)}
                      generatedAt={file.generatedAt} open={open === c.pid} onToggle={() => setOpen(open === c.pid ? null : c.pid)}
                      skipped={skipped.has(c.pid)} onSkip={() => toggleSkip(c)} issueHref={`https://github.com/${REPO}/issues/new`} repo={REPO}
                    />
                  ))}
                </ol>
              )}
              <NoveltyRail items={file.novelty} terms={file.terms} />
            </div>
          </div>
        )}
      </main>
      <footer className="border-t border-rule px-4 py-4 text-[12px] text-ink-3 md:px-6">
        {tab === 'orders'
          ? 'Order states come from the office; CJ status is synced every two hours. Refund the card in Stripe before marking an order refunded here.'
          : "Trend figures are growth in interest, never sales. Costs use CJ's listed price and cheapest freight; GST, card fees and the 45 % target margin are in the spec. Compliance notes are prompts to check, not legal advice."}
      </footer>
    </div>
  )
}
