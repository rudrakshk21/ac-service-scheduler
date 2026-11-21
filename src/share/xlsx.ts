import { neutralise } from './csv'
import type { Table } from './tables'

const WIDEST = 60

/** Column width in characters: the longest text in the column, a little extra, never more than `WIDEST`. */
function widthOf(table: Table, column: number): number {
  const longest = Math.max(table.headers[column].length, ...table.rows.map((r) => String(r[column] ?? '').length))
  return Math.min(WIDEST, longest + 2)
}

/**
 * An Excel file with one sheet per table: bold header row that stays in view, column widths that fit, formulas
 * neutralised (SEC-5). The writer is loaded only when this runs, so it stays out of the first download.
 */
export async function toXlsx(tables: Table[]): Promise<Blob> {
  const { default: writeExcelFile } = await import('write-excel-file/universal')
  const sheets = tables.map((table) => ({
    sheet: table.name,
    data: [
      table.headers.map((h) => ({ value: String(neutralise(h)), fontWeight: 'bold' as const })),
      ...table.rows.map((row) => row.map((c) => neutralise(c))),
    ],
    columns: table.headers.map((_, i) => ({ width: widthOf(table, i) })),
    stickyRowsCount: 1,
  }))
  return writeExcelFile(sheets).toBlob()
}
