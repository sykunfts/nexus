/*
  CLI: `radar run [--dry] [--skip-cj] [--only a,b] [--limit N]`. Reads radar/terms.json and the
  previous data/radar.json, runs the pipeline, prints a table, writes data/*.json unless --dry.
  Exits 1 when fewer than half the terms had any signal, leaving the last good files in place.
*/
import path from 'node:path'
import { createHttp } from './fetch'
import { CJ_HOST } from './cj/client'
import { runRadar } from './run'
import { readJson, writeAtomic } from './write'
import type { RadarFile, Term } from './types'

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..')
const args = process.argv.slice(2)
const flag = (name: string) => args.includes(name)
const value = (name: string) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined }

async function main() {
  if (args[0] !== 'run') { console.log('usage: radar run [--dry] [--skip-cj] [--only a,b] [--limit N]'); process.exit(2) }
  const terms = (await readJson<Term[]>(path.join(root, 'radar', 'terms.json'))) ?? []
  const previous = await readJson<RadarFile>(path.join(root, 'data', 'radar.json'))
  const { products } = await import('../../src/lib/data')
  const http = createHttp({ spacingMs: { [CJ_HOST]: 1100 } })
  const only = value('--only')?.split(',').map((s) => s.trim()).filter(Boolean)
  const limit = value('--limit') ? Number(value('--limit')) : undefined
  const started = Date.now()
  const { radar, trends, ok } = await runRadar({
    http, now: () => new Date(), env: { CJ_API_KEY: process.env.CJ_API_KEY }, terms, previous, log: (l) => console.log('  ' + l),
    products: products.map((p) => ({ id: p.id, category: p.category, price: p.price })), cj: !flag('--skip-cj'), only, limit,
  })

  console.log(`\nsources: ${Object.entries(radar.sources).map(([k, v]) => `${k}=${v}`).join('  ')}`)
  console.log(`rate: ${radar.rate.usdAud} AUD/USD (${radar.rate.source}, ${radar.rate.date})`)
  console.log('\nterm                  delta   label      conf')
  for (const t of [...radar.terms].sort((a, b) => b.delta - a.delta)) console.log(`${t.id.padEnd(22)}${String(t.delta).padStart(5)}   ${t.trendLabel.padEnd(10)} ${t.confidence}`)
  if (radar.candidates.length) {
    console.log('\ncandidates (score, retail, margin)')
    for (const c of radar.candidates.slice(0, 40)) console.log(`${c.score.toFixed(3)}  $${c.money.retailAud.toFixed(2).padStart(8)}  ${Math.round(c.money.marginPct * 100).toString().padStart(3)} %  ${c.stale ? '[stale] ' : ''}${c.name.slice(0, 70)}`)
  }
  console.log(`\n${radar.candidates.length} candidates, ${Object.keys(trends.products).length} products scored, ${((Date.now() - started) / 1000).toFixed(0)} s`)

  if (!ok) { console.error('fewer than half the terms received any signal; nothing written'); process.exit(1) }
  if (flag('--dry')) { console.log('dry run, nothing written'); return }
  await writeAtomic(path.join(root, 'data', 'radar.json'), radar)
  await writeAtomic(path.join(root, 'data', 'trends.json'), trends)
  console.log('wrote data/radar.json and data/trends.json')
}

main().catch((e) => { console.error(e); process.exit(1) })
