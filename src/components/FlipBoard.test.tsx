// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { FlipBoard } from './FlipBoard'

afterEach(cleanup)

describe('FlipBoard', () => {
  it('shows each mover as a card with its readout', () => {
    render(<FlipBoard items={[{ label: 'Contour Face', delta: 310 }, { label: 'NotePin S', delta: 260 }]} />)
    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(items[0].className).toMatch(/bg-sheet/)
    expect(screen.getByLabelText('+310%')).toBeTruthy()
    expect(screen.getByLabelText('+310%').className).toMatch(/text-\[26px\]/)
  })
  it('uses three columns at lg and six from xl so labels and readouts fit at 1024', () => {
    render(<FlipBoard items={[{ label: 'LED masks', delta: 310 }]} />)
    const board = screen.getByRole('list')
    expect(board.className).toMatch(/lg:grid-cols-3/)
    expect(board.className).toMatch(/xl:grid-cols-6/)
  })
})
