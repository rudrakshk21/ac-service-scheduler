# Phone, map and sharing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The planner installs on an Android phone, opens with no signal, exports and prints its plan, gives each technician a route pack file, draws the day's routes on a map, and has a second interface language.

**Architecture:** Static app as before. A small hand-written service worker, filled with the build's file list by a Vite plugin, makes the app work offline. Pure modules (tables, CSV, route pack, map projection, translation lookup) are tested in Node; thin React screens use them.

**Tech Stack:** React 19, Vite 8, TypeScript, Vitest, `write-excel-file` (lazy, already a dev dependency, moves to dependencies in part D), Python with Pillow for one-off icon generation.

**Spec:** `docs/superpowers/specs/2026-11-21-phone-sharing-design.md`. Requirements: v4.1 FR-16.3, FR-18, FR-19, FR-20, FR-28, PRV-9, SEC-5, NFR-3, NFR-19.

## Global Constraints

- No real data in committed files; invented data only (DS-1 stays in `reference-local/`).
- First download at most 300 KB compressed (NFR-3); about 69 KB now. Excel writer and map load on demand.
- No network request made by the app itself. No third-party service, no account, no cost.
- Plain-language labels, sentence case, no jargon; touch targets at least 48 px; no horizontal page scroll at 360 px; light and dark; reduced motion respected.
- Do not change `reference/python/engine.py` or the engine.
- PowerShell: pass forward-slash paths to npm/npx; commit with `git commit -F <file>` (messages with double quotes break `-m`); commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Full check before every push: `npm run lint && npx tsc -b && npm run test:coverage && py -m unittest discover -s reference -p "test_*.py" && py reference/check_ds1_local.py`, then `npm run build`.

---

## Part C: installable and offline (branch `phone-pwa`)

### Task C1: Icons and manifest

**Files:** Create `tools/make_icons.py`, `public/icons/icon-192.png`, `icon-512.png`, `maskable-512.png`, `apple-touch-icon.png`, `public/manifest.webmanifest`, `public/_headers`. Modify `index.html`.

- [ ] **Step 1:** Write `tools/make_icons.py` (Pillow). It draws the favicon motif (a dark rounded square with three rounded bars in green `#3fbf86`, blue `#5b9be6`, rose `#ee6f95`) at 4x size and shrinks with LANCZOS. Sizes: `icon-192.png` and `icon-512.png` (rounded square, transparent corners), `maskable-512.png` (full-bleed dark square, bars inside the central 80 % safe zone), `apple-touch-icon.png` 180 (full-bleed, iOS rounds it). Run `py tools/make_icons.py`; open one PNG to check.
- [ ] **Step 2:** `public/manifest.webmanifest`: `name` "AC Service Scheduler", `short_name` "AC Planner", `description`, `start_url` "/#/plan", `scope` "/", `display` "standalone", `background_color` the light paper colour from `src/index.css`, `theme_color` "#14232b", `lang` "en", icons 192 and 512 (`purpose` "any") and `maskable-512.png` (`purpose` "maskable").
- [ ] **Step 3:** `public/_headers`: `/sw.js` and `/index.html` get `Cache-Control: no-cache`; `/manifest.webmanifest` gets `Content-Type: application/manifest+json` and `Cache-Control: no-cache`.
- [ ] **Step 4:** `index.html`: add `<link rel="manifest" href="/manifest.webmanifest" />`, `<meta name="theme-color" content="#14232b" />`, `<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />`.
- [ ] **Step 5:** Commit `feat(pwa): icons and web app manifest`.

### Task C2: The service worker and the plugin that fills it (test first)

**Files:** Create `vite-plugins/sw-template.js`, `vite-plugins/precache.ts`, `vite-plugins/precache.test.ts`, `vite-plugins/sw.test.ts`. Modify `vite.config.ts` (plugin, test include, coverage include), `tsconfig.node.json` (include `vite-plugins`).

