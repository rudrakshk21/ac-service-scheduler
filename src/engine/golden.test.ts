import { describe, expect, it } from 'vitest'
import { plan } from './index'
import { compareResults } from './testing/compare'
import type { PlanInput, PlanResult } from './types'

interface Golden {
  name: string
  input: PlanInput
  expected: PlanResult
}

const files = import.meta.glob('../../reference/golden/*.json', { eager: true, import: 'default' }) as Record<string, Golden>
const goldens = Object.values(files).sort((a, b) => a.name.localeCompare(b.name))

describe('golden files from the Python reference engine', () => {
  it('finds all 16 scenarios', () => {
    expect(goldens.length).toBe(16)
  })

  it.each(goldens.map((g) => [g.name, g] as const))('%s gives an identical plan', (_name, g) => {
    expect(compareResults(plan(g.input), g.expected)).toEqual([])
  })
})
