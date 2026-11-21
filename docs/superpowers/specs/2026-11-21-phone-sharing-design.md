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

## 10. As built in pull request D

- **Tables.** `buildTables` gives Schedule (sorted by date, technician and visit, with names and a weekday), Day routes
  (empty routes left out), Not planned (the planner's reasons, then every held-back case with its state), Summary and
  Change log. One module feeds CSV and Excel. CSV has a byte-order mark and CRLF; the formula guard (SEC-5) also covers a
  leading tab or carriage return and is applied to headers. The Excel writer (`write-excel-file`, now a dependency)
  loads on demand; the first download stays at 70.25 KB compressed.
- **Route pack.** Exactly `packVersion, site, technician, date, createdAt, validFor, stops`, and per stop `visit, caseId,
  workType, place, lat, lon, arrival, kilometres, drivingMinutes`. `parsePack` rebuilds the pack from those fields only,
  so a file with a customer name or address shows neither; it refuses another version, bad times, bad coordinates and
  repeated visit numbers, naming the stop. A pack is valid for its own date and shows a warning from the day after.
- **Plan tab.** A "Share and export" panel under the board: per technician of the chosen day "Route sheet" and "Share
  route pack" (share sheet, else download), "Excel file, all tables", and CSV one table at a time.
- **Route sheet.** Print styles only: the print dialog shows just the sheet, black on white, one stop never split over a
  page. On Android the print dialog offers "Save as PDF". A generated PDF file (FR-28.6 names it) is not built; sharing
  the route pack covers the "or".
- **Route tab (fifth).** Opens a pack read-only with stops, arrival, distance and an "Open in maps" link (`geo:`
  address). Packs are kept in IndexedDB (key `routePacks`, newest first, 20 at most, same technician and day replaced),
  removed with two clicks. Verified: a pack made by the Share button on one origin was opened on a clean second origin,
  the server was stopped, the app reopened from its cache and showed the route.
- **Checked at 360 px:** no sideways scroll on Plan or Route, every control at least 48 px, five tabs of 64 x 48 px.
- **Noticed, not done.** The sheets and packs carry the centre's name, which is "New site" until someone renames it in
  Set-up; places made from coordinates read as `12.93000,77.66000`. Opening a pack straight from a messaging app (a
  share target in the manifest), the open data format export (FR-27.3) and the route sheet map (part E) are later.

## 11. As built in pull request E

- **Where and what.** `src/map/project.ts` (projection, scale bar, zoom and pan: pure, tested), `layers.ts` (the routes
  to draw from a plan or a route pack, and short different labels: pure, tested; 29 tests), `MapCanvas.tsx` (SVG),
  `map.css`. The map is its own lazy chunk (2.5 KB compressed); the first download stays at 70.25 KB.
- **Drawing.** North up, distances true in both directions (a degree of longitude is shortened by the cosine of the
  middle latitude), a scale bar with a round length. The base is a diamond; each stop is a marker labelled with the
  technician's letter and the visit number ("A1", "B3"), so a route is never told apart by colour alone; a solid line
  joins the stops and dashed legs run from the start place (or the base) and back. Eight technician colours, separate
  from the work-type colours of the board, with light and dark values.
- **Using it.** Zoom buttons (to 8x) or `+`, `-`, `0` and the arrow keys when the map has focus; drag to pan once zoomed
  (at the whole map a drag still scrolls the page); tap or press Enter on a stop to see its case, time and place.
- **Phone size.** Sizes are set in screen pixels from the measured width, not in drawing units: at 360 px wide a marker is
  30 px across with a 48 px tap area, and the sizes do not change when zoomed. The width is read when the map appears
  and kept up to date with a `ResizeObserver`.
- **Placed in three places.** Under the board on the Plan tab; on the Route tab from the pack's coordinates (the pack
  has no base, so only the stops and their line, offline); on the printed route sheet (zoom buttons are not printed).
- **Not built.** A street-map background (R-9 says the tile address is a site setting; none is built in and no provider is
  used); clicking the map to correct a place (FR-26.3). A dense cluster can hide the "Base" label behind a marker; the
  label has a halo and zooming separates them.
