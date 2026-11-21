import { describe, expect, it } from 'vitest'
import { neutralise, toCsv } from './csv'

describe('neutralise (SEC-5)', () => {
  it('puts an apostrophe before text that a spreadsheet would run as a formula', () => {
    expect(neutralise("=cmd|' /C calc'!A0")).toBe("'=cmd|' /C calc'!A0")
    expect(neutralise('+1+1')).toBe("'+1+1")
    expect(neutralise('-1')).toBe("'-1")
    expect(neutralise('@SUM(1)')).toBe("'@SUM(1)")
    expect(neutralise('\tbad')).toBe("'\tbad")
    expect(neutralise('\rbad')).toBe("'\rbad")
    expect(neutralise('-')).toBe("'-")
  })
  it('leaves other text and every number alone', () => {
    expect(neutralise('North')).toBe('North')
    expect(neutralise('a=b')).toBe('a=b')
    expect(neutralise('')).toBe('')
    expect(neutralise(-5)).toBe(-5)
    expect(neutralise(12.5)).toBe(12.5)
  })
})

describe('toCsv', () => {
  const table = (rows: (string | number)[][]) => ({ id: 'schedule' as const, name: 't', headers: ['A', 'B'], rows })

  it('starts with a byte-order mark so Excel reads it as UTF-8, and ends each line with CRLF', () => {
    const text = toCsv(table([['x', 1]]))
    expect(text.charCodeAt(0)).toBe(0xfeff)
    expect(text.slice(1)).toBe('A,B\r\nx,1\r\n')
  })
  it('gives only the header line for a table without rows', () => {
    expect(toCsv(table([])).slice(1)).toBe('A,B\r\n')
  })
  it('quotes a cell that holds a comma, a quote or a line break, and doubles the quotes', () => {
    expect(toCsv(table([['a,b', 'say "hi"'], ['line\nbreak', 'cr\rreturn']])).slice(1)).toBe('A,B\r\n"a,b","say ""hi"""\r\n"line\nbreak","cr\rreturn"\r\n')
  })
  it('quotes a cell with a space at either end so it survives', () => {
    expect(toCsv(table([[' a', 'b ']])).slice(1)).toBe('A,B\r\n" a","b "\r\n')
  })
  it('neutralises formulas in text cells and in the header, never in numbers', () => {
    const text = toCsv({ id: 'schedule', name: 't', headers: ['=A', 'B'], rows: [['=1+1', -3], ['@x', 2]] }).slice(1)
    expect(text).toBe("'=A,B\r\n'=1+1,-3\r\n'@x,2\r\n")
  })
  it('writes numbers plainly, with a point for decimals', () => {
    expect(toCsv(table([[1.5, 0]])).slice(1)).toBe('A,B\r\n1.5,0\r\n')
  })
})
