// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

afterEach(() => { cleanup(); vi.doUnmock('framer-motion') })

describe('Reveal', () => {
  it('animates by default', async () => {
    const { Reveal } = await import('./ui')
    render(<Reveal>hi</Reveal>)
    expect(screen.getByText('hi').getAttribute('data-motion')).toBe('reveal')
  })
  it('renders at rest under reduced motion', async () => {
    vi.doMock('framer-motion', async (orig) => ({ ...(await orig<typeof import('framer-motion')>()), useReducedMotion: () => true }))
    vi.resetModules()
    const { Reveal } = await import('./ui')
    render(<Reveal as="section">hi</Reveal>)
    const el = screen.getByText('hi')
    expect(el.tagName).toBe('SECTION')
    expect(el.getAttribute('data-motion')).toBe('none')
    expect(el.getAttribute('style')).toBeNull()
  })
})

describe('Button', () => {
  it('lg is 56px tall with 17px text', async () => {
    const { Button } = await import('./ui')
    render(<Button size="lg">Go</Button>)
    expect(screen.getByRole('button').className).toMatch(/\bh-14\b/)
    expect(screen.getByRole('button').className).toMatch(/text-\[17px\]/)
  })
})
