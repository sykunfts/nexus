// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { Hero } from './Hero'
import { Facts } from './Facts'
import { Movers } from './Movers'
import { useStore } from '../../lib/store'
import { etaText } from '../../lib/shipping'
import { byId, products } from '../../lib/data'

afterEach(cleanup)

describe('home part 1', () => {
  it('the hero names the product of the week and links its figure to the product', () => {
    render(<Hero />)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/The new thing/)
    const figure = screen.getByRole('link', { name: 'Open the XGIMI MoGo 4 Laser' })
    expect(figure.getAttribute('href')).toBe('#/p/xgimi-mogo-4-laser')
    expect(screen.getByText('207.6 mm')).toBeTruthy()
    expect(screen.getByText(`+${byId('xgimi-mogo-4-laser').trend.delta}% this week`)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'See the MoGo 4 Laser' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Ask the Trend Scout' })).toBeTruthy()
    expect(screen.queryByText('Configure')).toBeNull()
    expect(screen.queryByText('Independent tests')).toBeNull()
  })
  it('the hero subtext stays under 20 words', () => {
    render(<Hero />)
    const sub = screen.getByText(/^Trending tech, checked against the maker/)
    expect(sub.textContent!.trim().split(/\s+/).length).toBeLessThanOrEqual(20)
  })
  it('the facts follow the setup region and count the catalogue', async () => {
    render(<Facts />)
    await act(async () => { useStore.getState().setRegion('UK') })
    expect(screen.getByText(etaText('AU', 'UK'))).toBeTruthy()
    expect(screen.getByText(etaText('CN', 'UK'))).toBeTruthy()
    expect(screen.getByText(`${products.length} products`)).toBeTruthy()
    expect(screen.getByText('30 days')).toBeTruthy()
  })
  it('the movers board shows six readouts', () => {
    render(<Movers />)
    expect(screen.getByRole('heading', { name: 'Movers this week' })).toBeTruthy()
    expect(screen.getAllByRole('listitem')).toHaveLength(6)
  })
  it('keeps each fact value on one line', () => {
    const { container } = render(<Facts />)
    const values = Array.from(container.querySelectorAll('dt'))
    expect(values).toHaveLength(4)
    values.forEach((dt) => expect(dt.className).toMatch(/whitespace-nowrap/))
  })
  it('the movers note meets AA contrast on its band (ink-2, not ink-3)', () => {
    render(<Movers />)
    expect(screen.getByText(/7-day change in interest/).className).toMatch(/text-ink-2/)
  })
})
