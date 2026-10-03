import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { load } from 'js-yaml'
import pkg from '../../package.json'

type Wf = { on: Record<string, unknown>; permissions?: Record<string, string>; concurrency?: unknown; jobs: Record<string, { if?: string; steps: { run?: string; env?: Record<string, string>; uses?: string }[] }> }
const read = (name: string) => load(readFileSync(`.github/workflows/${name}`, 'utf8')) as Wf
const runs = (w: Wf) => Object.values(w.jobs).flatMap((j) => j.steps.map((s) => s.run ?? ''))
const npmScripts = (w: Wf) => runs(w).flatMap((r) => [...r.matchAll(/npm run ([a-z:-]+)/g)].map((m) => m[1]))

describe('workflows', () => {
  it('the radar runs daily at 20:00 UTC with the key from secrets', () => {
    const w = read('radar.yml')
    expect((w.on.schedule as { cron: string }[])[0].cron).toBe('0 20 * * *')
    expect(w.on).toHaveProperty('workflow_dispatch')
    expect(w.permissions?.contents).toBe('write')
    expect(w.concurrency).toBeTruthy()
    const step = Object.values(w.jobs)[0].steps.find((s) => s.run?.includes('npm run radar'))!
    expect(step.env?.CJ_API_KEY).toBe('${{ secrets.CJ_API_KEY }}')
  })
  it('pages deploys on push, after a radar run and after a listing, and never gates on the data-dependent suite', () => {
    const w = read('pages.yml')
    expect(w.on).toHaveProperty('push')
    expect((w.on.push as { branches: string[] }).branches).toEqual(['main'])   // GitHub's default branch for this repository
    expect(w.on).toHaveProperty('workflow_dispatch')
    expect((w.on.workflow_run as { workflows: string[] }).workflows).toEqual(expect.arrayContaining(['Trend Radar', 'Add a Radar listing']))
    expect(w.jobs.build.if).toContain("github.event_name != 'workflow_run' || github.event.workflow_run.conclusion == 'success'")
    expect(w.permissions?.pages).toBe('write')
    expect(runs(w).some((r) => r.includes('npm run merge'))).toBe(true)
    expect(runs(w).some((r) => r.includes('npm run build'))).toBe(true)
    expect(runs(w).some((r) => /npm (run )?test\b/.test(r))).toBe(false)   // a real trends file must never stop a deploy
    expect(Object.values(w.jobs).some((j) => j.steps.some((s) => s.uses?.startsWith('actions/deploy-pages')))).toBe(true)
  })
  it('the listing job only acts on the owner\'s "list:" issues', () => {
    const w = read('listing.yml')
    expect(w.on).toHaveProperty('issues')
    const job = Object.values(w.jobs)[0]
    expect(job.if).toContain("startsWith(github.event.issue.title, 'list:')")
    expect(job.if).toContain('github.event.issue.user.login == github.repository_owner')
    expect(w.permissions?.issues).toBe('write')
    expect(runs(w).some((r) => r.includes('npm run listing'))).toBe(true)
  })
  it('the two committing workflows share a concurrency group and rebase before pushing', () => {
    const radar = read('radar.yml'); const listing = read('listing.yml')
    expect((radar.concurrency as { group: string }).group).toBe('data')
    expect((listing.concurrency as { group: string }).group).toBe('data')
    for (const w of [radar, listing]) expect(runs(w).some((r) => r.includes('git pull --rebase'))).toBe(true)
  })
  it('every npm script the workflows call exists', () => {
    for (const f of ['radar.yml', 'pages.yml', 'listing.yml']) for (const s of npmScripts(read(f))) expect(Object.keys(pkg.scripts), `${f} → ${s}`).toContain(s)
  })
})
