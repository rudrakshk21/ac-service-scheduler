import { t } from '../../i18n'
import { IntakeError } from '../errors'
import type { Cell } from './table'

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** A list of records: the value itself, or the first value of an object that is a list of objects. */
function findList(data: unknown): Record<string, unknown>[] | null {
  if (Array.isArray(data)) return data.every(isRecord) ? data : null
  if (isRecord(data)) {
    for (const v of Object.values(data)) {
      if (Array.isArray(v) && v.every(isRecord)) return v
    }
  }
  return null
}

function scalar(v: unknown): Cell {
  if (v === null || v === undefined) return null
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return v
  if (Array.isArray(v)) return v.every((x) => x === null || ['string', 'number', 'boolean'].includes(typeof x)) ? v.join(';') : JSON.stringify(v)
  return JSON.stringify(v)
}

/** One level of nested objects becomes `outer.inner` columns; lists of plain values are joined with `;`. */
function flatten(record: Record<string, unknown>): Map<string, Cell> {
  const out = new Map<string, Cell>()
  for (const [key, value] of Object.entries(record)) {
    if (isRecord(value)) {
      for (const [k2, v2] of Object.entries(value)) out.set(`${key}.${k2}`, scalar(v2))
    } else {
      out.set(key, scalar(value))
    }
  }
  return out
}

/** Rows for a JSON file: the first row holds the column names (in first-seen order), the rest the values. */
export function jsonToRows(text: string, fileName: string): Cell[][] {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new IntakeError('not_a_data_file', t('intake.file.notJson', { file: fileName }))
  }
  const list = findList(data)
  if (list === null) {
    throw new IntakeError('not_a_data_file', t('intake.file.noRecords', { file: fileName }))
  }
  if (list.length === 0) throw new IntakeError('empty_file', t('intake.file.emptyList', { file: fileName }))
  const flat = list.map(flatten)
  const headers: string[] = []
  for (const f of flat) for (const k of f.keys()) if (!headers.includes(k)) headers.push(k)
  return [headers, ...flat.map((f) => headers.map((h) => f.get(h) ?? null))]
}
