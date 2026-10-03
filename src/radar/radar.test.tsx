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
    expect(names[0]).toContain('Titanium Smart Ring')
    expect(names.length).toBe(7)
    expect(screen.getByText(/7 candidates/)).toBeTruthy()
  })
  it('Skip hides and the toggle shows', async () => {
    await mount()
    await act(async () => { fireEvent.click(screen.getAllByRole('button', { name: 'Skip' })[0]) })
    expect(cards().length).toBe(6)
    expect(window.localStorage.getItem('nexus.radar.skipped')).toContain('DEMO-RING-1')
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Show skipped \(1\)/ })) })
    expect(cards().length).toBe(7)
  })
  it('header shows the rate source and the sources line', async () => {
    await mount()
    expect(screen.getByText(/ECB rate for 3 October 2026/)).toBeTruthy()
    expect(screen.getByText(/Reddit: blocked \(403\)/)).toBeTruthy()
  })
  it('keyword-scope candidates say so', async () => {
    await mount()
    expect(screen.getAllByText('keyword match').length).toBe(1)
  })
  it('Add to shop links to a prefilled issue', async () => {
    await mount()
    const link = screen.getAllByRole('link', { name: 'Add to shop' })[0] as HTMLAnchorElement
    expect(link.href).toContain('github.com/sykunfts/nexus/issues/new')
    expect(decodeURIComponent(link.href)).toContain('"pid":"DEMO-RING-1"')
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
})
