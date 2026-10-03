/*
  Probe the CJdropshipping API with the key in .env: get a token, search products, read one product's
  variants and quote freight to Australia. Prints a compact summary so the connector can be designed
  against real response shapes. Never prints the key.
*/
import { readFile } from 'node:fs/promises'

const env = Object.fromEntries((await readFile(new URL('../.env', import.meta.url), 'utf8')).split('\n').filter((l) => l.includes('=')).map((l) => l.split(/=(.*)/s).slice(0, 2)))
const KEY = env.CJ_API_KEY
if (!KEY) throw new Error('CJ_API_KEY missing from .env')
const BASE = 'https://developers.cjdropshipping.com/api2.0/v1'
const term = process.argv[2] ?? 'laser projector'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function call(path, { method = 'GET', body, token } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { 'CJ-Access-Token': token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json
  try { json = JSON.parse(text) } catch { json = { raw: text.slice(0, 300) } }
  return { status: res.status, json }
}

const auth = await call('/authentication/getAccessToken', { method: 'POST', body: { apiKey: KEY } })
console.log('auth', auth.status, auth.json.code, auth.json.message, auth.json.data ? Object.keys(auth.json.data) : '')
const token = auth.json.data?.accessToken
if (!token) process.exit(1)
await sleep(1100)

const list = await call(`/product/list?productNameEn=${encodeURIComponent(term)}&pageNum=1&pageSize=10`, { token })
console.log('list', list.status, list.json.code, list.json.message, 'total', list.json.data?.total)
const items = list.json.data?.list ?? []
for (const p of items.slice(0, 10)) {
  console.log(` - ${p.pid} | ${String(p.productNameEn).slice(0, 70)} | sell ${p.sellPrice} USD | ${p.categoryName} | listed ${p.listedNum} | warehouses ${p.warehouses ?? '-'}`)
}
if (items[0]) console.log('list item keys:', Object.keys(items[0]).join(', '))
await sleep(1100)

if (items[0]) {
  const q = await call(`/product/query?pid=${items[0].pid}`, { token })
  const d = q.json.data
  console.log('query', q.status, q.json.code, d ? `variants ${d.variants?.length}, weight ${d.productWeight} g, images ${Array.isArray(d.productImageSet) ? d.productImageSet.length : '-'}` : q.json.message)
  if (d) {
    console.log('product keys:', Object.keys(d).join(', '))
    const v = d.variants?.[0]
    if (v) console.log('variant keys:', Object.keys(v).join(', '))
    if (v) console.log('variant 0:', v.vid, v.variantNameEn, v.variantSellPrice, 'USD', v.variantWeight, 'g', v.variantSku)
    await sleep(1100)
    const fr = await call('/logistic/freightCalculate', { method: 'POST', token, body: { startCountryCode: 'CN', endCountryCode: 'AU', products: [{ quantity: 1, vid: v?.vid }] } })
    console.log('freight', fr.status, fr.json.code, fr.json.message)
    for (const o of (fr.json.data ?? []).slice(0, 6)) console.log(` - ${o.logisticName}: ${o.logisticPrice} ${o.logisticPriceCn ? '' : ''}USD, ${o.logisticAging} days`)
    if (fr.json.data?.[0]) console.log('freight keys:', Object.keys(fr.json.data[0]).join(', '))
  }
}
