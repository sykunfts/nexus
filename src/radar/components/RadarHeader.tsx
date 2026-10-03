/* The dark band at the top: what this is, when it ran, what fed it, and the rate behind every AUD figure. */
import type { RadarFile } from '../../../radar/src/types'
import { longDate } from '../../lib/data'
import { rateLabel, sourcesLine } from '../lib'
import { cn } from '../../lib/cn'
import type { RadarTab } from '../RadarApp'

export function RadarHeader({ file, count, total, demo, tab = 'radar' }: { file: RadarFile; count: number; total: number; demo: boolean; tab?: RadarTab }) {
  const ran = file.terms.length > 0
  const link = (t: RadarTab, label: string, href: string) => <a href={href} aria-current={tab === t ? 'page' : undefined} className={cn('border-b-2 pb-1 text-[13.5px]', tab === t ? 'border-signal text-on-mat' : 'border-transparent text-on-mat/60 hover:text-on-mat')}>{label}</a>
  return (
    <header className="border-b border-ink bg-mat text-on-mat">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-end justify-between gap-x-8 gap-y-4 px-4 py-5 md:px-6">
        <div>
          <div className="flex items-baseline gap-3">
            <a href="./" className="display text-[22px] text-on-mat/80 hover:text-on-mat">Nexus</a>
            <h1 className="display text-[34px] leading-none text-on-mat sm:text-[40px]">{tab === 'orders' ? 'Office' : 'Trend Radar'}</h1>
            {demo && tab === 'radar' && <span className="reading bg-signal px-1.5 py-0.5 text-[11px] text-ink">demo data</span>}
          </div>
          {tab === 'radar' ? (
            <>
              <p className="mt-2 max-w-[70ch] text-[13.5px] text-on-mat/75">
                {ran ? `Run ${longDate(file.generatedAt)}. ${sourcesLine(file.sources)}` : sourcesLine(file.sources)}
              </p>
              <p className="mt-1 text-[12.5px] text-on-mat/60">{rateLabel(file.rate)}.</p>
            </>
          ) : (
            <p className="mt-2 max-w-[70ch] text-[13.5px] text-on-mat/75">Orders the shop has taken, what the supplier is doing with them, and who is waiting on a listing.</p>
          )}
          <nav aria-label="Office sections" className="mt-3 flex gap-4">{link('radar', 'Radar', '#')}{link('orders', 'Orders', '#orders')}</nav>
        </div>
        {tab === 'radar' && <dl className="reading flex gap-6 text-[12px] text-on-mat/70">
          <div><dt>Candidates</dt><dd className="text-[26px] leading-none text-on-mat">{count === total ? total : `${count} of ${total}`}</dd></div>
          <div><dt>Terms watched</dt><dd className="text-[26px] leading-none text-on-mat">{file.terms.length}</dd></div>
          <div><dt>Rising or better</dt><dd className="text-[26px] leading-none text-on-mat">{file.terms.filter((t) => t.trendLabel !== 'Steady').length}</dd></div>
        </dl>}
      </div>
      {tab === 'radar' && ran && count !== total && <div className="sr-only">{count} candidates shown of {total}</div>}
      {tab === 'radar' && <p className="sr-only">{total} candidates</p>}
    </header>
  )
}
