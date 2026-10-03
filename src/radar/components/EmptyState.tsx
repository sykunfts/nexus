/* Before the first run (or after one that found nothing): what to do, and a way to see the layout. */
import type { RadarFile } from '../../../radar/src/types'
import { sourcesLine } from '../lib'

export function EmptyState({ file }: { file: RadarFile }) {
  return (
    <div className="mx-auto max-w-[64ch] py-14">
      <h2 className="display-md text-[30px] text-ink">The Radar hasn&rsquo;t run yet.</h2>
      <p className="mt-3 text-[15px] text-ink-2">{sourcesLine(file.sources)} It runs every morning on GitHub once the repository is set up; the first run can be started by hand from the Actions tab.</p>
      <ol className="mt-5 space-y-2 text-[14.5px] text-ink-2">
        <li>1. Settings → Secrets and variables → Actions → New repository secret: <span className="reading text-[13px] text-ink">CJ_API_KEY</span>.</li>
        <li>2. Settings → Pages → Source: GitHub Actions.</li>
        <li>3. Actions → Trend Radar → Run workflow. This page refreshes itself about ten minutes later.</li>
      </ol>
      <p className="mt-6 text-[13.5px] text-ink-3">To see the layout with made-up candidates, open <a href="?demo=1" className="underline underline-offset-4">the demo view</a>.</p>
    </div>
  )
}
