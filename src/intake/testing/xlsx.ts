import writeExcelFile from 'write-excel-file/node'

export type XCell = string | number | boolean | Date | null

/** Test helper: a real `.xlsx` file from sheets of cells. Date cells are written with a date format. */
export async function makeXlsx(sheets: { sheet: string; rows: XCell[][] }[]): Promise<Uint8Array> {
  const data = sheets.map(({ sheet, rows }) => ({
    sheet,
    data: rows.map((r) => r.map((c) => (c instanceof Date ? { value: c, format: 'yyyy-mm-dd' } : c))),
  }))
  const buffer = await writeExcelFile(data as unknown as Parameters<typeof writeExcelFile>[0]).toBuffer()
  return new Uint8Array(buffer)
}
