import { describe, expect, it } from 'vitest'
import { plan } from '../../engine/index'
import type { StoredCase } from '../../intake/import/merge'
import { emptyWorkspace, type Workspace } from '../../workspace/workspace'
import { prepare, startDate } from './planData'

describe('startDate', () => {
  it('is today when today is a working day', () => {
    expect(startDate('2026-10-13', [6], [])).toBe('2026-10-13') // a Tuesday
  })
  it('rolls a rest day to the next working day', () => {
    expect(startDate('2026-10-18', [6], [])).toBe('2026-10-19') // Sunday to Monday
    expect(startDate('2026-10-17', [5, 6], [])).toBe('2026-10-19') // Saturday and Sunday off
  })
  it('skips holidays, also after a rest day', () => {
    expect(startDate('2026-10-18', [6], ['2026-10-19'])).toBe('2026-10-20')
    expect(startDate('2026-10-13', [6], ['2026-10-13', '2026-10-14'])).toBe('2026-10-15')
  })
  it('stops looking when every day is off', () => {
    expect(startDate('2026-10-13', [0, 1, 2, 3, 4, 5, 6], [])).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

const stored = (id: string, over: Partial<StoredCase> = {}): StoredCase => ({
  caseId: id, workTypeName: 'Service', place: 'North', state: 'active', reportedAt: '2026-10-10', overrides: {},
  firstImported: '2026-10-13', lastImported: '2026-10-13', ...over,
})
function ready(): Workspace {
  const w = emptyWorkspace()
  return {
    ...w,
    site: { ...w.site, places: [{ name: 'North', latitude: 20.1, longitude: 30.05 }, { name: 'South', latitude: 19.95, longitude: 30.1 }] },
    technicians: [{ name: 'Ann', skills: ['Service'], active: true }, { name: 'Bo', skills: ['Service'], active: true }],
    cases: [stored('10'), stored('9'), stored('100', { place: 'South' })],
  }
}
const TODAY = '2026-10-13'

describe('prepare: when it cannot plan yet', () => {
  it('asks for technicians first, then cases', () => {
    const noTech = prepare({ ...ready(), technicians: [] }, TODAY)
    expect(noTech).toMatchObject({ ok: false, title: 'Import your technicians', action: { label: 'Import technicians', href: '#/import' } })
    const noCases = prepare({ ...ready(), cases: [] }, TODAY)
    expect(noCases).toMatchObject({ ok: false, title: 'Import your cases', action: { href: '#/import' } })
  })
  it('explains when no case is ready, with the counts', () => {
    const w = { ...ready(), cases: [stored('1', { state: 'hold' }), stored('2', { state: 'review' }), stored('3', { state: 'done' })] }
    const p = prepare(w, TODAY)
    expect(p).toMatchObject({ ok: false, title: 'Nothing is ready to plan', action: { href: '#/data' } })
    expect(p.ok ? '' : p.text).toBe('1 on hold, 1 in review, 0 ignored, 1 done, 0 closed. Only cases that are ready to plan are planned.')
  })
  it('asks to switch a technician on when all are off', () => {
    const w = { ...ready(), technicians: ready().technicians.map((t) => ({ ...t, active: false })) }
    expect(prepare(w, TODAY)).toMatchObject({ ok: false, title: 'Switch a technician on', action: { href: '#/setup' } })
  })
  it('says so when the ready cases have no known place or work type', () => {
    const w = { ...ready(), cases: [stored('1', { place: undefined }), stored('2', { workTypeName: 'Plumbing' })] }
    expect(prepare(w, TODAY)).toMatchObject({ ok: false, title: 'No case can be planned yet' })
  })
})

describe('prepare: when it can', () => {
  it('builds an input the engine accepts, with cases in numeric order and the counts of what is left out', () => {
    const w = { ...ready(), cases: [...ready().cases, stored('1', { state: 'hold' }), stored('2', { state: 'review' }), stored('3', { place: undefined })] }
    const p = prepare(w, TODAY)
    if (!p.ok) throw new Error(p.text)
    expect(p.caseIds).toEqual(['9', '10', '100'])
    expect(p.left).toEqual({ hold: 1, review: 1, noPlace: 1 })
    expect(p.planStart).toBe('2026-10-13')
    expect(p.input.technicians.map((t) => t.name)).toEqual(['Ann', 'Bo'])
    const result = plan(p.input)
    expect(result.scheduled.map((s) => s.id).sort()).toEqual(['10', '100', '9'])
  })
  it('starts on the next working day and passes the holidays on', () => {
    const w = { ...ready(), holidays: ['2026-10-14'] }
    const p = prepare(w, '2026-10-18') // Sunday
    if (!p.ok) throw new Error(p.text)
    expect(p.planStart).toBe('2026-10-19')
    expect(p.input.settings.holidays).toHaveLength(1)
  })
})
