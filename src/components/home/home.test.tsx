// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { Home } from '../Home'

afterEach(cleanup)

describe('Home', () => {
  it('renders the seven v3 sections in order and nothing from v2', () => {
    render(<Home />)
    const names = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    expect(names).toEqual(['Movers this week', 'Moving fastest this week', 'Works with your iPhone and Apple Home', 'On the shelf in Sydney', 'How we choose what to list'])
    expect(screen.getByRole('region', { name: 'How Nexus ships' })).toBeTruthy()
    expect(screen.queryByText('Independent tests')).toBeNull()
    expect(screen.queryByText(/real products\. Prices are AUD/)).toBeNull()
    expect(screen.getAllByRole('link').filter((l) => l.getAttribute('href')?.startsWith('#/p/')).length).toBeGreaterThanOrEqual(5)
  })
  it('has no em or en dash anywhere in its text', () => {
    const { container } = render(<Home />)
    expect(container.textContent).not.toMatch(/[–—]/)
  })
})
