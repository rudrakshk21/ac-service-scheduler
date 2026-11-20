import { describe, expect, it } from 'vitest'
import { testSettings } from '../../engine/testing/fixtures'
import { starterSite } from './starter'

describe('starterSite', () => {
  it('holds the values validated on DS-1', () => {
    const s = starterSite()
    expect(s.workTypes).toEqual([
      { name: 'Installation', serviceMin: 120, dailyCeiling: 3, requiredSkill: 0 },
      { name: 'Service', serviceMin: 75, dailyCeiling: 5, requiredSkill: 1 },
      { name: 'Breakdown', serviceMin: 75, dailyCeiling: 5, requiredSkill: 2 },
    ])
    expect(s.skills).toEqual(['Installation', 'Service', 'Breakdown'])
    expect(s.priorityLevels).toEqual([{ name: 'Normal', weight: 0 }, { name: 'Escalated', weight: 100000 }])
    expect(s.keepAssignedTechnician).toBe(true)
    expect(s.places).toEqual([])
  })
  it('has the same settings as the engine tests use for the reference data', () => {
    const { holidays: _h, startDay: _s, ...expected } = testSettings()
    expect(starterSite().settings).toEqual(expected)
  })
  it('gives a fresh object every time', () => {
    const a = starterSite()
    a.workTypes[0].name = 'Changed'
    expect(starterSite().workTypes[0].name).toBe('Installation')
  })
})
