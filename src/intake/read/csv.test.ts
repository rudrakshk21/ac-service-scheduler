import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { detectDelimiter, parseCsv, serializeCsv } from './csv'

describe('parseCsv', () => {
  it('reads rows and ignores a trailing newline', () => {
    expect(parseCsv('a,b\n1,2\n', ',')).toEqual([['a', 'b'], ['1', '2']])
    expect(parseCsv('a,b\n1,2', ',')).toEqual([['a', 'b'], ['1', '2']])
  })
  it('reads \\r\\n and \\r row ends', () => {
    expect(parseCsv('a,b\r\n1,2\r\n', ',')).toEqual([['a', 'b'], ['1', '2']])
    expect(parseCsv('a,b\r1,2\r', ',')).toEqual([['a', 'b'], ['1', '2']])
  })
  it('reads quoted cells, doubled quotes and line breaks inside cells', () => {
    expect(parseCsv('"a,b","c""d"\n', ',')).toEqual([['a,b', 'c"d']])
    expect(parseCsv('"line1\nline2",x\n', ',')).toEqual([['line1\nline2', 'x']])
  })
  it('keeps an empty line as a row with one empty cell', () => {
    expect(parseCsv('a\n\nb\n', ',')).toEqual([['a'], [''], ['b']])
  })
  it('keeps a quote inside an unquoted cell', () => {
    expect(parseCsv('ab"c,d\n', ',')).toEqual([['ab"c', 'd']])
  })
  it('reads empty cells and a trailing delimiter', () => {
    expect(parseCsv('a,,c,\n', ',')).toEqual([['a', '', 'c', '']])
  })
  it('returns no rows for empty text', () => {
    expect(parseCsv('', ',')).toEqual([])
  })
})

describe('serializeCsv', () => {
  it('quotes where needed and ends with a newline', () => {
    expect(serializeCsv([['a,b', 'c"d', 'e\nf', '']], ',')).toBe('"a,b","c""d","e\nf",\n')
  })
})

const alphabet = [',', ';', '"', '\n', '\r', ' ', '\t', '|', 'a', 'Z', '7', 'é', '日', "'"]
const cellArb = fc.string({ unit: fc.constantFrom(...alphabet), maxLength: 8 })

describe('CSV round trip', () => {
  it.each([',', ';', '\t', '|'])('reads back what it wrote with delimiter %j', (d) => {
    fc.assert(
      fc.property(fc.array(fc.array(cellArb, { minLength: 1, maxLength: 5 }), { minLength: 1, maxLength: 6 }), (rows) => {
        expect(parseCsv(serializeCsv(rows, d), d)).toEqual(rows)
      }),
      { numRuns: 200 },
    )
  })
})

describe('detectDelimiter', () => {
  const table = (d: string, n = 12) => ['id', 'name', 'area'].join(d) + '\n' + Array.from({ length: n }, (_, i) => [i, `n${i}`, 'x'].join(d)).join('\n') + '\n'
  it('finds comma, semicolon, tab and pipe', () => {
    for (const d of [',', ';', '\t', '|']) expect(detectDelimiter(table(d))).toEqual({ delimiter: d, confident: true })
  })
  it('finds the semicolon when cells hold decimal commas', () => {
    expect(detectDelimiter('id;x\n1;2,5\n2;3,5\n')).toEqual({ delimiter: ';', confident: true })
  })
  it('copes with a title line above a table', () => {
    expect(detectDelimiter('Monthly report\n' + table(',', 20))).toEqual({ delimiter: ',', confident: true })
  })
  it('is not confident for a single column', () => {
    expect(detectDelimiter('id\n1\n2\n')).toEqual({ delimiter: ',', confident: false })
  })
  it('is not confident when two delimiters fit equally well', () => {
    // Every row splits into exactly two cells with either the comma or the semicolon.
    expect(detectDelimiter('a,b;c\n1;2,3\n4,5;6\n7;8,9\n').confident).toBe(false)
  })
  it('uses only the start of a very large file', () => {
    const big = table(';', 20000)
    expect(detectDelimiter(big)).toEqual({ delimiter: ';', confident: true })
  })
})
