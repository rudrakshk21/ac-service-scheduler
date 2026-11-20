import { IntakeError, type IntakeErrorCode } from './errors'

/** Checks for reading JSON files. Every failure is an `IntakeError` whose message names the field. */
export function checker(code: IntakeErrorCode, prefix: string) {
  const fail = (path: string, problem: string): never => {
    throw new IntakeError(code, `${prefix}: ${path} ${problem}`)
  }
  return {
    fail,
    record(v: unknown, path: string): Record<string, unknown> {
      if (typeof v !== 'object' || v === null || Array.isArray(v)) return fail(path, 'must be an object')
      return v as Record<string, unknown>
    },
    list(v: unknown, path: string): unknown[] {
      if (!Array.isArray(v)) return fail(path, 'must be a list')
      return v
    },
    text(v: unknown, path: string): string {
      if (typeof v !== 'string' || v.trim() === '') return fail(path, 'must be text')
      return v
    },
    optText(v: unknown, path: string): string | undefined {
      if (v === undefined) return undefined
      if (typeof v !== 'string' || v.trim() === '') return fail(path, 'must be text')
      return v
    },
    num(v: unknown, path: string, min?: number, max?: number): number {
      if (typeof v !== 'number' || !Number.isFinite(v)) return fail(path, 'must be a number')
      if (min !== undefined && v < min) return fail(path, `must be at least ${min}`)
      if (max !== undefined && v > max) return fail(path, `must be at most ${max}`)
      return v
    },
    int(v: unknown, path: string, min?: number, max?: number): number {
      if (typeof v !== 'number' || !Number.isInteger(v)) return fail(path, 'must be a whole number')
      if (min !== undefined && v < min) return fail(path, `must be at least ${min}`)
      if (max !== undefined && v > max) return fail(path, `must be at most ${max}`)
      return v
    },
    bool(v: unknown, path: string): boolean {
      if (typeof v !== 'boolean') return fail(path, 'must be true or false')
      return v
    },
    oneOf<T extends string>(v: unknown, path: string, options: readonly T[]): T {
      if (typeof v !== 'string' || !options.includes(v as T)) return fail(path, `must be ${options.join(', ').replace(/, ([^,]*)$/, ' or $1')}`)
      return v as T
    },
  }
}

export function parseJson(text: string, code: IntakeErrorCode, prefix: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    throw new IntakeError(code, `${prefix}: the file is not valid JSON`)
  }
}
