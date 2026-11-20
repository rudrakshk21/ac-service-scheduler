import { describe, expect, it } from 'vitest'
import { IntakeError } from '../errors'
import { makeXlsx } from '../testing/xlsx'
import { parseDate } from './dates'
import { readXlsx } from './xlsx'

const day = new Date(Date.UTC(2026, 9, 13, 12))

describe('readXlsx', () => {
  it('reads text, numbers and dates, and keeps title lines for the table builder', async () => {
    const bytes = await makeXlsx([{ sheet: 'Data', rows: [['Report'], [null], ['Id', 'Qty', 'When'], ['A1', 5, day]] }])
    const x = await readXlsx(bytes, 'f.xlsx')
    expect(x.sheets).toEqual(['Data'])
    expect(x.sheet).toBe('Data')
    const row = x.rows[x.rows.length - 1]
    expect(row[0]).toBe('A1')
    expect(row[1]).toBe(5)
    expect(parseDate(row[2], null)).toBe('2026-10-13')
  })
  it('chooses the first sheet with data, or the requested one', async () => {
    const bytes = await makeXlsx([
      { sheet: 'First', rows: [['a'], ['1']] },
      { sheet: 'Second', rows: [['b'], ['2']] },
    ])
    expect((await readXlsx(bytes, 'f.xlsx')).sheet).toBe('First')
    const second = await readXlsx(bytes, 'f.xlsx', 'Second')
    expect(second.sheet).toBe('Second')
    expect(second.sheets).toEqual(['First', 'Second'])
    expect(second.rows[0]).toEqual(['b'])
  })
  it('names the available sheets when the requested one is missing', async () => {
    const bytes = await makeXlsx([{ sheet: 'First', rows: [['a'], ['1']] }])
    await expect(readXlsx(bytes, 'f.xlsx', 'Nope')).rejects.toThrow('has no sheet named "Nope". Its sheets are: First.')
  })
  it('tells the user how to convert an old .xls file', async () => {
    const ole = Uint8Array.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0, 0, 0])
    const err = await readXlsx(ole, 'old.xls').catch((e: unknown) => e)
    expect(err).toBeInstanceOf(IntakeError)
    expect((err as IntakeError).code).toBe('unsupported_format')
    expect((err as IntakeError).message).toBe('old.xls is an old Excel (.xls) file. Open it in Excel and save it as .xlsx or CSV, then import again.')
  })
  it('rejects bytes that are not a spreadsheet', async () => {
    const err = await readXlsx(new TextEncoder().encode('hello, this is not a zip file at all'), 'x.xlsx').catch((e: unknown) => e)
    expect(err).toBeInstanceOf(IntakeError)
    expect((err as IntakeError).code).toBe('unsupported_format')
  })
})
