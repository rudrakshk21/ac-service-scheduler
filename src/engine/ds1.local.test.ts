import { describe, expect, it } from 'vitest'
import { plan } from './index'
import { compareResults } from './testing/compare'
import type { PlanInput, PlanResult } from './types'

interface Golden {
  name: string
  input: PlanInput
  expected: PlanResult
}

// Real data of the owner's service center. The folder is git-ignored and exists only on the owner's PC.
const files = import.meta.glob('../../reference-local/*.json', { eager: true, import: 'default' }) as Record<string, Golden>
const goldens = Object.values(files).sort((a, b) => a.name.localeCompare(b.name))

describe.skipIf(goldens.length === 0)('DS-1, real data (local only)', () => {
  it('has the baseline and the one-technician-inactive plan', () => {
    expect(goldens.map((g) => g.name)).toEqual(['ds1_baseline', 'ds1_first_technician_inactive'])
  })

  it.each(goldens.map((g) => [g.name, g] as const))('%s gives an identical plan', (_name, g) => {
    expect(compareResults(plan(g.input), g.expected)).toEqual([])
  })
})
