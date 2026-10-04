// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { SetupRow } from './SetupRow'
import { useStore } from '../../lib/store'

afterEach(cleanup)

describe('SetupRow', () => {
  it('lists every enabled setup item and counts them in the sentence and on the cards', () => {
    render(<SetupRow />)
    expect(screen.getByText('iPhone 16 Pro')).toBeTruthy()
    expect(screen.getByText('Apple Home (Apple TV 4K)')).toBeTruthy()
    expect(screen.getByText('Nintendo Switch')).toBeTruthy()
    expect(screen.queryByText('Pixel 9')).toBeNull()
    expect(screen.getByText(/checks itself against these five before you pay/)).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Works with your iPhone and Apple Home' })).toBeTruthy()
    expect(screen.getAllByText('Works with all 5').length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link').filter((l) => l.getAttribute('href')?.startsWith('#/p/'))).toHaveLength(4)
  })
  it('puts the phone first and the hub second', () => {
    render(<SetupRow />)
    const chips = screen.getAllByRole('listitem').map((li) => li.textContent)
    expect(chips.indexOf('iPhone 16 Pro')).toBe(0)
    expect(chips.indexOf('Apple Home (Apple TV 4K)')).toBe(1)
  })
  it('offers setup when nothing is enabled', async () => {
    render(<SetupRow />)
    await act(async () => { const s = useStore.getState(); s.gear.forEach((g) => { if (useStore.getState().gearOn[g.id]) s.toggleGear(g.id) }) })
    expect(screen.getByText(/Add your phone, hub and plug once/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Set up in two minutes' })).toBeTruthy()
    expect(screen.queryByText(/checks itself against these/)).toBeNull()
    expect(screen.queryByText(/Works with all 0/)).toBeNull()
  })
  it('the works-with row is a four-column grid at desktop, so no card is out of reach of a mouse', () => {
    render(<SetupRow />)
    const row = screen.getAllByRole('link').find((l) => l.getAttribute('href')?.startsWith('#/p/'))!.closest('ul')!
    expect(row.className).toMatch(/lg:grid-cols-4/)
  })
})
