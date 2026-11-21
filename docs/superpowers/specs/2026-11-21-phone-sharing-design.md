# Phone, map and sharing: design

Piece 4 of 5 (engine, data intake, screens, **phone, map and sharing**, hardening). Written 2026-11-21 under the
owner's autopilot delegation; every decision below can be reversed. Requirements: v4.1 sections FR-16.3, FR-18, FR-19,
FR-20, FR-28, PRV-9, SEC-5, NFR-3, NFR-19, risks R-9 and R-17 to R-19.

## 1. Purpose

Make the planner usable by a technician on an own Android phone with no signal, and let the coordinator get the plan
out of the app: installable and offline, exports, printable route sheets, a route pack file per technician per date, a
map of the day's routes, and a second interface language. Still no server, no account, no cost.

## 2. Decisions

| Question | Decision |
|---|---|
| How is the work split? | Four pull requests, in this order: **C** installable and offline; **D** share and print (exports, route sheet, route pack, Route tab); **E** map; **F** languages. Each leaves the app working and is verified live before the next. |
| Service worker | Hand-written, about 60 lines, plus a small Vite plugin that lists the built files and a content hash into it. No Workbox or PWA plugin: fewer dependencies, a smaller download, and the logic is testable in Node. |
| What is cached | Every built file (pages, scripts, worker, fonts, templates, icons) at install. The app makes no network requests of its own, so after one visit it runs fully offline (FR-16.3). A page request that is not a file falls back to `index.html`. |
| Updates | A new version waits. A banner says "A new version is ready" with a Reload button. The page never reloads by itself, so an import in progress is not lost. |
| Install | Manifest with name, colours, standalone display and PNG icons 192 and 512 (plus maskable). An Install button in Set-up when the browser offers it. A short manual guide for Samsung Internet and Firefox (R-19). |
| Storage | Ask the browser to keep the data after the first import. Remember the time of the last backup in the workspace; a quiet notice appears after 14 days without one (R-6 is high likelihood). |
| Touch size | 48 px minimum for every control (FR-28.3 proposes 48; the app used 44). |
| Export formats | CSV (UTF-8 with a byte-order mark and CRLF so Excel reads it) and Excel (`write-excel-file`, loaded only when used). Five tables: schedule, day routes, exceptions, summary, change log. Text cells that start with `=`, `+`, `-` or `@` get a leading apostrophe (SEC-5). |
| Route sheet | A print-styled page per technician per date. "Print" uses the browser's print dialog, which on Android also offers "Save as PDF". No PDF library. |
| Route pack | One JSON file per technician per date with only what PRV-9 allows: site name, date, creation time, valid-for date, and the ordered stops (case, work type, place, coordinates, arrival, kilometres from the previous stop). The app holds no customer names, so a pack cannot contain one. Shared through the Android share sheet when available, else downloaded. |
| Opening a pack | A fifth tab, **Route**: choose a pack file, see it read-only, with each stop's "Open in maps" link (`geo:` address, works offline) and a warning when the pack is older than its valid-for date or the day has passed. Opened packs are kept on the phone so they open again without the file. |
| Map | A schematic map drawn in SVG from the coordinates: base, numbered stops, a line per technician, a colour and a label (not colour alone) per technician, zoom buttons. Needs no network. A tile background is optional and only through a tile address the site sets (R-9); none is built in. |
| Languages | Own small `t(key)` with resource files in JSON, `Intl` for dates and numbers, `dir` for right-to-left, logical CSS properties. A second language proves that none needs code. The draft translation is marked for review by a native speaker. |
| Budget | NFR-3: the first download stays at most 300 KB compressed (about 69 KB now). The Excel writer and map load on demand. |

## 3. Pull request C: installable and offline

Files: `public/manifest.webmanifest`, `public/icons/*.png`, `public/_headers`, `tools/make_icons.py`,
`vite-plugins/precache.ts`, `sw/sw.js` (the template), `src/pwa/register.ts`, `src/pwa/usePwa.ts`,
`src/screens/UpdateBanner.tsx`, `src/screens/BackupNotice.tsx`, workspace field `lastBackupAt`.