**Interfaces:**
- `precache.ts` produces: `listFiles(dir: string): string[]` (relative paths, forward slashes, sorted, without `sw.js`, `_headers` and `.map` files); `urlsFor(files: string[]): string[]` (`/`, `/index.html` and `/<file>` for each); `versionOf(entries: { file: string; hash: string }[]): string` (12 hex chars); `swSource(template: string, version: string, urls: string[]): string` (replaces `__VERSION__` and `__FILES__`); `precache(): Plugin` (after the build writes `sw.js` into the output folder).
- `sw-template.js` registers `install` (add every url to cache `ac-scheduler-<version>`; no skipWaiting), `activate` (delete other `ac-scheduler-` caches, claim clients), `message` (`'skip-waiting'` calls `skipWaiting`), `fetch` (GET and same origin only: cache first with `ignoreSearch`; a navigation not in the cache gets `/index.html`; otherwise the network).

- [ ] **Step 1: Failing tests.** `precache.test.ts`: `urlsFor(['assets/a.js','favicon.svg'])` is `['/','/index.html','/assets/a.js','/favicon.svg']` (no duplicate `index.html` when it is in the list); `versionOf` is 12 hex chars, the same for the same entries in another order, different when one hash changes; `swSource` replaces both markers and the output parses as JavaScript; `listFiles` on a temp folder skips `sw.js`, `_headers`, `*.map`, and returns nested files with forward slashes. `sw.test.ts`: runs the filled template in `node:vm` against a stub (`self.addEventListener` captures handlers, `caches` backed by a Map, `fetch` stub, `Request`/`Response` from Node). Cases: install caches every url under the versioned name; activate deletes `ac-scheduler-old` but keeps `other-app`; a cached asset is answered from cache even with `?v=1`; a non-GET and a cross-origin request get no `respondWith`; an uncached navigation gets the cached `/index.html`; an uncached non-navigation goes to the network stub; `message` `'skip-waiting'` calls `skipWaiting`.
- [ ] **Step 2:** Run `npx vitest run vite-plugins/` and see the failures (the vitest `include` must first list `vite-plugins/**/*.test.ts`).
- [ ] **Step 3:** Write `sw-template.js` and `precache.ts`. In `precache()`: `apply: 'build'`, `configResolved` keeps `build.outDir` and `root`; `closeBundle` lists files, hashes each (sha256), builds the version, reads `vite-plugins/sw-template.js`, writes `<outDir>/sw.js`.
- [ ] **Step 4:** Add the plugin to `vite.config.ts`; extend `coverage.include` with `vite-plugins/**/*.ts` and its `exclude` with `vite-plugins/**/*.test.ts`; set `tsconfig.node.json` `include` to `["vite.config.ts", "vite-plugins"]` and add `"allowJs": true, "checkJs": false` if the template needs it.
- [ ] **Step 5:** Run the tests until green; `npm run build`; check `dist/sw.js` exists, lists the three woff2 files, `plan.worker-*.js`, `index.html`, `manifest.webmanifest` and the icons, and is under 30 KB.
- [ ] **Step 6:** Commit `feat(pwa): service worker that caches the whole app`.

### Task C3: Register, update banner, install button

**Files:** Create `src/pwa/register.ts` (store, `startPwa`, `applyUpdate`, `promptInstall`), `src/pwa/usePwa.ts`, `src/screens/UpdateBanner.tsx`. Modify `src/main.tsx` (`startPwa()`), `src/screens/AppShell.tsx` (banner), `src/screens/setup/DataSection.tsx` (install block), `vite.config.ts` (coverage exclude the three browser files).

