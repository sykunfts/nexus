/* One made-up Radar listing for screenshots of the office checkout (vite.config.ts, DEMO_LISTINGS=1). Never part of a real build. */
import type { Product } from './data'

export const LISTINGS: Product[] = [{
  id: 'cj-DEMO-P-A1',
  name: 'Mini Laser Projector (demo listing)',
  brand: 'Nexus Select',
  category: 'Home cinema',
  tagline: 'Home cinema find from the Trend Radar, shipped direct from the maker in China.',
  price: 95.95,
  priceCheckedAt: '2026-10-04',
  listedAt: '2026-10-04',
  market: 'global',
  sources: ['Trend Radar, supplier catalogue, 4 October 2026'],
  supplier: { url: 'https://cjdropshipping.com/product/demo', pid: 'DEMO-P-A1', vid: 'DEMO-V-AU', costUsd: 62.4, termId: 'laser-projector' },
  rating: null,
  stock: 'in',
  fulfil: { route: 'supplier', origin: 'CN' },
  visual: 'projector',
  hue: 212,
  photos: [],
  variants: [{ id: 'cj-DEMO-V-AU', label: 'AU plug', swatch: '#2b2b30', hue: 212 }],
  badges: ['From the Radar'],
  trend: { label: 'Rising', delta: 64, series: [2, 3, 3, 4, 5, 6, 8, 9], source: 'Trend Radar signals' },
  specs: [{ group: 'Supplier', rows: [{ label: 'Weight', value: '820 g', n: 820, better: 'low' }, { label: 'Ships from', value: 'China, CJdropshipping' }, { label: 'Plug', value: 'AU plug variant' }] }],
  facts: { plug: 'AU', voltage: '100-240' },
}]