- `sw.js` is served with `Cache-Control: no-cache` (`_headers`), so a new version is found on the next visit.
- The cache name carries the content hash; activation deletes older caches.
- Registration only in production builds, after the page has loaded.
- Checks: the plugin and the worker's logic are tested in Node (the template runs against a stub of `caches` and
  `fetch`); in the browser: manifest valid and icons load, worker active, and a built copy served by `vite preview` still
  opens after the server is stopped.

## 4. Pull request D: share and print

Files: `src/share/tables.ts` (rows from a plan), `csv.ts`, `xlsx.ts` (lazy), `routePack.ts`, `routeSheet`
(component and print CSS), `src/screens/route/*` (Route tab), an Export and Share panel in the Plan tab.

- Pure functions build the five tables from the workspace and the plan result; the same rows feed CSV and Excel.
- `routePack.ts`: `buildPack(plan, technician, day)`, `serialisePack`, `parsePack` (rejects other versions and
  damaged files in plain words), `staleness(pack, today)`.
- The Route tab is the technician's home: no setup, no planning, read-only.

## 5. Pull request E: map

`src/map/project.ts` (equirectangular projection with latitude scaling, fit to bounds), `MapView.tsx` (SVG),
shown under the day picker in the Plan tab and in the route sheet. Stops list and map stay in step (tap a stop, it is
highlighted on the map).

## 6. Pull request F: languages

`src/i18n/` (`t`, plural rule, locale provider, `en.json`, a second language), every screen's text moved into
the resource, display of dates, times and numbers through `Intl`, `dir="rtl"` for right-to-left languages, a
language choice in Set-up. A test fails when a key exists in one language and not the other.

## 7. Out of scope here

Live route with completion updates (release 2, FR-21.3); a tile background with a built-in provider; clicking the map
to correct a place (FR-26.3, later); several workspaces (FR-24.5); a real PDF file; a store listing. Owner tasks that
remain: try the install on the reference phone (PD-9) and on Samsung Internet and Firefox (AC-31, R-19).

## 9. As built in pull request C

- **Worker and plugin as designed.** `vite-plugins/precache.ts` lists the finished build (36 files), hashes them into a
  version and writes `dist/sw.js` (3.2 KB) from `vite-plugins/sw-template.js`. Both are tested in Node (17 tests; the
  worker runs against a stand-in for the browser's cache and network). The first download is 70.1 KB compressed.
- **Two faults found by trying it, fixed with a test first.** Stopping the server and reloading the built app showed the
  page but no scripts: a module script is requested with an `Origin` header and the server's files say `Vary: Origin`, so
  the cache did not match its own copy. Matching now ignores `Vary`. The test stand-in now enforces `Vary` so the failure
  is reproduced. Second, the fallback for an unknown page address uses `/`, not `/index.html`, because a host may
  redirect `/index.html` and a redirected answer cannot open a page.
- **Verified on the built app (localhost, Chrome in the app's browser pane):** worker active, all files cached; server
  stopped and page reloaded: data, all four tabs, fonts, and a technician switch (re-plan in the worker) work with no
  network; the update banner appeared for the corrected worker and Reload switched to it; manifest and the three icons
  load with the right sizes and types.
- **Install and storage.** Set-up has "Install the app" when the browser offers it, and steps for Chrome, Samsung
  Internet, Firefox and Safari when it does not. After an import the browser is asked to keep the data (Chrome in the
  test pane declined; that is the browser's decision). The workspace keeps `lastBackupAt`; a notice offers a backup after
  14 days. "Save a backup" now records the day.
- **Touch size.** Every control is at least 48 px; the date and time inputs in Set-up were 29 px and were fixed.
  Checked at 360 px on every tab: no sideways scroll.
- **Not done here (owner):** install on the reference phone and on Samsung Internet and Firefox (AC-31, R-19); the live
  site's headers (`_headers`) are checked after the merge.

## 8. Finish line

- C: the built app opens offline after one visit; installs from Chrome on Android; a new build shows the update banner.
- D: a plan exports to CSV and Excel that Excel opens without running any cell; a route pack shared from one browser
  opens in another with no network and says when it is out of date.
- E: the day's routes appear on a map at 360 px without sideways scroll.
- F: switching the language changes every visible word and mirrors the layout for right-to-left.
- Tests, lint, type check and build pass; checks green on GitHub; the live site verified after each merge with real controls.
