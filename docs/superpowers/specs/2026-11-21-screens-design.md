# Screens: design

Date: 2026-11-21
Status: design decided by the assistant under the owner's delegation ("start the screens, do it on autopilot"); built in two pull requests
Part of: AC Service Scheduler, requirements v4.1 (FR-01, FR-17 to FR-24, NFR usability), the third of five pieces

## 1. Purpose

Put a usable front end on the engine and the data intake library: the first-time coordinator imports files, maps
columns and values once, sees the quality of the data, confirms an import, and sees the plan. Phone first (the
technicians' route pack comes in the next piece), desktop second. Everything stays in the browser (no server).

## 2. Decisions

| Question | Decision |
|---|---|
| How is the piece cut? | Two pull requests. **A:** workspace store, app shell, import flow, data list. **B:** plan on real data, technician switches, site set-up (work types, skills, priority levels, base, rules, places). Each is shippable on its own. |
| Navigation | Four tabs: **Plan**, **Data**, **Import**, **Set-up**. Bottom bar on a phone (touch targets of 44 px), a left rail on wide screens. The tab is kept in the URL hash (`#/import`) so reload and back work. No router library. |
| First visit | An empty workspace shows two choices: "Import your files" and "See the demo" (the existing demo board with invented data). Nothing is created until the user imports. |
| Storage | IndexedDB, one database (`ac-scheduler`) with one store holding the whole workspace under one key, written in one transaction after every change (NFR-5: saved within 1 second). A small wrapper of our own behind a two-method interface (`get`, `set`); an in-memory twin for tests. Persistent storage is requested on first import. |
| State | A `WorkspaceProvider` loads the workspace once and gives `workspace` and `update(change)`; every change is a pure function of the workspace (`workspace/actions.ts`), saved after it is applied. |
| Import flow | One file at a time, four steps: **File**, **Columns**, **Values**, **Check**. The flow is a pure reducer (`importFlow.ts`) so every transition is tested without a browser. |
| What a file is | The flow guesses the kind (cases, technicians, places) from the columns and lets the user change it. |
| Saved mappings | A confirmed profile is saved in the workspace by layout fingerprint. A later file with the same layout skips the Columns and Values steps and goes straight to Check, with a note. |
| Look | The demo's look carries over: frost paper, ink, self-hosted Bricolage Grotesque, work-type colours from refrigerant cylinders, light and dark. Plain language, no jargon in labels. |
| Tests | Pure logic in Node (reducers, view models, the database wrapper with `fake-indexeddb`). Screens are checked in the browser at 375 px and 1280 px, including an upload driven through the real file input. |

## 3. Workspace

```ts
interface Workspace {
  workspaceVersion: 1
  site: SiteProfile
  technicians: ImportedTechnician[]
  cases: StoredCase[]
  profiles: MappingProfile[]      // saved mappings, one per layout fingerprint and kind
  changes: ChangeLogEntry[]       // every import change, newest last
  imports: { at: string; fileName: string; kind: Kind; preview: ImportPreview }[]
}
```

`workspace/db.ts`: `KeyValueStore { get, set }`, `openIndexedStore()`, `memoryStore()`. `workspace/workspace.ts`:
`emptyWorkspace()`, `loadWorkspace(store)`, `saveWorkspace(store, w)` (validates the version; an unknown newer version
gives a plain message and does not overwrite). `workspace/actions.ts`: `applyImport(w, imported, profile, fileName, date)`
(merges cases, replaces or merges technicians and places, saves the profile by fingerprint, appends the change log and
the import record), `setCaseOverride`, `clearWorkspace`.

## 4. Import flow

State: `{ step, file, table, kind, profile, suggestions, imported, preview, error }`.

1. **File.** Choose a file (button and drop area). Reading happens in the page (files are small). Plain error messages
   from `IntakeError`. Detected format shown ("UTF-8, semicolon, header on row 3") with controls to change encoding,
   delimiter, sheet and header row when detection is not confident. The kind is guessed and can be changed.
2. **Columns.** One row per field (mandatory first, then recommended, then optional): a select of source columns,
   pre-filled from suggestions (confidence badge, reason text), three sample values under the select. Personal fields
   are marked and start empty. A question appears only when the day and month cannot be told apart.
3. **Values.** Distinct source values of the work type, status, priority (and skill) columns, each with a select of
   the site's options. Unmapped values are highlighted and the step cannot continue while a work type is unmapped,
   unless the user chooses "Leave in review".
4. **Check.** The quality report (rows read, filled shares as bars, unreadable dates with examples, unresolved places,
   duplicates, total rows skipped), the exceptions list (first 20, with a count), and the import preview (new, updated,
   unchanged, duplicate, incomplete, removed). The button says what it will do: "Import 70 cases (60 new, 8 updated)".
   After importing: a summary and "See the data" / "Import another file".

## 5. Data tab

Counts by state (active, on hold, in review, ignored, done, closed), a search box, a list of cases (identifier, work
type, place, state, due) with a state filter and a detail view for one case (all stored fields, its exceptions, "mark
done", a manual technician and date), the technician list, and the exception queue ("No location", "Needs review").

## 6. Plan tab and Set-up (pull request B)

**Plan:** `toPlanInput` on the workspace, planned in the worker as in the demo; the Board and day picker are reused
with real names; Active switches per technician re-plan with the moved-case note; unscheduled cases listed with their
reason. With no data it offers the demo.
**Set-up:** site name and base location, rule values (speed, road factor, hours, break, ceilings), work types and
required skills, skills, priority levels and weights, places and aliases (add, edit, import a places file), a place
for each technician's start and end, export and import of the site profile file, persistent-storage status, and
"delete all my data".

## 7. Files

| File | Job |
|---|---|
| `src/workspace/db.ts`, `workspace.ts`, `actions.ts`, `WorkspaceProvider.tsx` | storage, the workspace, pure changes, React hook |
| `src/screens/AppShell.tsx`, `nav.ts` | tabs, hash routing, layout |
| `src/screens/import/importFlow.ts` | the flow's reducer and helpers (distinct values, field rows, kind guess) |
| `src/screens/import/ImportScreen.tsx`, `FileStep.tsx`, `ColumnsStep.tsx`, `ValuesStep.tsx`, `CheckStep.tsx`, `import.css` | the four steps |
| `src/screens/data/dataView.ts`, `DataScreen.tsx`, `data.css` | counts, filters, case detail |
| `src/screens/shell.css` | shell, tab bar, shared form controls |
| PR B: `src/screens/plan/*`, `src/screens/setup/*` | plan on real data, set-up |

## 8. Errors and empty states

Every error the user can cause is shown in plain words next to what caused it. A storage that cannot be opened (private
window, blocked) shows a banner and the app keeps working from memory for the session, saying that data will not be kept.
No screen is ever blank: each has an empty state that says what to do next.

## 9. Accessibility and phone

Every control has a visible label; the tab bar is a real `nav` with `aria-current`; focus is visible and moves to the
step heading when the step changes; touch targets are at least 44 px; text scales; no horizontal page scroll at 375 px
(tables become stacked cards); light and dark; reduced motion respected.

## 10. Finish line

- Pull request A: a file of any of the invented layouts imports through the four steps in the browser, survives a
  reload, shows in the Data tab, and a repeat import of the same file shows "unchanged" and skips the mapping steps.
- Pull request B: the imported data plans on screen, the technician switches work, set-up edits change the plan.
- Tests, lint, type check and build pass; both checks green on GitHub; the live site verified after each merge.

Estimate: 14 to 20 hours of build time in total.
