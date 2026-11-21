import { describe, expect, it } from 'vitest'
import { IntakeError } from '../errors'
import { makeXlsx } from '../testing/xlsx'
import { MAX_FILE_BYTES, MAX_ROWS, readSource } from './index'

const utf8 = (s: string) => new TextEncoder().encode(s)
const latin1 = (s: string) => Uint8Array.from([...s].map((c) => c.charCodeAt(0)))
function utf16le(s: string): Uint8Array {
  const out = [0xff, 0xfe]
  for (const ch of s) out.push(ch.charCodeAt(0) & 255, ch.charCodeAt(0) >> 8)
  return Uint8Array.from(out)
}

const HEADERS = ['Id', 'Area']
const ROWS = [['1', 'A'], ['2', 'B']]

const csvWithRows = (n: number): Uint8Array => utf8('Id,Area\n' + Array.from({ length: n }, (_, i) => `${i + 1},A`).join('\n') + '\n')

describe('the limits on a file (SEC-4: 20 MB and 50,000 rows)', () => {
  it('reads a file of exactly the largest number of rows', async () => {
    const t = await readSource(csvWithRows(MAX_ROWS), 'big.csv')
    expect(t.rows).toHaveLength(MAX_ROWS)
  })
  it('refuses a CSV with one row more, saying how many and what to do', async () => {
    const error = await readSource(csvWithRows(MAX_ROWS + 1), 'big.csv').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(IntakeError)
    expect((error as IntakeError).code).toBe('too_many_rows')
    expect((error as IntakeError).message).toMatch(/big\.csv/)
    expect((error as IntakeError).message).toMatch(/50,000/)
  })
  it('refuses a JSON file and a spreadsheet with too many rows', async () => {
    const json = utf8(JSON.stringify(Array.from({ length: MAX_ROWS + 1 }, (_, i) => ({ id: i }))))
    await expect(readSource(json, 'big.json')).rejects.toMatchObject({ code: 'too_many_rows' })
    const sheet = await makeXlsx([{ sheet: 'Cases', rows: [['Id', 'Area'], ...Array.from({ length: MAX_ROWS + 1 }, (_, i) => [String(i), 'A'])] }])
    await expect(readSource(sheet, 'big.xlsx')).rejects.toMatchObject({ code: 'too_many_rows' })
  }, 60_000)
  it('refuses a file larger than 20 MB before reading it, naming its size', async () => {
    const bytes = new Uint8Array(MAX_FILE_BYTES + 1).fill(0x41)
    const error = await readSource(bytes, 'huge.csv').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(IntakeError)
    expect((error as IntakeError).code).toBe('file_too_large')
    expect((error as IntakeError).message).toMatch(/huge\.csv/)
    expect((error as IntakeError).message).toMatch(/20 MB/)
  })
  it('accepts a file of exactly 20 MB in size', async () => {
    const bytes = new Uint8Array(MAX_FILE_BYTES).fill(0x41)
    await expect(readSource(bytes, 'edge.csv')).rejects.not.toMatchObject({ code: 'file_too_large' })
  })
})

describe('readSource', () => {
  it('reads UTF-8 CSV with a byte-order mark and a title line', async () => {
    const t = await readSource(Uint8Array.from([0xef, 0xbb, 0xbf, ...utf8('Report\n\nId,Area\n1,A\n2,B\n')]), 'cases.csv')
    expect(t.format).toBe('csv')
    expect(t.headers).toEqual(HEADERS)
    expect(t.rows).toEqual(ROWS)
    expect(t.detected).toMatchObject({ encoding: 'utf-8', encodingConfident: true, delimiter: ',', skippedTitleRows: 2 })
  })
  it('reads a semicolon file in Windows-1252, marked not confident until the user chooses the encoding', async () => {
    const bytes = latin1('Id;Ort\n1;Köln\n2;München\n')
    const guess = await readSource(bytes, 'f.csv')
    expect(guess.headers).toEqual(['Id', 'Ort'])
    expect(guess.rows).toEqual([['1', 'Köln'], ['2', 'München']])
    expect(guess.detected).toMatchObject({ encoding: 'windows-1252', encodingConfident: false, delimiter: ';' })
    const chosen = await readSource(bytes, 'f.csv', { encoding: 'windows-1252' })
    expect(chosen.detected.encodingConfident).toBe(true)
  })
  it('reads a UTF-16 tab file', async () => {
    const t = await readSource(utf16le('Id\tArea\n1\tA\n2\tB\n'), 'f.txt')
    expect(t.headers).toEqual(HEADERS)
    expect(t.rows).toEqual(ROWS)
    expect(t.detected).toMatchObject({ encoding: 'utf-16le', delimiter: '\t' })
  })
  it('reads JSON', async () => {
    const t = await readSource(utf8('{"tickets":[{"Id":"1","Area":"A"},{"Id":"2","Area":"B"}]}'), 'f.json')
    expect(t.format).toBe('json')
    expect(t.headers).toEqual(HEADERS)
    expect(t.rows).toEqual(ROWS)
    expect(t.detected.delimiter).toBeNull()
  })
  it('reads JSON even when the file has no .json extension', async () => {
    const t = await readSource(utf8('[{"Id":"1","Area":"A"}]'), 'export.txt')
    expect(t.format).toBe('json')
  })
  it('reads .xlsx, with the sheet list and a user-chosen sheet', async () => {
    const bytes = await makeXlsx([
      { sheet: 'Cover', rows: [['Only a title']] },
      { sheet: 'Data', rows: [['Id', 'Area'], ['1', 'A'], ['2', 'B']] },
    ])
    const chosen = await readSource(bytes, 'f.xlsx', { sheet: 'Data' })
    expect(chosen.format).toBe('xlsx')
    expect(chosen.sheets).toEqual(['Cover', 'Data'])
    expect(chosen.sheet).toBe('Data')
    expect(chosen.headers).toEqual(HEADERS)
    expect(chosen.rows).toEqual(ROWS)
  })
  it('lets the user choose the delimiter and the header row', async () => {
    const t = await readSource(utf8('x|y\nId|Area\n1|A\n'), 'f.csv', { delimiter: '|', headerRow: 1 })
    expect(t.headers).toEqual(HEADERS)
    expect(t.detected.delimiterConfident).toBe(true)
  })
  it('rejects what is not a table, with plain reasons', async () => {
    const notTable = await readSource(utf8('just some words'), 'notes.txt').catch((e: unknown) => e)
    expect(notTable).toBeInstanceOf(IntakeError)
    expect((notTable as IntakeError).code).toBe('not_a_data_file')
    expect((notTable as IntakeError).message).toContain('notes.txt')
    const empty = await readSource(new Uint8Array(0), 'e.csv').catch((e: unknown) => e)
    expect((empty as IntakeError).code).toBe('empty_file')
    const ole = await readSource(Uint8Array.from([0xd0, 0xcf, 0x11, 0xe0, 1, 2, 3, 4]), 'old.xls').catch((e: unknown) => e)
    expect((ole as IntakeError).message).toContain('save it as .xlsx or CSV')
  })
})
