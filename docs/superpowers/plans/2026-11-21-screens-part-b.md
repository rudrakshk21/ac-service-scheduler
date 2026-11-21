# Screens, Part B: Plan on Real Data and Set-up Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline, no subagents: the owner manages usage limits). Steps use checkbox (`- [ ]`) syntax.

**Goal:** The Plan tab plans the imported data and lets the user switch technicians on and off; the Set-up tab edits everything the planner needs (site, rules, work types, skills, priority levels, places and aliases, technicians, holidays), saves and restores files, shows storage status and deletes all data.

**Architecture:** All changes to the workspace are pure functions in `src/screens/setup/setupActions.ts` returning `{ ok, workspace } | { ok: false, error }` with plain messages, so every rule is tested in Node. The Plan tab prepares a `PlanInput` with the intake library's `toPlanInput`, plans it in the worker, and reuses the demo's Board and view model. Set-up screens are thin forms over the actions.

**Tech Stack:** unchanged (React 19, TypeScript 7, Vitest 5 node environment, oxlint). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-11-21-screens-design.md` sections 6, 8, 9. Part A plan: `docs/superpowers/plans/2026-11-21-screens.md`.

## Global Constraints

- Branch `screens-b` (never `main`). Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. One pull request.
- Real data never in the repo. Phone first (no sideways scroll at 375 px, 44 px targets, visible focus), light and dark, plain sentence-case labels, no all-caps eyebrows.
- Every edit is one call to `update(w => action(w, ...))`; an action that returns an error changes nothing and the screen shows the message next to the control (`role="alert"`).
- Names are compared with `normaliseName` (case, accents, spacing ignored). A rename cascades to everything that stores the old name (cases, technicians, saved mappings, aliases).
- Full local check after every task: `cd <repo> && npm run lint && npx tsc -b && npm run test:coverage && py -m unittest discover -s reference -p "test_*.py" && py reference/check_ds1_local.py`.
- Browser checks use the dev server (`preview_start` name `dev`), 375 px and desktop, driven through the real controls. The screenshot tool can time out; use DOM measurements then.
- Before using Write on a path, check it does not exist.

---

### Task B0: Workspace additions and the setup actions

**Files:** Modify `src/workspace/workspace.ts`, `workspace.test.ts`; Create `src/workspace/backup.ts`, `backup.test.ts`, `src/screens/setup/setupActions.ts`, `setupActions.test.ts`.

**Interfaces:**
```ts
// workspace.ts: Workspace gains   holidays: string[]   (ISO dates; emptyWorkspace() gives [])
export function readWorkspace(raw: unknown): Workspace   // the checks of loadWorkspace on a value; throws WorkspaceError; loadWorkspace uses it
// backup.ts
export function serializeWorkspace(w: Workspace): string        // pretty JSON, ends with a newline
export function parseWorkspace(text: string): Workspace         // plain WorkspaceError for text that is not JSON, damaged or newer data
// setupActions.ts
export type Outcome = { ok: true; workspace: Workspace } | { ok: false; error: string }
setSiteName(w, name), setBase(w, lat, lon), setSettings(w, patch: Partial<SiteSettings>)
addWorkType(w, { name, serviceMin, dailyCeiling, skill }), updateWorkType(w, name, { serviceMin?, dailyCeiling?, skill? }), renameWorkType(w, name, next), removeWorkType(w, name)
addSkill(w, name), renameSkill(w, name, next), removeSkill(w, name)
addLevel(w, name, weight), updateLevel(w, name, { weight? }), renameLevel(w, name, next), moveLevel(w, name, direction: -1 | 1), removeLevel(w, name)
addPlace(w, place: SitePlace), updatePlace(w, name, patch: Partial<Omit<SitePlace, 'name'>>), renamePlace(w, name, next), removePlace(w, name)
addAlias(w, spelling, placeName), removeAlias(w, spelling): Workspace
addTechnician(w, { name, skills }), updateTechnician(w, name, patch: Partial<Omit<ImportedTechnician, 'name'>>)
toggleTechnician(w, name): Workspace, removeTechnician(w, name): Workspace
addHoliday(w, iso), removeHoliday(w, iso): Workspace
replaceSite(w, site: SiteProfile): Workspace
```
Rules (each is a test): all functions are pure and leave their input untouched. Names must be non-empty text and unique after normalising (`That name is already used.`). `setBase`: latitude -90..90, longitude -180..180. `setSettings`: the same checks as `parseSite` for each key present (speed and road factor above 0; minutes, weights, distance at least 0; horizon a whole number at least 0; rest weekdays whole numbers 0 to 6). `addWorkType`: skill must exist, minutes at least 0, ceiling above 0. `renameX` changes the list and every stored use: cases' `workTypeName` or `priorityLevel`; technicians' `skills`; saved mappings' value-map targets (`workType`, `priority`, `skill`) and `singleWorkType`; places: cases' `place`, technicians' `startPlace` and `endPlace`, aliases' targets. `removeWorkType`: error `N cases use this work type.` when any case has it (and `A site needs at least one work type.` for the last). `removeSkill`: error when a work type requires it or a technician has it. `removeLevel`: error when a case uses it, and for the last level. `removePlace`: error when a case or technician uses it. `removeSkill` also shifts nothing: work types point at skills by index, so removing a skill that is not last must re-index `requiredSkill` of work types (those above the removed index decrease by one). `moveLevel` swaps with the neighbour (no-op at the ends). `addAlias`: place must exist; the spelling is stored normalised. `addTechnician`: skills must exist in the site; `updateTechnician`: skills and places (`startPlace`, `endPlace`) must exist, `shiftHours` above 0, minutes at least 0, leave dates valid ISO with `leaveFrom` not after `leaveTo`; a field set to `undefined` is removed. `addHoliday`: valid `YYYY-MM-DD` (real calendar date), unique, kept sorted.

- [ ] **Step 1: Tests** in `setupActions.test.ts` (one `describe` per group above, each rule with its exact error text) plus `backup.test.ts` (round trip of a full workspace; text that is not JSON gives `This file is not a backup of the app.`; newer version and damaged data give the `WorkspaceError` messages of part A; a backup made without `holidays` loads with `[]`) and `workspace.test.ts` additions (`holidays` default, `readWorkspace` equals `loadWorkspace` on the same value).
- [ ] **Step 2: Implement.** `readWorkspace(raw)` holds the checks now in `loadWorkspace`; `loadWorkspace` calls it. A small helper `cascade(w, fn)` is not needed: write each rename explicitly with `map`.
- [ ] **Step 3:** Full check; commit `feat(setup): workspace holidays, backups and the set-up actions`.

---

### Task B1: Plan on real data

**Files:** Create `src/screens/plan/planData.ts`, `planData.test.ts`, `usePlan.ts`, `PlanScreen.tsx`; Modify `src/screens/AppShell.tsx` (Plan tab renders `PlanScreen`), `src/demo/DemoPage.tsx` only if needed to embed it (accept an optional `onBack`).

**Interfaces:**
```ts
// planData.ts
export function startDate(today: string, restWeekdays: number[], holidays: string[]): string   // today, or the next day that is not a rest day or holiday
export type Prepared =
  | { ok: true; input: PlanInput; caseIds: string[]; left: { hold: number; review: number; noPlace: number } }
  | { ok: false; title: string; text: string; action: { label: string; href: string } }
