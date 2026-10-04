// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { Header } from './Header'
import { ProductCard } from './ProductCard'
import { byId } from '../lib/data'

afterEach(cleanup)

/* Spec 11: header controls and Add buttons at least 44px on phones. */
describe('touch targets', () => {
  it('header controls are 44px below lg', () => {
    const { container } = render(<Header />)
    for (const el of [screen.getByRole('button', { name: 'Open menu' }), screen.getByRole('button', { name: 'Search' }), screen.getByRole('button', { name: /^Cart,/ }), container.querySelector('button[aria-haspopup="listbox"]')!]) {
      expect(el.className).toMatch(/\bh-11\b/)
    }
    expect(screen.getByRole('button', { name: 'Open menu' }).className).toMatch(/\bw-11\b/)
  })
  it('a product card Add button is 44px below lg', () => {
    const p = byId('anker-prime-100w')
    render(<ProductCard product={p} />)
    expect(screen.getByRole('button', { name: `Add ${p.name} to cart` }).className).toMatch(/\bh-11\b/)
  })
})
