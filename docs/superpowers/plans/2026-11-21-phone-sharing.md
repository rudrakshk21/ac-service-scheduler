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

## Part D: share and print (outline; detailed plan written when C is merged)

1. `src/share/tables.ts`: five tables from workspace and plan result; tests with fixed rows.
2. `src/share/csv.ts`: encode, BOM, CRLF, quote, SEC-5 apostrophe; tests incl. `=cmd`, `+1`, `-1`, `@x`, quotes, commas, newlines.
3. `src/share/xlsx.ts` (lazy `write-excel-file`, move it to dependencies; check the chunk size); test the cell values through `read-excel-file` round trip.
4. `src/share/routePack.ts`: `buildPack`, `serialisePack`, `parsePack`, `staleness`; PRV-9 test that no field outside the allowed list can appear; stale after the valid-for date and when the plan changed (pack carries a plan fingerprint).
5. Export and Share panel in the Plan tab (export menu, per-technician "Share route pack" through `navigator.share` with a file, download fallback; "Print route sheet").
6. Route sheet (print CSS) and the Route tab (open a pack, saved packs in IndexedDB key `routePacks`, stale warning, `geo:` links); five tabs on the bar; verify at 360 px, offline.

## Part E: map (outline)

`src/map/project.ts` (equirectangular, fit, padding; tests: bounds, single point, same latitude, antimeridian not needed), `MapView.tsx` (SVG, base, numbered stops, line and label per technician, zoom buttons, stop list in step), placed in the Plan tab and the route sheet; lazy chunk.

## Part F: languages (outline)

`src/i18n/` (`t`, plural rule, `LocaleProvider`, `en.json`, a second language), move every screen's text into resources, `Intl` formats, `dir`, language choice in Set-up, a test that both files have the same keys and placeholders.
