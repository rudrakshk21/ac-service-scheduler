import { describe, expect, it } from 'vitest'
import type { Imported, ImportedCase } from '../intake/map/apply'
import type { MappingProfile } from '../intake/map/profile'
import { applyImport } from './actions'
import { backupDue, markBackedUp, parseWorkspace, serializeWorkspace } from './backup'
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
  it('keeps the time of the last backup, and opens saved data that never had one', () => {
    const w = markBackedUp(emptyWorkspace(), '2026-10-13')
    expect(parseWorkspace(serializeWorkspace(w)).lastBackupAt).toBe('2026-10-13')
    expect(readWorkspace(JSON.parse(serializeWorkspace(emptyWorkspace())) as unknown).lastBackupAt).toBeUndefined()
  })
  it('fills in holidays for a backup made before holidays existed', () => {
    const old = JSON.parse(serializeWorkspace(emptyWorkspace())) as Record<string, unknown>
    delete old.holidays
    expect(parseWorkspace(JSON.stringify(old)).holidays).toEqual([])
    expect(readWorkspace(old).holidays).toEqual([])
  })
})

describe('backup reminder', () => {
  const importedOn = (day: string) => applyImport(emptyWorkspace(), imported, profile, 'a.csv', day).workspace

  it('is not due when nothing has been imported, however long ago the app was opened', () => {
    expect(backupDue(emptyWorkspace(), '2030-01-01')).toEqual({ due: false, days: 0 })
  })
  it('counts from the first import when there has never been a backup, and is due after 14 days', () => {
    const w = importedOn('2026-10-01')
    expect(backupDue(w, '2026-10-01')).toEqual({ due: false, days: 0 })
    expect(backupDue(w, '2026-10-14')).toEqual({ due: false, days: 13 })
    expect(backupDue(w, '2026-10-15')).toEqual({ due: true, days: 14 })
  })
  it('counts from the first import even after later imports', () => {
    const w = applyImport(importedOn('2026-10-01'), imported, profile, 'b.csv', '2026-10-10').workspace
    expect(backupDue(w, '2026-10-15')).toEqual({ due: true, days: 14 })
  })
  it('counts from the last backup once there is one', () => {
    const w = markBackedUp(importedOn('2026-09-01'), '2026-10-12')
    expect(backupDue(w, '2026-10-15')).toEqual({ due: false, days: 3 })
    expect(backupDue(w, '2026-11-01')).toEqual({ due: true, days: 20 })
  })
  it('changes nothing but the time of the last backup when one is saved', () => {
    const w = importedOn('2026-10-01')
    expect(markBackedUp(w, '2026-10-05')).toEqual({ ...w, lastBackupAt: '2026-10-05' })
  })
})

describe('backup reminder: old saved data', () => {
  it('opens data saved before backups were counted, with no last backup', () => {
    const old = JSON.parse(serializeWorkspace(emptyWorkspace())) as Record<string, unknown>
    delete old.lastBackupAt
    expect(readWorkspace(old).lastBackupAt).toBeUndefined()
  })
})