- [ ] **Step 1:** `register.ts`: a tiny external store `{ updateReady, canInstall }` with `subscribe`/`getSnapshot`. `startPwa()` returns at once unless `import.meta.env.PROD` and `'serviceWorker' in navigator`. After `load` it registers `/sw.js`; when a new worker reaches `installed` while the page already has a controller, set `updateReady` and remember the waiting worker. It catches `beforeinstallprompt` (prevent default, keep the event, `canInstall`) and clears on `appinstalled`.
- [ ] **Step 2:** `applyUpdate()` posts `'skip-waiting'` to the waiting worker and reloads once on `controllerchange`. `promptInstall()` calls the kept event's `prompt()`.
- [ ] **Step 3:** `UpdateBanner`: `<p className="banner" role="status">A new version is ready. <button className="btn">Reload</button></p>`, shown above the tabs when `updateReady`. Add it to `AppShell` next to the storage banner.
- [ ] **Step 4:** `DataSection`: when `canInstall`, an "Install on this device" button; always a `<details>` "If there is no install button" with the Chrome, Samsung Internet and Firefox steps in plain words.
- [ ] **Step 5:** Lint, type check, commit `feat(pwa): update banner and install button`.

### Task C4: Keep the data, remind about backups (test first)

**Files:** Modify `src/workspace/workspace.ts` (`lastBackupAt?: string` documented), `src/workspace/backup.ts` (`markBackedUp(w, today)`, `backupDue(w, today)`), `src/workspace/backup.test.ts`, `src/screens/setup/DataSection.tsx`, `src/screens/files.ts` (`askToKeepData()`), `src/screens/import/CheckStep.tsx` (call it after a successful import). Create `src/screens/BackupNotice.tsx`; modify `AppShell.tsx`.

- [ ] **Step 1: Failing tests.** `backupDue`: nothing imported gives `{ due: false }`; imported 13 days ago, never backed up: not due; 14 days: due, `days: 14`; backed up 3 days ago: not due even if imported long ago; backed up 20 days ago: due, `days: 20`. `markBackedUp` sets `lastBackupAt` and changes nothing else. `readWorkspace` of a saved value without the field still works.
- [ ] **Step 2:** Implement. The reference day is `lastBackupAt ?? earliest import date`; use `dayNumber` from `engine/calendar` for the difference.
- [ ] **Step 3:** "Save a backup" in `DataSection` calls `update(markBackedUp)` after the download starts. `BackupNotice` shows "You have not saved a backup for N days. Your data lives only in this browser." with a "Save a backup" link to `#/setup` and a "Later" button that hides it until the page is opened again. `askToKeepData()` calls `navigator.storage?.persist?.()` once, ignoring errors.
- [ ] **Step 4:** Tests green, lint, type check, commit `feat(storage): ask to keep the data and remind about backups`.

### Task C5: Touch targets and phone width

**Files:** Modify `src/screens/shell.css`, `src/screens/setup/setup.css`, `src/screens/import/import.css`, `src/screens/data/data.css`, `src/demo/demo.css` (every `44px` control size becomes `48px`).

- [ ] **Step 1:** `grep -rn "44px" src --include=*.css`, change control heights and widths to 48 px (not borders or icons).
- [ ] **Step 2:** In the browser at 360 px wide check every tab and the demo for sideways scroll and for controls shorter than 48 px (`getBoundingClientRect`), fix what is found.
- [ ] **Step 3:** Commit `feat(ui): 48 px touch targets`.

### Task C6: Prove it works offline

- [ ] **Step 1:** `npm run build`, then `npx vite preview --port 4173` in the background. Open `http://localhost:4173`, wait for the worker to become active (`navigator.serviceWorker.ready`), check `caches.keys()` has one `ac-scheduler-*` cache holding every file of `dist/sw.js`.
- [ ] **Step 2:** Import a small invented file, stop the preview server, reload: the page must open, show the data, and the Plan tab must plan. Record the result.
- [ ] **Step 3:** Fetch `/manifest.webmanifest` and each icon in the browser: all 200 with the right types; `display` standalone.
- [ ] **Step 4:** Rebuild with a visible text change, restart the server, reload twice: the banner "A new version is ready" appears; Reload shows the new text. Undo the text change.

