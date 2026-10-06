import { describe, expect, it } from 'vitest'

import { eloAfter, scoreFor } from './sparring-rating'

describe('scoreFor', () => {
  it('reads the result from the side the user played', () => {
    expect(scoreFor('1-0', 'white')).toBe(1)
    expect(scoreFor('1-0', 'black')).toBe(0)
    expect(scoreFor('0-1', 'black')).toBe(1)
    expect(scoreFor('1/2-1/2', 'white')).toBe(0.5)
    expect(scoreFor('*', 'white')).toBeUndefined()
  })
})

describe('eloAfter', () => {
  it('gains 16 for beating an equal opponent and loses 16 for losing to one', () => {
    expect(eloAfter(1200, 1200, 1)).toBe(1216)
    expect(eloAfter(1200, 1200, 0)).toBe(1184)
    expect(eloAfter(1200, 1200, 0.5)).toBe(1200)
  })

  it('rewards an upset more than an expected win', () => {
    expect(eloAfter(1200, 1600, 1) - 1200).toBeGreaterThan(eloAfter(1600, 1200, 1) - 1600)
  })

  it('never leaves the rating range', () => {
    expect(eloAfter(100, 3000, 0)).toBe(100)
    expect(eloAfter(3500, 100, 1)).toBe(3500)
  })
})
