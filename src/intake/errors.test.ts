import { describe, expect, it } from 'vitest'
import { IntakeError } from './errors'

describe('IntakeError', () => {
  it('is an Error with a code and a plain message', () => {
    const e = new IntakeError('empty_file', 'cases.csv has no rows')
    expect(e).toBeInstanceOf(Error)
    expect(e.code).toBe('empty_file')
    expect(e.name).toBe('IntakeError')
    expect(e.message).toBe('cases.csv has no rows')
  })
})