### Task C7: Finish part C

- [ ] **Step 1:** Full check and `npm run build`; report sizes (first download must stay far under 300 KB compressed).
- [ ] **Step 2:** Add "As built in part C" to the spec; update memory; push `phone-pwa`; ask the owner to open the pull request (and merge the pending `screens-c` first).

---

## Part D: share and print (branch `share-print`, from `main` after C is merged)

Facts used below. The plan result (`PlanResult`) holds `scheduled` (`id`, `day` as days since 1970-01-01, `tech` index,
`visit`, `eta` "HH:MM", `travelMin`, `prevKm`, `why`, `flag`), `unscheduled` (`id`, `reason`), `days`, `routes`
(`day`, `tech`, `stops`, `travelMin`, `serviceMin`, `load`). `input.cases[i]` has `id`, `workType` (index) and `place`
(index); `input.places[i]` has `name`, `lat`, `lon`. `prepare()` in `src/screens/plan/planData.ts` gives `input`,
`caseIds`, `planStart`, `left`. `ChangeLogEntry` is `{ caseId, field, previous, next, reason }`. The workspace has no
customer names, so nothing built here can contain one (PRV-9).

### Task D1: Tables for export (test first)

**Files:** Create `src/share/tables.ts`, `src/share/tables.test.ts`. Modify `src/screens/plan/planData.ts` (export `isoOf`).

**Interfaces:**
- `type Cell = string | number`; `interface Table { name: string; headers: string[]; rows: Cell[][] }`.
- `buildTables(w: Workspace, p: { input: PlanInput; planStart: string; left: { hold: number; review: number; noPlace: number } }, result: PlanResult, madeAt: string): Table[]`, in this order and with these names and headers:
  1. `Schedule`: Case, Work type, Place, Date, Weekday, Technician, Visit, Arrival, Driving minutes, Kilometres, Reason, Flag.
  2. `Day routes`: Date, Technician, Visits, Stops in order, Driving minutes, On-site minutes.
  3. `Not planned`: Case, Reason (engine reasons first, then one row per held-back state: `Left out`, "N on hold" and so on).
  4. `Summary`: Item, Value (cases planned, days, technicians working, driving hours, on-site hours, first day, made on).
  5. `Change log`: Case, Field, Before, After, Reason.
- Dates are `YYYY-MM-DD` text, weekday is the English name, numbers stay numbers.

- [ ] **Step 1: Failing tests** with a small fixed plan built by `plan()` from `prepare()` (reuse `ready()` from `planData.test.ts`, copied): five tables in the order above; schedule rows follow plan order and carry names (not indices); `Day routes` stops are joined with ` > `; `Not planned` contains an engine reason and the held-back counts; `Summary` values equal `summarise()`; change log rows copy `w.changes`; an empty plan still gives five tables with headers.
- [ ] **Step 2:** Implement; export `isoOf`. **Step 3:** green, lint, type check, commit `feat(share): the five tables of a plan`.

### Task D2: CSV and the formula guard (test first)

**Files:** Create `src/share/csv.ts`, `src/share/csv.test.ts`.

**Interfaces:** `neutralise(cell: Cell): Cell` (a text cell that starts with `=`, `+`, `-`, `@`, a tab or a carriage return gets a leading `'`; numbers are untouched); `toCsv(table: Table): string` (UTF-8 byte-order mark first, `\r\n` line ends, a cell is quoted when it holds a comma, a quote, a line break or leading/trailing space, quotes doubled, formulas neutralised, header row first).

- [ ] **Step 1: Failing tests:** `=cmd|' /C calc'!A0`, `+1`, `-1`, `@SUM(1)`, a leading tab; plain text and numbers (including `-5` as a number) unchanged; quotes, commas, newlines; BOM present; a cell that is only `-` is neutralised; empty table gives only the header line.
- [ ] **Step 2:** Implement. **Step 3:** green, commit `feat(share): CSV that spreadsheets will not run as formulas`.

