import { IntakeError } from '../errors'
import { detectDelimiter, parseCsv } from './csv'
import { decodeBytes } from './encoding'
import { jsonToRows } from './json'
import { buildTable, type ReadOptions, type SourceTable } from './table'
import { isOleFile, readXlsx, xlsMessage } from './xlsx'

export type { Cell, ReadOptions, SourceTable } from './table'

const isZip = (b: Uint8Array): boolean => b.length >= 2 && b[0] === 0x50 && b[1] === 0x4b

/**
 * Reads a CSV, Excel (.xlsx) or JSON file into a table. The format comes from the file's first bytes and name.
 * Throws an `IntakeError` with a plain message when the file cannot be used.
 */
export async function readSource(bytes: Uint8Array, fileName: string, options: ReadOptions = {}): Promise<SourceTable> {
  if (bytes.length === 0) throw new IntakeError('empty_file', `${fileName} is empty.`)
  const lower = fileName.toLowerCase()
  if (isOleFile(bytes)) throw new IntakeError('unsupported_format', xlsMessage(fileName))

  if (isZip(bytes) || lower.endsWith('.xlsx')) {
    const x = await readXlsx(bytes, fileName, options.sheet)
    return buildTable(
      x.rows,
      {
        format: 'xlsx', fileName, sheets: x.sheets, sheet: x.sheet, encoding: 'xlsx', encodingConfident: true,
        delimiter: null, delimiterConfident: true,
      },
      options,
    )
  }

  const decoded = decodeBytes(bytes, options.encoding)
  const first = decoded.text.trimStart()[0]
  if (lower.endsWith('.json') || first === '[' || first === '{') {
    return buildTable(
      jsonToRows(decoded.text, fileName),
      {
        format: 'json', fileName, sheets: [], sheet: '', encoding: decoded.encoding, encodingConfident: decoded.confident,
        delimiter: null, delimiterConfident: true,
      },
      options,
    )
  }

  const found = options.delimiter === undefined ? detectDelimiter(decoded.text) : { delimiter: options.delimiter, confident: true }
  const rows = parseCsv(decoded.text, found.delimiter)
  if (options.delimiter === undefined && rows.every((r) => r.length <= 1) && !found.confident) {
    throw new IntakeError(
      'not_a_data_file',
      `${fileName} does not look like a table: no comma, semicolon, tab or | separates columns. ` +
        'If it has a single column, choose the delimiter yourself.',
    )
  }
  return buildTable(
    rows,
    {
      format: 'csv', fileName, sheets: [], sheet: '', encoding: decoded.encoding, encodingConfident: decoded.confident,
      delimiter: found.delimiter, delimiterConfident: found.confident,
    },
    options,
  )
}
