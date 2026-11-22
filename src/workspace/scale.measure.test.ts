import { describe, it } from 'vitest'
import { plan } from '../engine'
import { generateInput } from '../engine/testing/generate'
import type { StoredCase } from '../intake/import/merge'
import { parseReport, serialiseReport, STATUSES, type ReportFile, type Visit } from '../share/report'
import { readStoredReports } from './reportRecords'
import { applyRetention } from './retention'
import { daySummary, markReportedDone, mergeReports } from './reports'
import { emptyWorkspace, readWorkspace, type Workspace } from './workspace'

// Opt-in measurement, skipped in normal runs and in the pipeline:
//   VITE_MEASURE_SPEED=1 npx vitest run src/workspace/scale.measure.test.ts
// A centre with 300 technicians: how long planning takes, and what a month of report files costs.
const on = import.meta.env.VITE_MEASURE_SPEED === '1'
const ms = (since: number): string => `${(performance.now() - since).toFixed(1)} ms`
const day = (n: number): string => new Date(Date.UTC(2026, 10, 1 + n)).toISOString().slice(0, 10)

describe.skipIf(!on)('300 technicians: planning', () => {
  // [cases, technicians, places, horizon in working days, every technician has every skill]
  // (The generator gives each technician one skill; "every skill" is the slow case: every technician can take every case.)
  const sizes = [[1500, 300, 60, 30, false], [3000, 300, 60, 30, false], [2000, 300, 60, 30, true], [3000, 300, 60, 30, true], [2000, 100, 60, 30, true]] as const
  for (const [nCases, nTechs, nPlaces, horizon, allSkills] of sizes) {
    it(`plans ${nCases} cases for ${nTechs} technicians${allSkills ? ' with every skill' : ''}`, () => {
      const input = generateInput(2026, nPlaces, nTechs, nCases, true)
      input.settings.horizonDays = horizon
      if (allSkills) for (const t of input.technicians) t.skills = [0, 1, 2]
      const started = performance.now()
      const result = plan(input)
      console.log(`SCALE plan: ${nCases} cases, ${nTechs} technicians${allSkills ? ', every skill' : ''}, horizon ${horizon}: ${result.scheduled.length} scheduled, ${result.unscheduled.length} left, ${result.days.length} days, ${ms(started)}`)
    }, 900_000)
  }
})

describe.skipIf(!on)('300 technicians: a month of report files', () => {
  const TECHS = 300
  const PER_DAY = 8
  const DAYS = 30
  const files = (d: number): ReportFile[] =>
    Array.from({ length: TECHS }, (_, t) => {
      const visits: Visit[] = Array.from({ length: PER_DAY }, (_, v) => ({
        caseId: String(100000 + d * TECHS * PER_DAY + t * PER_DAY + v),
        status: STATUSES[(t + v) % 3],
        ...(STATUSES[(t + v) % 3] === 'done' ? {} : { reason: 'no_access' as const, remarks: 'Gate was locked, will try again tomorrow morning' }),
        finishedAt: '14:30',
      }))
      return { reportVersion: 1, site: 'Invented centre', technician: `Technician ${t + 1}`, date: day(d), createdAt: `${day(d)}T15:00:00.000Z`, visits }
    })

  it('opens 300 files at once, then a month of days', () => {
    const cases = Array.from({ length: TECHS * PER_DAY * DAYS }, (_, i): StoredCase =>
      ({ caseId: String(100000 + i), state: 'active', overrides: {}, firstImported: '2026-10-01', lastImported: '2026-10-01' }) as StoredCase)
    let w: Workspace = { ...emptyWorkspace(), cases }

    const one = files(0)
    let started = performance.now()
    const texts = one.map(serialiseReport)
    console.log(`SCALE reports: serialise 300 files (${(texts.reduce((n, s) => n + s.length, 0) / 1024).toFixed(0)} KB in all): ${ms(started)}`)
    started = performance.now()
    const parsed = texts.map(parseReport)
    console.log(`SCALE reports: parse 300 files: ${ms(started)}`)
    started = performance.now()
    w = mergeReports(w, parsed).workspace
    console.log(`SCALE reports: merge 300 files into an empty store (${w.reports.length} records): ${ms(started)}`)

    let worst = 0
    started = performance.now()
    for (let d = 1; d < DAYS; d++) {
      const t0 = performance.now()
      w = mergeReports(w, files(d)).workspace
      worst = Math.max(worst, performance.now() - t0)
    }
    console.log(`SCALE reports: merge ${DAYS - 1} more days of 300 files each: ${ms(started)} in all, worst day ${worst.toFixed(1)} ms; ${w.reports.length} records`)

    started = performance.now()
    const planned = Array.from({ length: TECHS * PER_DAY }, (_, i) => ({ caseId: String(100000 + 29 * TECHS * PER_DAY + i), technician: `Technician ${Math.floor(i / PER_DAY) + 1}` }))
    const summary = daySummary(w.reports, day(29), planned)
    console.log(`SCALE reports: day summary over ${w.reports.length} records (${summary.reported} reported): ${ms(started)}`)

    started = performance.now()
    const marked = markReportedDone(w)
    console.log(`SCALE reports: mark reported done (${marked.marked} cases): ${ms(started)}`)

    started = performance.now()
    const text = JSON.stringify(w)
    console.log(`SCALE workspace: JSON.stringify ${(text.length / 1024 / 1024).toFixed(1)} MB: ${ms(started)}`)
    started = performance.now()
    structuredClone(w)
    console.log(`SCALE workspace: structuredClone (what saving costs, about): ${ms(started)}`)
    started = performance.now()
    readWorkspace(JSON.parse(text))
    console.log(`SCALE workspace: parse and read back (opening the app): ${ms(started)}`)
    started = performance.now()
    readStoredReports(w.reports)
    console.log(`SCALE reports: re-read ${w.reports.length} stored records: ${ms(started)}`)

    started = performance.now()
    const kept = applyRetention({ ...marked.workspace, retentionDays: 30 }, day(40))
    console.log(`SCALE retention: one pass, retention on (removed ${kept.removed.cases} cases, ${kept.removed.reports} reports): ${ms(started)}`)
    started = performance.now()
    applyRetention(kept.workspace, day(40))
    console.log(`SCALE retention: a second pass that changes nothing: ${ms(started)}`)
  }, 900_000)
})
