import { t } from '../../i18n'
import { IntakeError } from '../errors'

export type Cell = string | number | boolean | Date | null

export interface Detected {
  encoding: string
  encodingConfident: boolean
  delimiter: string | null
  delimiterConfident: boolean
  /** Rows above the header row. */
  skippedTitleRows: number
  raggedRows: number
  blankRows: number
}

export interface SourceTable {
  format: 'csv' | 'xlsx' | 'json'
  fileName: string
  sheets: string[]
  sheet: string
  /** Index of the header row in the rows as read. */
  headerRow: number
  headers: string[]
  rows: Cell[][]
  detected: Detected
}

export interface ReadOptions {
  encoding?: string
  delimiter?: string
  sheet?: string
  headerRow?: number
}

export interface TableMeta {
  format: SourceTable['format']
  fileName: string
  sheets: string[]
  sheet: string
  encoding: string
  encodingConfident: boolean
  delimiter: string | null
  delimiterConfident: boolean
}

const isEmpty = (c: Cell | undefined): boolean => c === null || c === undefined || (typeof c === 'string' && c.trim() === '')

function headerText(c: Cell | undefined): string {
  if (c === null || c === undefined) return ''
  if (c instanceof Date) return c.toISOString().slice(0, 10)
  return String(c).trim()
}

/** The first row with text in most columns; rows above it are title lines. */
export function findHeaderRow(rows: Cell[][]): number {
  const head = rows.slice(0, 30)
  const filled = head.map((r) => r.filter((c) => !isEmpty(c)).length)
  const width = Math.max(0, ...filled)
  if (width === 0) return 0
  const need = Math.ceil(0.6 * width)
  const textOnly = (r: Cell[]): boolean => r.every((c) => isEmpty(c) || typeof c === 'string')
  for (let i = 0; i < head.length; i++) if (filled[i] >= need && textOnly(head[i])) return i
  for (let i = 0; i < head.length; i++) if (filled[i] >= need) return i
  return 0
}

function uniqueHeaders(raw: Cell[]): string[] {
  const seen = new Map<string, number>()
  return raw.map((c, i) => {
    const base = headerText(c) || `Column ${i + 1}`
    const n = (seen.get(base) ?? 0) + 1
    seen.set(base, n)
    return n === 1 ? base : `${base} (${n})`
  })
}

/** Builds the table: finds the header row, makes headers unique, drops blank rows, pads or trims ragged rows. */
export function buildTable(rows: Cell[][], meta: TableMeta, options: ReadOptions = {}): SourceTable {
  if (rows.every((r) => r.every((c) => isEmpty(c)))) {
    throw new IntakeError('empty_file', t('intake.file.allEmpty', { file: meta.fileName }))
  }
  const headerRow = options.headerRow ?? findHeaderRow(rows)
  const headers = uniqueHeaders(rows[headerRow] ?? [])
  const data: Cell[][] = []
  let blankRows = 0
  let raggedRows = 0
  for (const raw of rows.slice(headerRow + 1)) {
    const cells: Cell[] = raw.map((c) => {
      if (typeof c === 'string') {
        const t = c.trim()
        return t === '' ? null : t
      }
      return c ?? null
    })
    if (cells.every((c) => c === null)) {
      blankRows += 1
      continue
    }
    const extraWithContent = cells.slice(headers.length).some((c) => c !== null)
    if (cells.length < headers.length || extraWithContent) raggedRows += 1
    const fixed = cells.slice(0, headers.length)
    while (fixed.length < headers.length) fixed.push(null)
    data.push(fixed)
  }
  if (data.length === 0) {
    throw new IntakeError('empty_file', t('intake.file.noRows', { file: meta.fileName }))
  }
  return {
    format: meta.format,
    fileName: meta.fileName,
    sheets: meta.sheets,
    sheet: meta.sheet,
    headerRow,
    headers,
    rows: data,
    detected: {
      encoding: meta.encoding,
      encodingConfident: meta.encodingConfident,
      delimiter: meta.delimiter,
      delimiterConfident: meta.delimiterConfident,
      skippedTitleRows: headerRow,
      raggedRows,
      blankRows,
    },
  }
}
