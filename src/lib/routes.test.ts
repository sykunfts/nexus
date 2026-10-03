import { describe, expect, it } from 'vitest'
import { formatRoute, pageKey, parseFilters, parseRoute, serialiseFilters, Route } from './routes'

const cases: [string, Route][] = [
  ['#/', { name: 'home' }],
  ['#/c/cinema?f=route%3Awarehouse%3Bplatform%3Aios%2Cmatter%3Bprice%3A0-200&sort=price-asc', { name: 'collection', slug: 'cinema', filters: { route: 'warehouse', platform: ['ios', 'matter'], price: [0, 200] }, sort: 'price-asc' }],
  ['#/search?q=laser%20projector&f=', { name: 'search', q: 'laser projector', filters: {} }],
  ['#/p/xgimi-mogo-4-laser', { name: 'product', id: 'xgimi-mogo-4-laser' }],
  ['#/compare?ids=ringconn-gen-3%2Coura-ring-5', { name: 'compare', ids: ['ringconn-gen-3', 'oura-ring-5'] }],
  ['#/setup', { name: 'setup' }],
  ['#/guides', { name: 'guides' }],
  ['#/guides/movie-night', { name: 'guide', slug: 'movie-night' }],
  ['#/how-we-pick', { name: 'how-we-pick' }],
  ['#/account', { name: 'account' }],
  ['#/orders', { name: 'orders' }],
  ['#/orders/NX-123456', { name: 'order', id: 'NX-123456' }],
  ['#/checkout', { name: 'checkout' }],
  ['#/orders/NX-123456/confirmed', { name: 'confirmed', id: 'NX-123456' }],
  ['#/orders/confirmed?session=cs_test_a1', { name: 'confirmed-session', sessionId: 'cs_test_a1' }],
  ['#/policies/terms', { name: 'policy', slug: 'terms' }],
]

describe('routes', () => {
  it.each(cases)('round-trips %s', (hash, route) => {
    expect(parseRoute(hash)).toEqual(route)
    expect(parseRoute(formatRoute(route))).toEqual(route)
  })
  it('accepts legacy hashes', () => {
    expect(parseRoute('#xgimi-mogo-4-laser')).toEqual({ name: 'product', id: 'xgimi-mogo-4-laser' })
    expect(parseRoute('#home')).toEqual({ name: 'home' })
    expect(parseRoute('')).toEqual({ name: 'home' })
  })
  it('gives not-found for unknown paths', () => {
    expect(parseRoute('#/nope/x')).toEqual({ name: 'not-found', hash: '#/nope/x' })
  })
  it('ignores malformed filter pairs', () => {
    expect(parseFilters('price:abc;route:;platform:ios;bogus:1;worksWithSetup:1')).toEqual({ platform: ['ios'], worksWithSetup: true })
    expect(parseFilters('price:800-inf')).toEqual({ price: [800, Infinity] })
  })
  it('serialises price inf and text', () => {
    expect(serialiseFilters({ price: [800, Infinity], text: 'power bank' })).toBe('price:800-inf;text:power%20bank')
  })
  it('pageKey ignores filters and sort so a filter change does not remount the page', () => {
    expect(pageKey(parseRoute('#/c/cinema'))).toBe(pageKey(parseRoute('#/c/cinema?f=route:warehouse&sort=newest')))
    expect(pageKey(parseRoute('#/c/cinema'))).not.toBe(pageKey(parseRoute('#/c/alexa')))
    expect(pageKey(parseRoute('#/search?q=ring'))).not.toBe(pageKey(parseRoute('#/search?q=lamp')))
    expect(pageKey(parseRoute('#/p/oura-ring-5'))).not.toBe(pageKey(parseRoute('#/p/anker-maggo-10k')))
  })
})
