import { describe, expect, it } from 'vitest'
import { formatClock, pyInt, pyMod, pyRound } from './pymath'

describe('pyRound (Python round: halves go to the even integer)', () => {
  it.each([
    [0.5, 0], [1.5, 2], [2.5, 2], [3.5, 4], [-0.5, 0], [-1.5, -2], [-2.5, -2],
    [0.49, 0], [0.51, 1], [2.4999, 2], [-0.4, 0], [7, 7], [540.5, 540], [541.5, 542], [599.5, 600],
  ])('pyRound(%f) = %i', (x, want) => {
    expect(pyRound(x)).toBe(want)
  })
})

describe('pyInt (Python int: truncate toward zero)', () => {
  it.each([[2.9, 2], [-2.9, -2], [0.2, 0], [-0.2, 0], [5, 5]])('pyInt(%f) = %i', (x, want) => {
    expect(pyInt(x)).toBe(want)
  })
})

describe('pyMod (Python %: never negative)', () => {
  it.each([[7, 7, 0], [8, 7, 1], [-1, 7, 6], [-8, 7, 6], [0, 24, 0]])('pyMod(%i, %i) = %i', (a, n, want) => {
    expect(pyMod(a, n)).toBe(want)
  })
})

describe('formatClock (Python hm)', () => {
  it.each([
    [540, '09:00'], [540.5, '09:00'], [541.5, '09:02'], [545, '09:05'], [780, '13:00'],
    [599.5, '10:00'], [1440, '00:00'], [1500, '01:00'], [5, '00:05'],
  ])('formatClock(%f) = %s', (minutes, want) => {
    expect(formatClock(minutes)).toBe(want)
  })
})