### Task D3: Excel file (lazy)

**Files:** Create `src/share/xlsx.ts`, `src/share/xlsx.test.ts`. Modify `package.json` (move `write-excel-file` from devDependencies to dependencies).

**Interfaces:** `toXlsx(tables: Table[]): Promise<Blob>`, importing `write-excel-file` inside the function so it is a separate chunk. Text cells go through `neutralise`; numbers are number cells; header row bold; column widths from the longest cell (capped at 60).

- [ ] **Step 1:** Read `node_modules/write-excel-file/README.md` for the multi-sheet call of version 4. **Step 2: Test** by writing the five tables of D1's fixture and reading the result back with `read-excel-file/universal`: sheet names, headers, a number stays a number, a hostile text cell comes back with its apostrophe. **Step 3:** Implement. **Step 4:** green; `npm run build` and print the chunk size (it must be its own chunk, not in the entry). Commit `feat(share): Excel export, loaded only when used`.

### Task D4: Route pack (test first)

**Files:** Create `src/share/routePack.ts`, `src/share/routePack.test.ts`.

**Interfaces:**
```ts
export interface PackStop { visit: number; caseId: string; workType: string; place: string; lat: number; lon: number; arrival: string; kilometres: number; drivingMinutes: number }
export interface RoutePack { packVersion: 1; site: string; technician: string; date: string; createdAt: string; validFor: string; stops: PackStop[] }
buildPack(site: string, input: PlanInput, result: PlanResult, tech: number, day: number, createdAt: string): RoutePack
serialisePack(p: RoutePack): string          // pretty JSON, newline at the end
parsePack(text: string): RoutePack           // throws PackError with a plain message
packFileName(p: RoutePack): string           // route-<technician>-<date>.json, lower case, letters, digits and dashes only
staleness(p: RoutePack, today: string): { past: boolean; daysAgo: number }
```
`date` and `validFor` are `YYYY-MM-DD` (the same day: a pack is valid for its own date); `createdAt` is an ISO time.

- [ ] **Step 1: Failing tests:** `buildPack` has exactly the keys above and each stop exactly the stop keys (PRV-9: no customer, no address, no notes); only that technician's stops on that day, in visit order, with names not indices; round trip `parsePack(serialisePack(p))` equals `p`; `parsePack` drops unknown fields (a pack with `customerName` shows none); rejects non-JSON ("This file is not a route pack."), another `packVersion` ("This route pack was made by a different version of the app."), missing stops, a time that is not `HH:MM`, latitude outside -90 to 90, a duplicate visit number; `packFileName` for `Asha K.` and `2026-11-22` is `route-asha-k-2026-11-22.json`; `staleness` is not past on the day, past the day after with `daysAgo: 1`.
- [ ] **Step 2:** Implement. **Step 3:** green, commit `feat(share): route pack file for one technician and day`.

### Task D5: Saved packs on the phone (test first)

**Files:** Create `src/screens/route/packStore.ts`, `packStore.test.ts`.

**Interfaces:** `addPack(list: RoutePack[], pack: RoutePack): RoutePack[]` (a pack for the same technician and date replaces the older one; newest creation first; at most 20); `removePack(list, technician, date)`; `loadPacks(store: KeyValueStore): Promise<RoutePack[]>` and `savePacks(store, list)` on the key `routePacks` of the same database (`src/workspace/db.ts`), each stored pack run through `parsePack` on load so damaged entries are dropped, not shown.

- [ ] **Step 1: Failing tests** (with `fake-indexeddb` as the workspace tests do): replace, order, cap of 20, remove, a damaged stored entry is dropped. **Step 2:** Implement. **Step 3:** commit `feat(route): keep opened route packs on the phone`.

