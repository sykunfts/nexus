/* Filters and sort. A disclosure on phones, a column on wide screens. */
import { useState } from 'react'
import type { Flag } from '../../../radar/src/types'
import { FLAG_NOTES } from '../../../radar/src/flags'
import { cn } from '../../lib/cn'
import type { RadarFilters, RadarSort } from '../lib'

const FLAG_LABEL: Record<Flag, string> = { battery: 'Lithium battery', mains: 'Mains power', radio: 'Radio / Bluetooth', skin: 'Used on the body', kids: 'For children', heavy: 'Over 2 kg' }
const SORTS: { id: RadarSort; label: string }[] = [{ id: 'score', label: 'Radar score' }, { id: 'margin', label: 'Margin' }, { id: 'trend', label: 'Trend' }, { id: 'demand', label: 'Dropshipper demand' }, { id: 'newest', label: 'Newest' }]

export function RadarRail(p: { filters: RadarFilters; onChange: (f: RadarFilters) => void; sort: RadarSort; onSort: (s: RadarSort) => void; sections: string[]; flags: Flag[]; skippedCount: number; onToggleSkipped: () => void }) {
  const [openMobile, setOpenMobile] = useState(false)
  const f = p.filters
  const body = (
    <div className="space-y-5 text-[13.5px]">
      <div>
        <div className="mb-1.5 text-[12.5px] text-ink-3">Sort by</div>
        <select value={p.sort} onChange={(e) => p.onSort(e.target.value as RadarSort)} aria-label="Sort by" className="h-9 w-full border border-rule-2 bg-sheet px-2 text-ink">
          {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </div>
      <div>
        <div className="mb-1.5 text-[12.5px] text-ink-3">Section</div>
        <ul className="space-y-0.5">
          <li><label className="flex items-center gap-2"><input type="radio" name="section" checked={f.section === null} onChange={() => p.onChange({ ...f, section: null })} className="accent-ink" />All sections</label></li>
          {p.sections.map((s) => <li key={s}><label className="flex items-center gap-2"><input type="radio" name="section" checked={f.section === s} onChange={() => p.onChange({ ...f, section: s })} className="accent-ink" />{s}</label></li>)}
        </ul>
      </div>
      <div>
        <div className="mb-1.5 text-[12.5px] text-ink-3">Minimum margin</div>
        <div className="flex border border-rule-2 bg-sheet" role="radiogroup" aria-label="Minimum margin">
          {([0, 0.3, 0.45] as const).map((m) => (
            <button key={m} type="button" role="radio" aria-checked={f.minMargin === m} onClick={() => p.onChange({ ...f, minMargin: m })} className={cn('reading flex-1 py-1.5 text-[12.5px]', f.minMargin === m ? 'bg-ink text-paper' : 'text-ink-2 hover:text-ink')}>
              {m === 0 ? 'Any' : `${Math.round(m * 100)} %`}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="mb-1.5 text-[12.5px] text-ink-3">Leave out</div>
        <ul className="space-y-0.5">
          {p.flags.map((fl) => (
            <li key={fl}><label className="flex items-center gap-2" title={FLAG_NOTES[fl]}><input type="checkbox" checked={f.exclude.includes(fl)} onChange={() => p.onChange({ ...f, exclude: f.exclude.includes(fl) ? f.exclude.filter((x) => x !== fl) : [...f.exclude, fl] })} className="accent-ink" />{FLAG_LABEL[fl]}</label></li>
          ))}
          <li><label className="flex items-center gap-2"><input type="checkbox" checked={f.auPlugOnly} onChange={() => p.onChange({ ...f, auPlugOnly: !f.auPlugOnly })} className="accent-ink" />AU plug only</label></li>
        </ul>
      </div>
      <button type="button" onClick={p.onToggleSkipped} className="text-[13px] text-ink-2 underline underline-offset-4 hover:text-ink" disabled={p.skippedCount === 0 && f.hideSkipped}>
        {f.hideSkipped ? `Show skipped (${p.skippedCount})` : 'Hide skipped'}
      </button>
    </div>
  )
  return (
    <aside aria-label="Filters">
      <button type="button" onClick={() => setOpenMobile(!openMobile)} className="mb-3 flex h-10 w-full items-center justify-between border border-ink bg-sheet px-3 text-[14px] text-ink lg:hidden" aria-expanded={openMobile}>
        Filters and sort <span className="reading text-[12px] text-ink-3">{openMobile ? 'close' : 'open'}</span>
      </button>
      <div className={cn('border border-rule bg-sheet p-4 lg:sticky lg:top-4 lg:block', openMobile ? 'block' : 'hidden')}>{body}</div>
    </aside>
  )
}
