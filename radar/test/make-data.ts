/* Writes realistic data/trends.json + data/radar.json + one listing from the fixtures, to prove the suite is data-independent. Dev only. */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { createHttp } from '../src/fetch'
import { runRadar } from '../src/run'
import { draftListing } from '../src/listing'
import terms from '../terms.json'
import wiki from './fixtures/wikipedia.json'
import hn from './fixtures/hackernews.json'
import reddit from './fixtures/reddit.json'
import cats from './fixtures/cj-categories.json'
import list from './fixtures/cj-list.json'
import query from './fixtures/cj-query.json'
import freight from './fixtures/cj-freight.json'
import type { Term } from '../src/types'

const feedXml = readFileSync(new URL('./fixtures/tiwib.xml', import.meta.url), 'utf8')
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
const http = createHttp({ sleep: async () => {}, retryDelays: [], fetch: async (url) => {
  if (url.includes('wikimedia.org')) return json(wiki)
  if (url.includes('hn.algolia.com')) return json(hn)
  if (url.includes('reddit.com')) return json(reddit)
  if (url.includes('thisiswhyimbroke.com')) return new Response(feedXml, { status: 200 })
  if (url.includes('frankfurter.app')) return json({ date: '2026-10-03', rates: { AUD: 1.515 } })
  if (url.includes('getAccessToken')) return json({ result: true, data: { accessToken: 't' } })
  if (url.includes('getCategory')) return json(cats)
  if (url.includes('/product/list')) return json(list)
  if (url.includes('/product/query')) return json(query)
  if (url.includes('freightCalculate')) return json(freight)
  return json({}, 500)
} })
const out = process.argv[2] ?? 'data'
const { radar, trends } = await runRadar({ http, now: () => new Date('2026-10-04T20:05:10Z'), env: { CJ_API_KEY: 'k' }, terms: terms as Term[], previous: null, products: [], log: () => {}, cj: true, limit: 2 })
mkdirSync(`${out}/listings`, { recursive: true })
writeFileSync(`${out}/radar.json`, JSON.stringify(radar, null, 2))
writeFileSync(`${out}/trends.json`, JSON.stringify(trends, null, 2))
const c = radar.candidates[0]
writeFileSync(`${out}/listings/${c.pid}.json`, JSON.stringify(draftListing(c, null, '2026-10-04', c.money.retailAud), null, 2))
console.log(`wrote ${out}: ${Object.keys(trends.products).length} product trends, ${radar.candidates.length} candidates, listing ${c.pid}`)
