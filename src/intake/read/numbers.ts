import type { Cell } from './table'

export type Decimal = '.' | ','

/** A number cell or text such as `1,234.56` or `1.234,56`; null when it is not a number. */
export function parseNumber(value: Cell, decimal: Decimal): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value !== 'string') return null
  let t = value.replace(/[\s  ]/g, '')
  if (t === '') return null
  t = decimal === ',' ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '')
  return /^-?(\d+\.?\d*|\.\d+)$/.test(t) ? Number(t) : null
}

/**
 * Decides the decimal mark from a column's values. `1.234,5` and `2,5` mean comma; `1,234.5` and `2.5` mean point.
 * Values such as `1,234` could be a thousand or a decimal, so a column with only those gives null (the user confirms).
 * A column of whole numbers gives the point.
 */
export function detectDecimal(values: string[]): Decimal | null {
  let comma = 0
  let point = 0
  let unclear = 0
  let seen = 0
  for (const v of values) {
    const t = v.replace(/[\s  ]/g, '')
    if (t === '') continue
    if (seen >= 200) break
    if (/^-?\d+$/.test(t)) continue
    if (!/^-?[\d.,]+$/.test(t)) continue
    seen += 1
    const hasComma = t.includes(',')
    const hasPoint = t.includes('.')
    if (hasComma && hasPoint) {
      if (t.lastIndexOf(',') > t.lastIndexOf('.')) comma += 1
      else point += 1
    } else if (hasComma) {
      if (/^-?\d{1,3}(,\d{3})+$/.test(t)) unclear += 1
      else comma += 1
    } else if (/^-?\d{1,3}(\.\d{3})+$/.test(t)) unclear += 1
    else point += 1
  }
  if (comma > 0 && point === 0) return ','
  if (point > 0 && comma === 0) return '.'
  if (comma > 0 && point > 0) return null
  return unclear > 0 ? null : '.'
}
