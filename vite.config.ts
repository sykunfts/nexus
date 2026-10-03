import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { fileURLToPath } from 'node:url'

/*
  Two pages: the shop (index.html) and the Trend Radar (radar.html). Relative asset paths so the
  build works from a file:// URL, on GitHub Pages under /nexus/, and anywhere else.
  FRAGMENT=1 inlines everything into dist/index.html for the claude.ai artifact (scripts/fragment.mjs).
*/
const fragment = process.env.FRAGMENT === '1'
/* DEMO_LISTINGS=1 swaps the generated Radar listings for one demo CJ listing, so the office checkout can be screenshotted before the first real listing exists. */
const demoListings = process.env.DEMO_LISTINGS === '1'
const here = (p: string) => fileURLToPath(new URL(p, import.meta.url))

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), ...(fragment ? [viteSingleFile()] : [])],
  resolve: { alias: demoListings ? [{ find: /^\.\/data\.listings$/, replacement: here('src/lib/data.listings.demo.ts') }] : [] },
  build: {
    target: 'es2020',
    cssCodeSplit: false,
    assetsInlineLimit: fragment ? 100_000_000 : 4096,
    minify: 'esbuild',
    reportCompressedSize: false,
    chunkSizeWarningLimit: 4000,
    rollupOptions: { input: fragment ? { index: here('index.html') } : { index: here('index.html'), radar: here('radar.html') } },
  },
})