### Task D6: Share glue, Export and Share panel, route sheet

**Files:** Create `src/share/shareFile.ts` (browser glue: `shareOrDownload(fileName, text, type)` uses `navigator.canShare({ files })` then `navigator.share`, else `downloadText`; returns `'shared' | 'downloaded' | 'cancelled'`; an `AbortError` is "cancelled"), `src/screens/plan/ShareBar.tsx`, `src/screens/route/RouteList.tsx` (the ordered stops, read-only: number, arrival, case, work type, place, kilometres, a `geo:lat,lon` link "Open in maps"), `src/screens/route/routeSheet.css`. Modify `PlanScreen.tsx`, `vite.config.ts` (coverage excludes `src/share/shareFile.ts`).

- [ ] **Step 1:** `ShareBar` under the day picker: "Export" with CSV (a file per table, named `<table>-<date>.csv`; one tap offers all five) and Excel; for the chosen day, one row per technician with a route: "Route sheet" and "Share route pack". While a plan is being recalculated the buttons are disabled.
- [ ] **Step 2:** "Route sheet" opens a preview section with the technician's name, date, site name, `RouteList`, and a Print button (`window.print()`); `@media print` hides everything except that section, black on white, no shadows.
- [ ] **Step 3:** "Share route pack" calls `shareOrDownload`; the status line says "Shared", "Saved as a file" or nothing when cancelled.
- [ ] **Step 4:** Lint, type check, commit `feat(share): export, route sheet and route pack buttons on the plan`.

### Task D7: The Route tab

**Files:** Create `src/screens/route/RouteScreen.tsx`, `route.css`. Modify `src/screens/nav.ts` (tab `route`, label "Route", last in the bar), `src/screens/nav.test.ts` if it exists, `AppShell.tsx` (lazy `RouteScreen`), `shell.css` (`.shell-nav ul` five columns), the empty Plan state (a "I have a route file" link to `#/route`).

- [ ] **Step 1:** `RouteScreen`: "Open a route file" (file input, `.json`); the newest saved pack opens by default; a list of other saved packs (technician, date); read-only `RouteList`; a notice with the creation time ("Made 21 Nov 2026 at 14:05. If the plan changed since, ask for a new file."); a warning in the warning colour when `staleness` says past; remove a saved pack (two clicks); plain errors from `parsePack`.
- [ ] **Step 2:** Five tabs fit at 360 px (each at least 48 px wide and tall).
- [ ] **Step 3:** Commit `feat(route): the Route tab opens a route pack with no connection`.

### Task D8: Verify and finish part D

- [ ] **Step 1:** In the browser on invented data: export CSV and Excel (read them back in the page: BOM, headers, a hostile case id such as `=1+1` comes out with an apostrophe); share a route pack (download fallback in the pane), open it in the Route tab of a second origin (`vite preview` port 4173, empty database), stop the server, reload: the pack is still there and opens; a pack dated yesterday shows the warning.
- [ ] **Step 2:** 360 px: no sideways scroll on any tab, every control at least 48 px; print preview shows only the sheet (`matchMedia('print')` is not available, so check the print CSS by emulating media in the tests of the class names, and by a screenshot of the section).
- [ ] **Step 3:** Full check and build; sizes (Excel chunk separate; entry still small). Spec "As built in part D"; memory; push; ask the owner for the pull request link.

## Part E: map (outline)

`src/map/project.ts` (equirectangular, fit, padding; tests: bounds, single point, same latitude, antimeridian not needed), `MapView.tsx` (SVG, base, numbered stops, line and label per technician, zoom buttons, stop list in step), placed in the Plan tab and the route sheet; lazy chunk.

## Part F: languages (outline)

`src/i18n/` (`t`, plural rule, `LocaleProvider`, `en.json`, a second language), move every screen's text into resources, `Intl` formats, `dir`, language choice in Set-up, a test that both files have the same keys and placeholders.
