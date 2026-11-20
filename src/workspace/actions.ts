import { mergeImport, type ImportPreview, type Overrides, type StoredCase } from '../intake/import/merge'
import type { Imported, ImportedTechnician } from '../intake/map/apply'
import { normaliseName, type Kind } from '../intake/map/model'
import type { MappingProfile } from '../intake/map/profile'
import { extendPlaces } from '../intake/site/site'
import type { Workspace } from './workspace'

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b)

function mergeTechnicians(existing: ImportedTechnician[], incoming: ImportedTechnician[], issues: { duplicate: number; incomplete: number }): { list: ImportedTechnician[]; preview: ImportPreview } {
  const preview: ImportPreview = { new: 0, updated: 0, unchanged: 0, duplicate: issues.duplicate, incomplete: issues.incomplete, removed: 0 }
  const list = [...existing]
  for (const t of incoming) {
    const at = list.findIndex((x) => normaliseName(x.name) === normaliseName(t.name))
    if (at < 0) {
      list.push({ ...t })
      preview.new += 1
    } else if (same(list[at], t)) {
      preview.unchanged += 1
    } else {
      list[at] = { ...t }
      preview.updated += 1
    }
  }
  return { list, preview }
}

function run(w: Workspace, imported: Imported, profile: MappingProfile, fileName: string, date: string): { workspace: Workspace; preview: ImportPreview } {
  const issues = {
    duplicate: imported.exceptions.filter((e) => e.issue === 'duplicate_id').length,
    incomplete: imported.exceptions.filter((e) => e.issue === 'missing_id').length,
  }
  let site = extendPlaces(w.site, imported.places)
  let cases = w.cases
  let technicians = w.technicians
  let changes = w.changes
  let preview: ImportPreview
  if (imported.kind === 'cases') {
    const merged = mergeImport(w.cases, imported, date)
    cases = merged.cases
    changes = [...w.changes, ...merged.changes]
    preview = merged.preview
  } else if (imported.kind === 'technicians') {
    const merged = mergeTechnicians(w.technicians, imported.technicians, issues)
    technicians = merged.list
    preview = merged.preview
  } else {
    const have = new Set(w.site.places.map((p) => normaliseName(p.name)))
    const fresh = imported.places.filter((p) => !have.has(normaliseName(p.name))).length
    preview = { new: fresh, updated: 0, unchanged: imported.places.length - fresh, duplicate: issues.duplicate, incomplete: issues.incomplete, removed: 0 }
  }
  const profiles = [...w.profiles.filter((p) => !(p.kind === profile.kind && p.fingerprint === profile.fingerprint)), profile]
  const imports = [...w.imports, { at: date, fileName, kind: imported.kind, preview }]
  return { workspace: { ...w, site, cases, technicians, changes, profiles, imports }, preview }
}

/** What an import would do, without doing it: the counts for the preview. */
export function previewImport(w: Workspace, imported: Imported, profile: MappingProfile, date: string): ImportPreview {
  return run(w, imported, profile, '', date).preview
}

/**
 * The workspace after an import: cases merged by identifier, technicians merged by name, new places added to the site,
 * the mapping saved for its layout, the change log and the import record appended. Does not change its input.
 */
export function applyImport(
  w: Workspace, imported: Imported, profile: MappingProfile, fileName: string, date: string,
): { workspace: Workspace; preview: ImportPreview } {
  return run(w, imported, profile, fileName, date)
}

/** The user's own decisions on one case: a manual technician or date, a work type, "done". */
export function setCaseOverride(w: Workspace, caseId: string, o: Overrides): Workspace {
  const cases = w.cases.map((c): StoredCase => {
    if (c.caseId !== caseId) return c
    const overrides = { ...c.overrides, ...o }
    for (const k of Object.keys(overrides) as (keyof Overrides)[]) if (overrides[k] === undefined) delete overrides[k]
    const state = o.done === true ? 'done' : o.done === false && c.state === 'done' ? 'active' : c.state
    return { ...c, overrides, state }
  })
  return { ...w, cases }
}

/** The saved mapping for a file layout, if there is one. */
export function profileFor(w: Workspace, kind: Kind, fingerprint: string): MappingProfile | undefined {
  return w.profiles.find((p) => p.kind === kind && p.fingerprint === fingerprint)
}
