import { describe, expect, it } from 'vitest'
import type { NoveltyItem } from '../src/types'
import { filterNovelty, isBlocked } from '../src/novelty'

const titles = ['McLaren McL 6GT', 'PlayStation LEGO Kit', 'Outrageously Flavored Sodas', 'Handforged Tools And Weapons', 'Driftwood Dragon Statue', 'Cannabis Infused Wine', 'Cursed Kirby Fleshlight', 'Scarf Hidden Flask', 'Spiral Blade Knife', 'Sand Drawing Light Table', 'Difficult Riddles For Smart Kids', 'Diamond Octopus Tentacles Ring', 'Lilium Personal Jet Aircraft', 'License Plate Flipper']
const item = (title: string, termId: string | null = null): NoveltyItem => ({ title, link: `https://x/${title}`, date: '2026-09-30', termId })

describe('novelty filter', () => {
  it('hides the five junk titles and keeps the other nine', () => {
    const out = filterNovelty(titles.map((t) => item(t)))
    expect(out.hidden).toBe(5)
    expect(out.items.map((i) => i.title)).toEqual(titles.filter((t) => !['Handforged Tools And Weapons', 'Cannabis Infused Wine', 'Cursed Kirby Fleshlight', 'Scarf Hidden Flask', 'Spiral Blade Knife'].includes(t)))
  })

  it('does not hide a blocked word inside a longer word', () => {
    for (const t of ['Gunmetal Grey Speaker', 'Sussex Tea Set', 'Winery Tour Map']) expect(isBlocked(t), t).toBe(false)
  })

  it('puts items matched to a term first, otherwise keeps feed order', () => {
    const out = filterNovelty([item('A'), item('B', 'smart-ring'), item('C'), item('D', 'keyboard')])
    expect(out.items.map((i) => i.title)).toEqual(['B', 'D', 'A', 'C'])
  })
})
