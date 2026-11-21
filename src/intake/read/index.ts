import { formatNumber, t } from '../../i18n'
import { IntakeError } from '../errors'
import { detectDelimiter, parseCsv } from './csv'
import { decodeBytes } from './encoding'
import { jsonToRows } from './json'
import { buildTable, type ReadOptions, type SourceTable } from './table'
import { isOleFile, readXlsx, xlsMessage } from './xlsx'

export type { Cell, ReadOptions, SourceTable } from './table'

const isZip = (b: Uint8Array): boolean => b.length >= 2 && b[0] === 0x50 && b[1] === 0x4b

/** SEC-4: a file is untrusted input, so what the app will read from one file is limited. */
export const MAX_FILE_BYTES = 20 * 1024 * 1024
export const MAX_ROWS = 50_000

/** Whether a file of this many bytes is over the limit. */
export const isTooLarge = (bytes: number): boolean => bytes > MAX_FILE_BYTES

/** The refusal of a file over `MAX_FILE_BYTES`. Used by `readSource`, and by the screen before it reads the file into memory. */
export function fileTooLarge(fileName: string, bytes: number): IntakeError {
  const size = formatNumber(bytes / (1024 * 1024), { maximumFractionDigits: 1 })
  return new IntakeError('file_too_large', t('intake.file.tooLarge', { file: fileName, size, limit: formatNumber(MAX_FILE_BYTES / (1024 * 1024)) }))
}

/** Refuses a table with more data rows than `MAX_ROWS` (the first row is the header) before anything is built from it. */
function limitRows(rows: unknown[], fileName: string): void {
  const count = rows.length - 1
  if (count > MAX_ROWS) {
    throw new IntakeError('too_many_rows', t('intake.file.tooManyRows', { file: fileName, count: formatNumber(count), limit: formatNumber(MAX_ROWS) }))
  }
}

/**
 * Reads a CSV, Excel (.xlsx) or JSON file into a table. The format comes from the file's first bytes and name.
 * Throws an `IntakeError` with a plain message when the file cannot be used: empty, over 20 MB, over 50,000 rows, or
 * not a table.
 */
export async function readSource(bytes: Uint8Array, fileName: string, options: ReadOptions = {}): Promise<SourceTable> {
  if (bytes.length === 0) throw new IntakeError('empty_file', t('intake.file.empty', { file: fileName }))
  if (isTooLarge(bytes.length)) throw fileTooLarge(fileName, bytes.length)
  const lower = fileName.toLowerCase()
  if (isOleFile(bytes)) throw new IntakeError('unsupported_format', xlsMessage(fileName))

  if (isZip(bytes) || lower.endsWith('.xlsx')) {
    const x = await readXlsx(bytes, fileName, options.sheet)
    limitRows(x.rows, fileName)
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
    const records = jsonToRows(decoded.text, fileName)
    limitRows(records, fileName)
    return buildTable(
      records,
      {
        format: 'json', fileName, sheets: [], sheet: '', encoding: decoded.encoding, encodingConfident: decoded.confident,
        delimiter: null, delimiterConfident: true,
      },
      options,
    )
  }

  const found = options.delimiter === undefined ? detectDelimiter(decoded.text) : { delimiter: options.delimiter, confident: true }
  const rows = parseCsv(decoded.text, found.delimiter)
  limitRows(rows, fileName)
  if (options.delimiter === undefined && rows.every((r) => r.length <= 1) && !found.confident) {
    throw new IntakeError('not_a_data_file', t('intake.file.notTable', { file: fileName }))
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
