// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { byId } from '../lib/data'
import { Callouts, callouts } from './Callouts'

describe('callouts', () => {
  it('reads height, width and weight from the MoGo specs', () => {
    expect(callouts(byId('xgimi-mogo-4-laser'))).toEqual(['207.6 mm', '96.5 mm', '1.32 kg'])
  })
  it('keeps the unit the row uses', () => {
    const p = { ...byId('chipolo-pop'), specs: [{ group: 'Body', rows: [{ label: 'Size', value: '12 × 8 in' }] }] }
    expect(callouts(p)).toEqual(['12 in', '8 in'])
  })
  it('renders nothing without a Size row', () => {
    const p = { ...byId('chipolo-pop'), specs: [] }
    expect(callouts(p)).toEqual([])
    const { container } = render(<Callouts product={p} />)
    expect(container.innerHTML).toBe('')
  })
  it('skips a Size row that is not a measurement and a weight that is not a plain figure', () => {
    const odd = { ...byId('chipolo-pop'), specs: [{ group: 'Fit', rows: [{ label: 'Size', value: '9 sizes, 5-13' }, { label: 'Weight', value: '2.4-3.6 g (varies with size)' }] }] }
    expect(callouts(odd)).toEqual([])
    const sized = { ...byId('chipolo-pop'), specs: [{ group: 'Body', rows: [{ label: 'Size', value: '38.8 × 6.6 mm' }, { label: 'Weight', value: '2.4-3.6 g (varies with size)' }] }] }
    expect(callouts(sized)).toEqual(['38.8 mm', '6.6 mm'])
  })
  it('can show the chips without the dimension lines', () => {
    const { container } = render(<Callouts product={byId('xgimi-mogo-4-laser')} lines={false} />)
    expect(container.textContent).toContain('207.6 mm')
    expect(container.querySelector('svg')).toBeNull()
  })
})
