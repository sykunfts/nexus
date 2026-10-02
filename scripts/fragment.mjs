/*
  Turn dist/index.html (vite-plugin-singlefile output) into the skeleton-free fragment the Artifact tool
  publishes: title, meta, font links, inline style, root div and the inline module script. No doctype/html/head/body.
*/
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const html = await readFile(path.join(root, 'dist', 'index.html'), 'utf8')
const pick = (re) => (html.match(re) ?? []).map((m) => m)
const title = html.match(/<title>[\s\S]*?<\/title>/)?.[0] ?? '<title>NEXUS Marketplace</title>'
const metas = pick(/<meta name="description"[^>]*>/g)
const links = pick(/<link rel="(?:preconnect|stylesheet)"[^>]*>/g)
const styles = pick(/<style[^>]*>[\s\S]*?<\/style>/g).map((s) => s.replace(/^<style[^>]*>/, "<style>"))
const scripts = pick(/<script type="module"[^>]*>[\s\S]*?<\/script>/g)
const out = [title, ...metas, ...links, ...styles, '<div id="root"></div>', ...scripts].join('\n') + '\n'
const target = path.join(root, '..', 'nexus-marketplace.html')
await writeFile(target, out)
console.log(`wrote ${target} (${(out.length / 1024).toFixed(0)} KB): ${styles.length} style, ${scripts.length} script`)
