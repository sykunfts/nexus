// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import sample from './fixtures/radar.sample.json'

/* candidate names are the h2s inside the ranked list; the novelty rail has its own h2 */
const cards = () => Array.from(document.querySelectorAll('ol > li h2')).map((h) => h.textContent ?? '')

/* Each mount decides what data/radar.json holds: the sample by default, a variant when the test says so. */
async function mount(search = '', file: unknown = sample) {
  vi.resetModules()
  vi.doMock('../../data/radar.json', () => ({ default: file }))
  window.localStorage.clear()
  window.history.replaceState(null, '', `/radar.html${search}`)
  const { RadarApp } = await import('./RadarApp')
  await act(async () => { render(<RadarApp />) })
}

describe('Radar page', () => {
  afterEach(cleanup)
  it('renders the candidates ranked', async () => {
    await mount()
    const names = cards()
    expect(names[0]).toContain('LED Light Therapy Face Mask')
    expect(names.length).toBe(7)
    expect(screen.getByText(/7 candidates/)).toBeTruthy()
  })
  it('Skip hides and the toggle shows', async () => {
    await mount()
    await act(async () => { fireEvent.click(screen.getAllByRole('button', { name: 'Skip' })[0]) })
    expect(cards().length).toBe(6)
    expect(window.localStorage.getItem('nexus.radar.skipped')).toContain('DEMO-MASK-1')
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Show skipped \(1\)/ })) })
    expect(cards().length).toBe(7)
  })
  it('header shows the rate source and the sources line', async () => {
    await mount()
    expect(screen.getByText(/ECB rate for 3 October 2026/)).toBeTruthy()
    expect(screen.getByText(/Reddit: blocked \(403\)/)).toBeTruthy()
  })
  it('cards say exact or close match', async () => {
    await mount()
    const exact = sample.candidates.filter((c) => c.match === 1).length
    expect(exact).toBeGreaterThan(0)
    expect(screen.getAllByText('exact match').length).toBe(exact)
    expect(screen.getAllByText('close match').length).toBe(sample.candidates.length - exact)
  })
  it('Add to shop links to a prefilled issue', async () => {
    await mount()
    const link = screen.getAllByRole('link', { name: 'Add to shop' })[0] as HTMLAnchorElement
    expect(link.href).toContain('github.com/sykunfts/nexus/issues/new')
    expect(decodeURIComponent(link.href)).toContain('"pid":"DEMO-MASK-1"')
    expect(link.target).toBe('_blank')
  })
  it('the net-per-sale filter has something to do, unlike the by-construction 45 % margin', async () => {
    await mount()
    const net = (sample.candidates as { money: { netAud: number } }[]).map((c) => c.money.netAud)
    const clears = net.filter((n) => n >= 30).length
    expect(clears).toBeGreaterThan(0)
    expect(clears).toBeLessThan(net.length)
    await act(async () => { fireEvent.click(screen.getByRole('radio', { name: /\$30/ })) })
    expect(cards().length).toBe(clears)
    await act(async () => { fireEvent.click(screen.getByRole('radio', { name: /Any/ })) })
    await act(async () => { fireEvent.click(screen.getByLabelText(/AU plug only/)) })
    expect(cards().length).toBe(2)
  })
  it('a run with terms but no candidates shows the terms table and why', async () => {
    const ran = { ...(sample as object), candidates: [], sources: { wikipedia: 'ok', hackernews: 'ok', reddit: 'failed: 403', tiwib: 'ok', cj: 'skipped' } }
    await mount('', ran)
    const table = screen.getByRole('table', { name: /Terms watched/ })
    expect(table.querySelectorAll('tbody tr').length).toBe(6)
    expect(screen.getByText(/CJ_API_KEY/)).toBeTruthy()
  })
  it('expanding a candidate shows the money table and freight lines', async () => {
    await mount()
    await act(async () => { fireEvent.click(screen.getAllByRole('button', { name: /Details/ })[0]) })
    expect(screen.getByText(/Net at suggested retail/)).toBeTruthy()
    expect(screen.getAllByText(/CJPacket Ordinary/).length).toBeGreaterThan(0)
  })
  it('cards lead with profit per sale', async () => {
    await mount()
    const top = sample.candidates[0]
    const first = document.querySelector('ol > li')!
    expect(first.textContent).toContain(`A$${top.money.netAud.toFixed(2)} a sale`)
    expect(first.textContent).toContain(`at A$${top.money.retailAud.toFixed(2)}`)
  })
  it('thin candidates sit under the A$20 group', async () => {
    await mount()
    const thin = sample.candidates.filter((c) => c.money.netAud < 20)
    expect(thin.length).toBeGreaterThan(0)
    const summary = screen.getByText(`Under A$20 a sale (${thin.length})`)
    expect(summary.tagName).toBe('SUMMARY')
    const box = summary.closest('details')!
    expect(box.open).toBe(false)
    for (const c of thin) expect(box.textContent).toContain(c.name)
    expect(box.textContent).not.toContain(sample.candidates[0].name)
  })
  it('thrown out today lists rejections with reasons', async () => {
    await mount()
    const summary = screen.getByText('Thrown out today (3)')
    expect(summary.tagName).toBe('SUMMARY')
    const box = summary.closest('details')!
    expect(box.textContent).toContain('has "pet"')
    expect(box.textContent).toContain('Stainless Steel Contrasting Zircon Ring')
    expect(box.textContent).toContain('Smart rings')   // grouped under the term's label
    expect(box.querySelector('a')).toBeNull()           // titles are text, never links
  })
  it('novelty hides junk and says so', async () => {
    const f = { ...sample, novelty: [...sample.novelty, { title: 'Cannabis Infused Wine', link: 'https://x/c', date: '2026-10-01', termId: null }], noveltyHidden: 2 }
    await mount('', f)
    expect(screen.queryByText('Cannabis Infused Wine')).toBeNull()
    expect(screen.getByText('3 hidden (alcohol, tobacco, weapons or adult)')).toBeTruthy()
  })
  it('all products rejected explains itself', async () => {
    await mount('', { ...sample, candidates: [], rejected: sample.rejected.slice(0, 3) })
    expect(screen.getByText(/CJ answered, but none of its 3 products matched the watch terms\./)).toBeTruthy()
    expect(screen.getByText('Thrown out today (3)')).toBeTruthy()
  })
  it('an old file without the new fields renders', async () => {
    const old = JSON.parse(JSON.stringify(sample)) as Record<string, unknown> & { candidates: Record<string, unknown>[]; novelty: unknown[] }
    for (const c of old.candidates) { delete c.thin; delete c.match }
    delete old.rejected; delete old.noveltyHidden
    old.novelty.push({ title: 'Scarf Hidden Flask', link: 'https://x/f', date: '2026-10-01', termId: null })
    await mount('', old)
    expect(cards().length).toBe(7)
    const summary = screen.getByText('Under A$20 a sale (1)')
    expect(summary.closest('details')!.textContent).toContain('Basic NFC Smart Ring Step Counter')
    expect(screen.getAllByText('close match').length).toBe(7)
    expect(screen.queryByText(/Thrown out today/)).toBeNull()
    expect(screen.queryByText('Scarf Hidden Flask')).toBeNull()
    expect(screen.getByText('1 hidden (alcohol, tobacco, weapons or adult)')).toBeTruthy()
  })
  it('no en or em dash or unicode minus on the radar page', async () => {
    const f = { ...sample, terms: sample.terms.map((t, i) => (i === 0 ? { ...t, delta: -12 } : t)) }
    await mount('', f)
    await act(async () => { fireEvent.click(screen.getAllByRole('button', { name: /Details/ })[0]) })
    expect(document.body.textContent).toContain('-12%')
    expect(document.body.textContent).not.toMatch(/[–—−]/)
    cleanup()
    await mount('', { ...f, candidates: [] })   // the terms table
    expect(document.body.textContent).not.toMatch(/[–—−]/)
  })
  it('thrown out today counts everything thrown out, not only the ones listed', async () => {
    await mount('', { ...sample, rejectedTotal: 214 })
    expect(screen.getByText('Thrown out today (214)')).toBeTruthy()
    expect(screen.getByText(/Showing 3 of 214/)).toBeTruthy()
    cleanup()
    await mount('', { ...sample, candidates: [], rejectedTotal: 214 })
    expect(screen.getByText(/none of its 214 products matched/)).toBeTruthy()
  })
})