- **Verified.** In the browser at 360 px: 9 markers for 9 visits, no overlap, no sideways scroll, zoom limits, tap
  details, drag and keyboard pan, reset. A hidden browser pane does not run frame callbacks, which showed that sizes must
  not depend on `ResizeObserver` alone; the width is now measured at once.

## 12. As built in pull request F

- **Mechanism.** `src/i18n/`: `t(key, values)` and `tn(key, count, values)` look a key up in the chosen language and fall
  back to English; keys are typed from `en.json`, so a misspelt key is a compile error. Messages fill `{name}`
  placeholders; plural forms come from `Intl.PluralRules` (`key.one`, `key.other`, and for Arabic-like languages `zero`,
  `two`, `few`, `many`). Dates, times, numbers and "a, b or c" lists are written by `Intl` in the language in use.
- **Choosing.** The address (`?lang=hi`), a saved choice, the browser's language, English, in that order. A select in the
  header changes it, sets `lang` and `dir` on the page, saves the choice and starts the screens again. The choice is a
  per-device preference kept in `localStorage`, so a technician's phone needs no workspace.
- **What moved.** 742 messages cover the shell, the Plan tab and board, the demo, the Data tab, the four import steps,
  every Set-up section and refusal, the Route tab, the route sheet, the map, the share panel, the table names and headers
  of an export, the messages about route files, and the messages of the intake library (file errors, column-match reasons,
  problem details, site and mapping file checks) and the workspace. English output is word for word what it was.
- **Languages.** English, and a Hindi draft with every key (written by the assistant; `"draft": true` in the list until a
  native speaker reads it). Two test languages are made from the English text: `xa` (accented, a third longer) and `xb` (a
  right-to-left script). Every letter in them is replaced, so text that never went through `t()` is visible.
- **Adding a language needs no code.** `xx.json` next to `en.json` and one line in `languages.json`; the file is found by
  name and loaded only when chosen (Hindi is a separate chunk of 13.6 KB compressed). A test lists any key that a language
  lacks or has extra, any placeholder it drops, and any empty message. Contributor guide: `src/i18n/README.md` (DL-12).
- **Right to left.** Physical `left`/`right` CSS became logical properties; grid and flex mirror by themselves; the board's
  timeline and the switch thumb mirror; the map and its labels stay as drawn.
- **Verified at 360 px** in English, Hindi, `xa` and `xb`: no sideways scroll on any tab, every control at least 48 px
  (checked in `xa` and Hindi); in `xb` the tab bar, the day picker, the timeline and the lanes run right to left. A scan of
  the accented language over every tab found no interface text outside the files; what remained in English is the user's own
  data (names, case numbers, work-type names), date formats, and the language chooser's own names.
- **First download** is now about 89 KB compressed (it was about 76): the English messages are in it.
- **Not translated, and why.** The planner's reasons for each choice ("Skill match (...); adds 6 min detour; route of 4 stops
  in South-East") and its rejection of invalid input come from the engine as finished English sentences, and the golden files
  fix them. Translating them needs the engine to give codes and values instead (a change to the reference engine, which needs
  the owner's approval first). The starter work types, skills and priority levels ("Installation", "Normal") are the site's
  data and are created in English. The reasons stored in the change log ("import", "missing from import") are stored values.
  The "suggested action" strings of the intake library are not shown anywhere.
- **Against AC-30.** A second language and a right-to-left test language exist and the layout holds; "no text stays
  untranslated" is true for the interface but not for the engine's reasons, until the engine gives codes.

## 8. Finish line

- C: the built app opens offline after one visit; installs from Chrome on Android; a new build shows the update banner.
- D: a plan exports to CSV and Excel that Excel opens without running any cell; a route pack shared from one browser
  opens in another with no network and says when it is out of date.
- E: the day's routes appear on a map at 360 px without sideways scroll.
- F: switching the language changes every visible word and mirrors the layout for right-to-left.
- Tests, lint, type check and build pass; checks green on GitHub; the live site verified after each merge with real controls.
