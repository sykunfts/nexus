// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { byId } from '../lib/data'

vi.mock('./ProductCanvas', () => ({ ProductCanvas: () => null, PARTS: [] }))
window.scrollTo = () => {}

afterEach(cleanup)

describe('product page v3', () => {
  it('shows the bench tiles, the RRP and the CTA pair for the MoGo', async () => {
    const { ProductPage } = await import('./ProductPage')
    render(<ProductPage product={byId('xgimi-mogo-4-laser')} />)
    expect(screen.getByRole('heading', { level: 1 }).className).toMatch(/text-\[64px\]/)
    expect(screen.getByRole('heading', { name: 'Claimed, then measured' })).toBeTruthy()
    expect(screen.getByText('370 to 390 ANSI lm')).toBeTruthy()
    expect(screen.getByText('Claimed 550 ISO lm')).toBeTruthy()
    expect(screen.getByText('Not claimed')).toBeTruthy()
    const short = screen.getAllByText('Short of the claim')
    expect(short.filter((el) => !el.closest('details'))).toHaveLength(2)   // brightness and standard-mode battery tiles
    expect(short.filter((el) => el.closest('details'))).toHaveLength(1)    // fan noise, behind the disclosure
    expect(screen.getAllByRole('link', { name: 'Measured by laurentwillen.com' })[0].getAttribute('href')).toMatch(/laurentwillen/)
    expect(screen.getByText(/^RRP /)).toBeTruthy()
    const buy = screen.getByRole('button', { name: 'Buy now' })
    expect(buy.parentElement!.querySelector('button')!.textContent).toMatch(/Add to cart/)
    expect(screen.getByText('207.6 mm')).toBeTruthy()
  })
  it('keeps the remaining measurements behind the disclosure', async () => {
    const { ProductPage } = await import('./ProductPage')
    render(<ProductPage product={byId('xgimi-mogo-4-laser')} />)
    const summary = screen.getByText('All 6 measurements')
    expect(summary.tagName).toBe('SUMMARY')
    expect(screen.getByText('Boot to home screen').closest('details')).toBe(summary.closest('details'))
    expect(screen.getByText('Brightness, standard mode').closest('details')).toBeNull()
  })
  it('a product with no bench rows and no RRP shows neither', async () => {
    const { ProductPage } = await import('./ProductPage')
    const p = { ...byId('chipolo-pop'), compareAt: undefined }
    render(<ProductPage product={p} />)
    expect(screen.queryByText('Claimed, then measured')).toBeNull()
    expect(screen.queryByText(/RRP/)).toBeNull()
  })
})
