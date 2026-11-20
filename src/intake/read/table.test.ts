import { describe, expect, it } from 'vitest'
import { IntakeError } from '../errors'
import { buildTable, findHeaderRow, type Cell, type TableMeta } from './table'

const meta: TableMeta = {
  format: 'csv', fileName: 'cases.csv', sheets: [], sheet: '', encoding: 'utf-8', encodingConfident: true,
  delimiter: ',', delimiterConfident: true,
}

describe('findHeaderRow', () => {
  it('skips title lines and blank rows above the table', () => {
    const rows: Cell[][] = [['Report title'], [''], ['Id', 'Area', 'Date'], ['1', 'A', '2026-01-01']]
    expect(findHeaderRow(rows)).toBe(2)
  })
  it('prefers a row of text over a row of numbers', () => {
    const rows: Cell[][] = [[1, 2, 3], ['Id', 'Area', 'Date'], [1, 'A', 'x']]
    expect(findHeaderRow(rows)).toBe(1)
  })
  it('falls back to the first wide row when no row is all text', () => {
    expect(findHeaderRow([[1, 2], [3, 4]])).toBe(0)
  })
  it('returns 0 for nothing but empty rows', () => {
    expect(findHeaderRow([[null], ['']])).toBe(0)
  })
})

describe('buildTable', () => {
  it('finds the header and counts the skipped title rows', () => {
    const t = buildTable([['Report title'], [''], ['Id', 'Area', 'Date'], ['1', 'A', '2026-01-01']], meta)
    expect(t.headerRow).toBe(2)
    expect(t.detected.skippedTitleRows).toBe(2)
    expect(t.headers).toEqual(['Id', 'Area', 'Date'])
    expect(t.rows).toEqual([['1', 'A', '2026-01-01']])
  })
  it('lets the user choose the header row', () => {
    const t = buildTable([['a', 'b'], ['Id', 'Area'], ['1', 'A']], meta, { headerRow: 1 })
    expect(t.headers).toEqual(['Id', 'Area'])
  })
  it('trims headers, names empty ones and numbers duplicates', () => {
    const t = buildTable([[' Id ', 'Area', 'Area', ''], ['1', 'a', 'b', 'c']], meta)
    expect(t.headers).toEqual(['Id', 'Area', 'Area (2)', 'Column 4'])
  })
  it('drops blank rows and counts them', () => {
    const t = buildTable([['Id', 'Area'], ['1', 'A'], ['', '  '], [null, null], ['2', 'B']], meta)
    expect(t.rows.length).toBe(2)
    expect(t.detected.blankRows).toBe(2)
  })
  it('pads short rows and trims long ones, counting them as ragged', () => {
    const t = buildTable([['Id', 'Area'], ['1'], ['2', 'B', 'extra'], ['3', 'C', '']], meta)
    expect(t.rows).toEqual([['1', null], ['2', 'B'], ['3', 'C']])
    expect(t.detected.raggedRows).toBe(2)
  })
  it('trims text cells and turns empty text into null; keeps numbers and dates', () => {
    const d = new Date(Date.UTC(2026, 9, 13))
    const t = buildTable([['a', 'b', 'c', 'd'], ['  x ', '', 5, d]], meta)
    expect(t.rows[0]).toEqual(['x', null, 5, d])
  })
  it('refuses a file with no data rows or nothing at all', () => {
    expect(() => buildTable([['Id', 'Area']], meta)).toThrow(IntakeError)
    expect(() => buildTable([['Id', 'Area']], meta)).toThrow('cases.csv')
    expect(() => buildTable([[null], ['']], meta)).toThrow('every cell is empty')
  })
  it('carries the detected format through', () => {
    const t = buildTable([['a', 'b'], ['1', '2']], { ...meta, encodingConfident: false, delimiter: ';', delimiterConfident: false })
    expect(t.detected).toMatchObject({ encoding: 'utf-8', encodingConfident: false, delimiter: ';', delimiterConfident: false })
  })
})
