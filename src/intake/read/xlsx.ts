// The `.xlsx` package is loaded on demand so that it stays out of the first download. `read-excel-file/universal`
// works in a browser and in Node. It returns every sheet as `{ sheet, data }`, keeps date cells as `Date`, and
// reports an old `.xls` file or a non-spreadsheet through `InvalidInputError` codes, which are translated below.
import { IntakeError } from '../errors'
import type { Cell } from './table'

export interface XlsxData {
  sheets: string[]
  sheet: string
  rows: Cell[][]
}

/** The signature of the old binary Excel format (OLE2). */
export function isOleFile(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0
}

export const xlsMessage = (fileName: string): string =>
  `${fileName} is an old Excel (.xls) file. Open it in Excel and save it as .xlsx or CSV, then import again.`

const hasData = (rows: Cell[][]): boolean =>
  rows.some((r) => r.some((c) => c !== null && !(typeof c === 'string' && c.trim() === '')))

/** Reads the sheets of an `.xlsx` file; the chosen sheet is the requested one, or the first with data. */
export async function readXlsx(bytes: Uint8Array, fileName: string, sheet?: string): Promise<XlsxData> {
  if (isOleFile(bytes)) throw new IntakeError('unsupported_format', xlsMessage(fileName))
  const { default: readSheets } = await import('read-excel-file/universal')
  let all: { sheet: string; data: Cell[][] }[]
  try {
    all = (await readSheets(bytes)) as { sheet: string; data: Cell[][] }[]
  } catch (e) {
    const code = (e as { code?: string }).code
    if (code === 'XLS_FILE_NOT_SUPPORTED') throw new IntakeError('unsupported_format', xlsMessage(fileName))
    if (code === 'NO_DATA') throw new IntakeError('empty_file', `${fileName} is empty.`)
    if (code === 'FILE_NOT_SUPPORTED' || code === 'INVALID_ZIP' || code === 'INPUT_TYPE_NOT_SUPPORTED') {
      throw new IntakeError('unsupported_format', `${fileName} is not an Excel (.xlsx) file.`)
    }
    throw new IntakeError('unreadable', `${fileName} could not be read as an Excel (.xlsx) file; it may be damaged.`)
  }
  const sheets = all.map((s) => s.sheet)
  let chosen = all.find((s) => hasData(s.data))
  if (sheet !== undefined) {
    chosen = all.find((s) => s.sheet === sheet)
    if (chosen === undefined) {
      throw new IntakeError('unreadable', `${fileName} has no sheet named "${sheet}". Its sheets are: ${sheets.join(', ')}.`)
    }
  }
  if (chosen === undefined) throw new IntakeError('empty_file', `${fileName} has no data on any sheet.`)
  return { sheets, sheet: chosen.sheet, rows: chosen.data }
}
