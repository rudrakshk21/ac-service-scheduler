import { describe, expect, it } from 'vitest'
import type { Imported, ImportedCase } from '../intake/map/apply'
import type { MappingProfile } from '../intake/map/profile'
import { applyImport } from './actions'
import { parseWorkspace, serializeWorkspace } from './backup'
import { emptyWorkspace, readWorkspace, WorkspaceError } from './workspace'

const profile: MappingProfile = { profileVersion: 1, name: 'p', kind: 'cases', fingerprint: 'f', formats: {}, columns: {}, valueMaps: { workType: {}, status: {}, priority: {}, skill: {} } }
const c = (id: string): ImportedCase => ({ caseId: id, workTypeName: 'Service', place: 'North', state: 'active', dueAt: '2026-10-20' })
const imported: Imported = {
  kind: 'cases', cases: [c('1'), c('2')], technicians: [], places: [{ name: 'North', latitude: 1, longitude: 2 }], exceptions: [],
  quality: { rowsRead: 2, blankRowsSkipped: 0, totalRowsSkipped: 0, raggedRows: 0, filled: {}, duplicates: 0, badDates: [], unknownValues: [], unresolvedPlaces: 0 },
}

describe('backup', () => {
  it('writes and reads back a full workspace, ending with a newline', () => {
    const w = { ...applyImport(emptyWorkspace(), imported, profile, 'a.csv', '2026-10-13').workspace, holidays: ['2026-10-15'] }
    const text = serializeWorkspace(w)
    expect(text.endsWith('\n')).toBe(true)
    expect(parseWorkspace(text)).toEqual(w)
  })
  it('says plainly when the text is not a backup', () => {
    expect(() => parseWorkspace('nope {')).toThrow('This file is not a backup of the app.')
    expect(() => parseWorkspace('[]')).toThrow('damaged')
  })
  it('refuses data from a newer version and damaged data', () => {
    expect(() => parseWorkspace(JSON.stringify({ workspaceVersion: 2 }))).toThrow('newer version')
    expect(() => parseWorkspace(JSON.stringify({ workspaceVersion: 'x' }))).toThrow(WorkspaceError)
  })
  it('fills in holidays for a backup made before holidays existed', () => {
    const old = JSON.parse(serializeWorkspace(emptyWorkspace())) as Record<string, unknown>
    delete old.holidays
    expect(parseWorkspace(JSON.stringify(old)).holidays).toEqual([])
    expect(readWorkspace(old).holidays).toEqual([])
  })
})
