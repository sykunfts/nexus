/* What the home page shows, in one place: the product of the week, the ranked rails and their ids. */
import { PRICE_CHECKED, products } from '../../lib/data'
import { TRENDS_GENERATED_AT } from '../../lib/trends.generated'

export const HERO = 'xgimi-mogo-4-laser'
export const HERO_LINE = 'Triple-laser 1080p projector, Google TV, 2.5 h battery'
export const LATEST_CHECK: string = products.map((p) => p.priceCheckedAt).sort().slice(-1)[0] ?? PRICE_CHECKED

/* With real trend data the fastest movers are computed; before that, a hand-picked sample set. */
export const MOVERS: string[] = TRENDS_GENERATED_AT
  ? [...products].sort((a, b) => b.trend.delta - a.trend.delta).slice(0, 4).map((p) => p.id)
  : ['omnilux-contour-face', 'plaud-notepin-s', 'ringconn-gen-3', 'rayban-meta-gen-3']

export const SETUP = { title: 'Works with your iPhone and Apple Home', ids: ['xgimi-mogo-4-laser', 'anker-maggo-10k', 'aqara-camera-e1', 'chipolo-pop'] }
export const SHELF_IDS = ['segway-e3-pro', 'eufy-x10-pro-omni', 'elite-yard-master-2-100', 'anker-prime-100w']
export const MOVERS_NOTE = '7-day change in interest, search and social combined. Sample data until the trend worker runs.'
