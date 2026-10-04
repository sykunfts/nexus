// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { Fastest } from './Fastest'
import { Guides } from './Guides'
import { MOVERS } from './rails'
import { byId, productById, TREND_NOTE } from '../../lib/data'

afterEach(cleanup)

describe('home part 2', () => {
  it('the bento has exactly four product links, the first on the slab', () => {
    render(<Fastest />)
    expect(screen.getByRole('heading', { name: 'Moving fastest this week' })).toBeTruthy()
    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(4)
    expect(links[0].className).toMatch(/\bslab\b/)
    links.forEach((l, i) => expect(l.getAttribute('href')).toBe(`#/p/${MOVERS[i]}`))
    MOVERS.forEach((id) => expect(productById(id)).toBeTruthy())
  })
  it('the guides section has one headline and two guide rows, no card trio', () => {
    render(<Guides />)
    expect(screen.getByRole('heading', { name: 'How we choose what to list' })).toBeTruthy()
    expect(screen.getByRole('link', { name: /Does it work with my phone/ }).getAttribute('href')).toBe('#/guides/works-with-my-phone')
    expect(screen.getByRole('link', { name: /Movie night under \$2,000/ }).getAttribute('href')).toBe('#/guides/movie-night')
    expect(screen.getByRole('link', { name: 'Read how we pick' }).getAttribute('href')).toBe('#/how-we-pick')
  })
  it('cites where the trend figures come from', () => {
    render(<Fastest />)
    expect(screen.getByText(`Ranked by 7-day change in search and social interest. ${TREND_NOTE}`)).toBeTruthy()
  })
  it('the lead tile carries the whole tagline, clamped', () => {
    render(<Fastest />)
    expect(screen.getByText(byId(MOVERS[0]).tagline).className).toMatch(/line-clamp-2/)
  })
  it('long names truncate inside the small tiles and the wide tile image column can shrink', () => {
    const { container } = render(<Fastest />)
    const links = Array.from(container.querySelectorAll('a'))
    links.slice(1).forEach((a) => expect(a.querySelector('.truncate')!.parentElement!.className).toMatch(/\bmin-w-0\b/))
    expect(links[3].className).toMatch(/lg:grid-cols-\[1fr_minmax\(0,40%\)\]/)
  })
})
