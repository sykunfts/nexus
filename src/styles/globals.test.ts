import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync(new URL('./globals.css', import.meta.url), 'utf8')

describe('globals.css', () => {
  it('clips sideways overflow without making the page a scroll container, so sticky header and plate work', () => {
    const rule = css.match(/html,\s*body\s*\{[^}]*\}/)![0]
    expect(rule).toMatch(/overflow-x:\s*clip/)
  })
})