export function prepare(w: Workspace, today: string): Prepared
// usePlan.ts
export interface PlanState { result: PlanResult | null; busy: boolean; error: string | null; change: ChangeNote | null }
export function usePlan(input: PlanInput | null, note: { techName: string; switchedOn: boolean } | null): PlanState
```
`prepare` blocks, with plain text and a link, when: no technician is imported (`Import your technicians`, `#/import`), no case is ready to plan (`Import your cases` or, when cases exist but none is ready, `Nothing is ready to plan` with the counts and `#/data`), no active technician (`Switch a technician on`, `#/setup`). Otherwise it calls `toPlanInput(site, cases, technicians, { planStart: startDate(today, restWeekdays, holidays), holidays, importDate: today })` and counts the cases left out (`hold`, `review`, `noPlace` = active cases without a known place).
`usePlan` plans in the worker (`planInWorker`), drops stale answers with a ticket (as `useDemoPlan` does), replans when the input changes (compare `JSON.stringify(input)`), and fills `change` (`movedCases` from `src/demo/viewModel.ts`) only when `note` is given and a previous result exists.

- [ ] **Step 1: Tests** for `startDate` (today when it is a working day; Sunday rolls to Monday; a holiday on that Monday rolls to Tuesday; the weekday maths agrees with the engine's `weekday`) and `prepare` (each blocked case with its exact text and link; a ready workspace built with `applyImport` from two invented imports gives `ok: true`, `caseIds` sorted by number, `left` counts right, `plan(input)` succeeds on the result).
- [ ] **Step 2: Implement.** `PlanScreen`: while `prepare` is blocked show the empty state (title, text, a primary link, and a secondary button "See the demo with invented data" that shows `DemoPage` with a "Back" button). Otherwise: a lede ("N cases planned over D working days, T of U technicians work, H hours of driving, S hours on site"), the day picker and legend from the demo, the status line for a change, `Board` with `onToggle` calling `update(w => toggleTechnician(w, input.technicians[i].name))` and setting the note, the unscheduled list (`result.unscheduled`: id, reason, a button to open the case in the Data tab through `location.hash = '#/data'`), and a line for the cases left out with a link to the Data tab.
- [ ] **Step 3: Browser check:** import the invented files (cases with coordinates and a technician file) through the real input, open Plan, see lanes, switch a technician off, see the moved-cases note, reload and see the switch kept; check 375 px (no sideways scroll).
- [ ] **Step 4:** Full check; commit `feat(plan): the plan tab on imported data`.

---

### Task B2: Set-up screens

**Files:** Create `src/screens/setup/SetupScreen.tsx`, `SiteSection.tsx`, `CatalogueSection.tsx`, `PlacesSection.tsx`, `TechniciansSection.tsx`, `HolidaysSection.tsx`, `setup.css`, `useAction.ts`; Modify `src/screens/AppShell.tsx` (Set-up tab).

`useAction()` returns `{ run(outcomeFn), error }`: applies `update(w => { const o = fn(w); if (!o.ok) { setError(o.error); return w } setError(null); return o.workspace })`. (An action that fails must not change the workspace.)

Sections, each a `<section aria-labelledby>` with an `h2`:
1. **Your centre:** name; base latitude and longitude (number inputs, committed on blur) and a button "Use my location" that calls `navigator.geolocation.getCurrentPosition` on click only and shows its refusal in words.
2. **Working rules:** speed (km/h), road factor, same-area hop (minutes), day starts (time), lunch starts (time), usable hours per day, break (minutes), longest distance (km), planning days ahead, rest days (seven checkboxes Monday to Sunday), age weight, balance weight, due weight, urgency days. Time and hour inputs convert to the minutes the settings store. Each with one line of help in plain words.
3. **Work types, skills and priority levels** (`CatalogueSection`): lists with add, rename (inline edit, commit on blur or Enter), numbers, a select for the required skill, move up and down for levels, and remove with the action's error shown beside the row.
4. **Places:** list with name, latitude, longitude, postal code (edit on blur), remove, add; aliases list with add (spelling and place select) and remove. A search box when there are more than 8 places.
5. **Technicians:** one card each: Active switch, skills as checkboxes, leave from and to dates, start and end place selects (blank = the base), day start (time), shift hours, break minutes; add (name and skills) and remove (two-step confirm).
6. **Holidays:** date input and Add; the list with remove buttons.

- [ ] **Step 1: Build the sections** with the controls above; labels are visible text, errors `role="alert"` next to the control; the section order is the order above; all targets at least 44 px.
- [ ] **Step 2: Browser check:** rename a work type and see the Data tab chip text follow; try to remove a work type that cases use and read the message; add a place and an alias; add a holiday; set the base; check 375 px and desktop for overflow with `scrollWidth`.
- [ ] **Step 3:** Full check; commit `feat(setup): the set-up screens`.

---

### Task B3: Files, storage and delete

**Files:** Create `src/screens/files.ts`, `src/screens/setup/DataSection.tsx`; Modify `SetupScreen.tsx`.
**Interfaces:** `downloadText(fileName: string, text: string, type?: string): void` (Blob, object URL, a hidden anchor, revoke); `readText(file: File): Promise<string>`.
Section "Your data and files": **Save the site set-up** (`serializeSite`), **Load a site set-up** (file input, `parseSite`, `replaceSite`, plain error), **Save a backup of everything** (`serializeWorkspace`), **Restore a backup** (`parseWorkspace`, then a confirm "This replaces everything now in the app" before `update(() => restored)`), the storage status (`navigator.storage.persisted()` text: "The browser promises to keep your data" or "The browser may clear your data when space is short. Save a backup now and then."), and **Delete all my data** with a second confirm button ("Delete everything") that replaces the workspace with `emptyWorkspace()`.
- [ ] **Step 1: Test** `files.ts` is DOM code and is checked in the browser. Test `parseWorkspace` round trips again with a workspace produced by `applyImport` (in B0).
- [ ] **Step 2: Implement; browser check:** save and restore a backup (read the downloaded text through the anchor's `href` before it is revoked: stub `URL.createObjectURL` in the page to capture the Blob), delete everything and see the empty states, load a site file.
- [ ] **Step 3:** Full check; commit `feat(setup): site and backup files, storage status and delete`.

---

### Task B4: Finish

- [ ] Update the screens spec (status, as-built notes for part B); update `src/screens` notes if any; run the full check and `npm run build` (report sizes); push `screens-b`; ask the owner to open the pull request (`pull/new/screens-b`), watch the checks, ask for the merge click, verify the live site with the real controls (import, plan, switch, set-up edit), update memory.

## Self-Review

- **Spec coverage:** section 6 (plan, set-up, files, persistent storage, delete) is covered by B1 to B3; the rules of section 8 (plain errors) are the `Outcome` messages; section 9 (phone, accessibility) is checked in each browser step.
- **Placeholders:** none. Exact error texts are listed where the tests pin them; remaining messages follow the same plain style and are fixed by the tests written in B0.
- **Type consistency:** `Outcome`, `Prepared`, `PlanState`, `ChangeNote` (from `src/demo/useDemoPlan.ts`) and the workspace and intake types are defined once above or exist already.
