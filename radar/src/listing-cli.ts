/* Run by .github/workflows/listing.yml: turn an approved issue into data/listings/<pid>.json. Exit 2 with a reason when refused. */
import path from 'node:path'
import { decide } from './listing'
import { readJson, writeAtomic } from './write'
import type { RadarFile, TrendsFile } from './types'

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..')
const env = (k: string) => process.env[k] ?? ''

async function main() {
  const radar = await readJson<RadarFile>(path.join(root, 'data', 'radar.json'))
  const trends = await readJson<TrendsFile>(path.join(root, 'data', 'trends.json'))
  if (!radar) { console.log('REASON=data/radar.json is missing'); process.exit(2) }
  const req = { author: env('ISSUE_AUTHOR'), owner: env('REPO_OWNER'), title: env('ISSUE_TITLE'), body: env('ISSUE_BODY'), radar }
  const pre = decide(req)
  const trend = pre.ok ? trends?.terms.find((t) => t.id === pre.request.termId) : undefined
  const d = decide({ ...req, trend: trend ? { delta: trend.delta, label: trend.trendLabel, score: trend.score, confidence: trend.confidence, series: trend.series } : null })
  if (!d.ok) { console.log(`REASON=${d.reason}`); process.exit(2) }
  const file = path.join(root, 'data', 'listings', `${d.request.pid}.json`)
  await writeAtomic(file, d.product)
  console.log(`LISTING_PATH=data/listings/${d.request.pid}.json`)
  console.log(`PRODUCT_ID=${d.product.id}`)
}

main().catch((e) => { console.log(`REASON=${e instanceof Error ? e.message : String(e)}`); process.exit(2) })
