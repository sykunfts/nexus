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
  it('office.yml deploys on main pushes to office paths, after a listing, and by hand', () => {
    const w = read('office.yml')
    const push = w.on.push as { branches: string[]; paths: string[] }
    expect(push.branches).toEqual(['main'])
    for (const p of ['office/**', 'src/lib/data.ts', 'src/lib/data.expansion.ts', 'src/lib/data.listings.ts', 'src/lib/shipping.ts', 'src/lib/orders.ts', 'src/lib/validate.ts', 'scripts/merge-office.mjs', 'radar/src/**']) expect(push.paths, p).toContain(p)
    expect((w.on.workflow_run as { workflows: string[]; types: string[] })).toEqual({ workflows: ['Add a Radar listing'], types: ['completed'] })
    expect(w.on).toHaveProperty('workflow_dispatch')
    const job = Object.values(w.jobs)[0]
    expect(job.if).toContain("github.event_name != 'workflow_run' || github.event.workflow_run.conclusion == 'success'")
    expect(runs(w).some((r) => r.includes('npm run merge'))).toBe(true)
    expect(runs(w).some((r) => r.includes('npm run office:merge'))).toBe(true)
    expect(runs(w).some((r) => r.includes('npm run office:test'))).toBe(true)
    expect(runs(w).some((r) => r.includes('npm run typecheck'))).toBe(true)
  })
  it('office.yml passes the five secrets and the KV id, and never prints them', () => {
    const w = read('office.yml')
    const job = Object.values(w.jobs)[0]
    const deploy = job.steps.find((s) => s.uses?.startsWith('cloudflare/wrangler-action'))! as { uses: string; with: Record<string, string>; env: Record<string, string> }
    expect(deploy).toBeTruthy()
    expect(deploy.with.apiToken).toBe('${{ secrets.CLOUDFLARE_API_TOKEN }}')
    expect(deploy.with.accountId).toBe('${{ secrets.CLOUDFLARE_ACCOUNT_ID }}')
    expect(deploy.with.workingDirectory).toBe('office')
    expect(deploy.with.command).toBe('deploy')
    const secrets = ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'CJ_API_KEY', 'RESEND_API_KEY', 'ADMIN_TOKEN']
    expect(deploy.with.secrets.trim().split(/\s+/)).toEqual(secrets)
    for (const k of secrets) expect(deploy.env[k]).toBe(`\${{ secrets.${k} }}`)
    expect(runs(w).some((r) => r.includes('KV_NAMESPACE_ID_PLACEHOLDER') && r.includes('vars.KV_NAMESPACE_ID'))).toBe(true)
    expect(runs(w).some((r) => /echo.*secrets\./.test(r))).toBe(false)
  })
  it('pages.yml passes VITE_OFFICE_URL from vars', () => {
    const w = read('pages.yml')
    const build = w.jobs.build.steps.find((s) => s.run === 'npm run build')!
    expect(build.env?.VITE_OFFICE_URL).toBe('${{ vars.OFFICE_URL }}')
  })
  it('every npm script the workflows call exists', () => {
    for (const f of ['radar.yml', 'pages.yml', 'listing.yml', 'office.yml']) for (const s of npmScripts(read(f))) expect(Object.keys(pkg.scripts), `${f} → ${s}`).toContain(s)
  })
  it('the README has the Back office section the Orders tab links to', () => {
    const readme = readFileSync('README.md', 'utf8')
    expect(readme).toMatch(/^## Back office/m)
    for (const k of ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID', 'KV_NAMESPACE_ID', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'OFFICE_URL', 'ADMIN_TOKEN', 'CJ_DRY_RUN', 'RESEND_API_KEY', 'EMAIL_ENABLED']) expect(readme, k).toContain(k)
    expect(readme).toContain('whsec_placeholder')                 // wrangler-action refuses a listed secret that is unset, so the first deploy needs placeholders
    expect(readme).toContain('checkout.session.async_payment_succeeded')
    expect(readme).toContain('onboarding@resend.dev')
  })
})
