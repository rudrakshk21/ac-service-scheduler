// The `.xlsx` package is loaded on demand so that it stays out of the first download. `read-excel-file/universal`
// works in a browser and in Node. It returns every sheet as `{ sheet, data }`, keeps date cells as `Date`, and
// reports an old `.xls` file or a non-spreadsheet through `InvalidInputError` codes, which are translated below.
import { t } from '../../i18n'
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

export const xlsMessage = (fileName: string): string => t('intake.file.xls', { file: fileName })

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
    if (code === 'NO_DATA') throw new IntakeError('empty_file', t('intake.file.empty', { file: fileName }))
    if (code === 'FILE_NOT_SUPPORTED' || code === 'INVALID_ZIP' || code === 'INPUT_TYPE_NOT_SUPPORTED') {
      throw new IntakeError('unsupported_format', t('intake.file.notExcel', { file: fileName }))
    }
    throw new IntakeError('unreadable', t('intake.file.excelUnreadable', { file: fileName }))
  }
  const sheets = all.map((s) => s.sheet)
  let chosen = all.find((s) => hasData(s.data))
  if (sheet !== undefined) {
    chosen = all.find((s) => s.sheet === sheet)
    if (chosen === undefined) {
      throw new IntakeError('unreadable', t('intake.file.noSheet', { file: fileName, sheet, sheets: sheets.join(', ') }))
    }
  }
  if (chosen === undefined) throw new IntakeError('empty_file', t('intake.file.noDataAnySheet', { file: fileName }))
  return { sheets, sheet: chosen.sheet, rows: chosen.data }
}
