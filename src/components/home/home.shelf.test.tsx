// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

afterEach(() => { cleanup(); vi.unstubAllEnvs(); vi.resetModules() })

describe('Shelf', () => {
  it('Add puts one line in the cart', async () => {
    const { Shelf } = await import('./Shelf')
    const { useStore } = await import('../../lib/store')
    const { fmt } = await import('../../lib/currency')
    render(<Shelf />)
    expect(screen.getByRole('heading', { name: 'On the shelf in Sydney' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Add KickScooter E3 Pro to cart' }))
    expect(useStore.getState().cart).toHaveLength(1)
    expect(screen.getAllByText(fmt(999, useStore.getState().currency, { compact: true })).length).toBeGreaterThan(0)
  })
  it('shows the stock alert instead of Add when the office cannot sell it', async () => {
    vi.stubEnv('VITE_OFFICE_URL', 'https://office.test')
    const { Shelf } = await import('./Shelf')
    render(<Shelf />)
    expect(screen.queryByRole('button', { name: /Add .* to cart/ })).toBeNull()
    expect(screen.getAllByRole('button', { name: 'Tell me when' }).length).toBe(4)
  })
  it('opening the stock alert puts the email form on its own full-width row', async () => {
    vi.stubEnv('VITE_OFFICE_URL', 'https://office.test')
    const { Shelf } = await import('./Shelf')
    render(<Shelf />)
    fireEvent.click(screen.getAllByRole('button', { name: 'Tell me when' })[0])
    const input = await screen.findByLabelText('Email for a stock alert')
    expect(input.closest('.col-span-full')).toBeTruthy()
    expect(screen.getAllByLabelText('Email for a stock alert')).toHaveLength(1)
  })
  it('shows the whole tagline, clamped, not a fragment', async () => {
    const { Shelf } = await import('./Shelf')
    const { byId } = await import('../../lib/data')
    render(<Shelf />)
    const line = screen.getByText(byId('eufy-x10-pro-omni').tagline)
    expect(line.className).toMatch(/line-clamp-1/)
  })
  it('the alert form lets its button wrap under a full-width email field on narrow screens', async () => {
    vi.stubEnv('VITE_OFFICE_URL', 'https://office.test')
    const { Shelf } = await import('./Shelf')
    render(<Shelf />)
    fireEvent.click(screen.getAllByRole('button', { name: 'Tell me when' })[0])
    const input = await screen.findByLabelText('Email for a stock alert')
    expect(input.parentElement!.className).toMatch(/\bflex-wrap\b/)
    expect(input.className).toMatch(/min-w-\[200px\]/)
  })
  it('on phones the price sits under the name so the name keeps its width', async () => {
    const { Shelf } = await import('./Shelf')
    render(<Shelf />)
    const row = screen.getByRole('link', { name: 'Segway-Ninebot KickScooter E3 Pro' }).closest('li')!
    expect(row.className).toMatch(/(^|\s)grid-cols-\[1fr_auto\](\s|$)/)
    const nameCell = screen.getByRole('link', { name: 'Segway-Ninebot KickScooter E3 Pro' }).parentElement!
    expect(nameCell.querySelector('.lg\\:hidden.numeral')).toBeTruthy()
    const priceColumn = Array.from(row.children).find((c) => c !== nameCell && /numeral/.test(c.className) && /text-right/.test(c.className))!
    expect(priceColumn.className).toMatch(/hidden lg:block/)
  })
})
