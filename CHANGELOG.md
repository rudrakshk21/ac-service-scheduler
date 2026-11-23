# Changelog

All notable changes. The format follows [Keep a Changelog](https://keepachangelog.com), and versions follow
[Semantic Versioning](https://semver.org). Each pull request that changes what a user sees adds a line here.

## [1.2.3] - 2026-11-23

### Fixed

- **Stops at the same place were drawn on top of each other on the map**, so only one could be seen or tapped. Cases take
  their coordinates from places, so this was the usual case with real data, and was a known limit of 1.0. The markers of
  stops at one place are now set side by side on a ring (the first on the left, the rest clockwise, so they read in
  order), and markers that are merely close are pushed apart until they no longer overlap. A small dot marks the true
  place, joined to the marker by a thin line, and a line under the map says so. Markers that were already apart do not
  move, no marker moves further than three marker widths, and markers stay inside the frame (the spreading takes the
  edge into account, so a cluster at the edge is not squeezed). It is worked out in screen pixels, so zooming in separates
  places that are different. A very crowded map (over 1,000 markers) gets fewer passes and stays as it was where there is
  no room: zoom in. The route lines still go to the true places.
- Measured: a day of 13 stops at 6 places on a phone-sized map went from markers 27 px apart (overlapping) to 40 px
  (the least) with every marker inside the frame and tappable; the work takes about 20 ms for 300 markers and 60 to 80 ms
  for 2,400 on a laptop.

## [1.2.2] - 2026-11-23

### Fixed

- **Open in maps did nothing on a computer.** The link was a `geo:` link, which only an Android phone opens; Windows (checked
  on Windows 11: no `geo:` handler is registered) and macOS have none, so a click was dropped silently. On a computer and on
  an iPhone it is now Google's Maps URL, opened in a new tab, with a pin at the stop's coordinates. On Android it is the
  same `geo:` link as before (it was confirmed on a phone). The web link carries the coordinates only, not the case number.
  It needs a connection. The privacy statement and the phone guide say so.

## [1.2.1] - 2026-11-22

A check of a centre with 300 technicians (the owner's target size), and the numbers it gave.

### Changed

- The Plan screen's note about a large set now appears above **300** technicians (it was 100), because 300 was measured:
  on a laptop, planning 2,000 cases takes about 2.1 s and 3,000 cases about 3.7 s even when every technician can do every
  case (about 0.5 s and 1.1 s when each has one skill); 300 report files open in about 0.14 s in the browser; a month of
  their reports (72,000 records, 14.7 MB) is written to the browser's storage in about 55 ms and read back in 65 ms. The
  screens (board, share list, map, report panel) were tried at 300 technicians and 2,400 cases in the browser. 1,000
  technicians are still not covered (planning 2,000 cases took 18 s), and nothing was timed on a phone.
- The measurement is kept in the repository: `VITE_MEASURE_SPEED=1 npx vitest run src/workspace/scale.measure.test.ts`.

## [1.2.0] - 2026-11-22

Retention of finished work (requirement PRV-4): an option to remove finished cases and old reports after a time you choose.
It is **off by default**, so nothing changes unless you choose a time.

### Added

- **Keep finished work for** (Set-up, Your data and files): until I delete it (the default), 30 days, 90 days, 180 days
  or 1 year. Choosing a time shows how many finished cases there are and how many reports would be removed right away,
  and asks you to confirm; switching it off needs no confirmation and removes nothing.
- When on, a finished case (done, or no longer in the export) is removed more than the chosen time after the first day the
  app saw it finished (for cases already finished, from the day you chose); a report is removed by the day of its
  route; the change-log lines of a removed case go with it. If the app is opened after the time has passed, a notice
  says what was removed and stays until dismissed.
- The privacy statement, the in-app privacy text and the phone guide describe what it removes, what it does not (backups
  and files already saved or sent, other devices, technicians' phones) and the catch: a case that your system still lists
  as open comes back as a new case at the next import after it has been removed here.

### Known limits

- Not applied to a technician's phone; there removing a route removes the entries for it, and at most 20 routes are kept.
- The date a case was finished is the day the app first saw it so, not the date in your system.

## [1.1.0] - 2026-11-22

Visit reports: the technician says how each visit went, and the coordinator reads it against the plan. No server and
no account: the report is a small file that travels the way the route pack does.

### Added

- **Report a visit (Route tab).** Under each stop: *Done*, *Partly done* or *Not done*; a reason when it was not wholly
  done (customer not there, no access, part missing, no time, other); the time it was finished (filled in with the
  time now); and remarks of up to 500 characters, with a warning not to write customer names or phone numbers. What is
  entered is saved on the phone at once and survives closing the app, and it works with no connection.
- **Send report.** Makes a `report-<technician>-<day>.json` file and offers it to the phone's share sheet (as plain
  text first, like the route pack), or saves it. It can be sent again after a change.
- **Reports from technicians (Plan tab).** Opens many report files at once and reads them against the plan of the
  chosen day: visits reported, done, partly done and not done; the visits not wholly done with their reason and remark;
  the technicians who have not reported. A file that cannot be used is listed with the reason and the rest are read.
  Opening a file twice changes nothing, and the newest report of a case wins whatever order the files are opened in.
- **Mark reported done as done.** Marks the cases reported *Done* as done in the workspace, so the next plan does not
  visit them again. Nothing is marked until the coordinator presses it.
- **A sixth table, Reports from technicians,** in the Excel and CSV exports, with the same guard against spreadsheet
  formulas. Reports are in backups.
- Hindi text for all of it (a draft, like the rest).

### Changed

- **Remove** of a saved route on the phone also removes what was entered for it, and the confirmation says so.
- **Delete all my data** also removes the visit reports, and what technicians entered on the phone.
- The privacy statement, the notice in the app and the phone guide describe the reports, and say plainly that remarks
  are free text that the app cannot check.

### Known limits

- Tried in Chrome on a computer (320 px, light and dark, English and Hindi, an accessibility audit with no findings),
  not yet on a real phone. The share sheet may refuse `.json` and `.txt` for the report as it did for the route pack;
  the file is then saved to Downloads.
- A report is not tied to the version of the plan it was made for. If the plan is made again after a technician has
  reported, reports of cases that are no longer in the plan of that day are counted separately.
- No photos, signatures or customer confirmation. A live feed of reports (no files) needs a server and is a later
  release.

## [1.0.0] - 2026-11-22

The first complete release: a planner that runs in the browser for any service centre, works offline, and can send a
technician their day.

### Added

- **Planning engine** (TypeScript, in a Web Worker), a port of a validated Python reference and proven identical to it
  by 28 golden files. Skills, working hours per technician, start and end places, leave and holidays, priority levels,
  due dates, time by product type, manual and kept assignments. A reason for each choice, and for each case not planned.
- **Data intake.** CSV, Excel (`.xlsx`) and JSON files from any system, with encoding, delimiter and header row
  detected. Columns are matched once and the matching is remembered; the words a file uses (work types, statuses) are
  matched too; every file problem is a plain message. Personal columns are left unmapped unless chosen. Templates in the
  app's own field names.
- **Screens.** Plan (board, day picker, reasons, cases not planned), Data (cases, problems, imports), Import (four
  steps), Set-up (nine sections: centre, rules, work types, skills, priorities, places, technicians, holidays, files and
  data), and Route.
- **Phones.** Installable, works with no connection after one visit, an update banner that never reloads by itself, a
  reminder to save a backup, 48 px touch targets.
- **Sharing.** A route sheet to print or save as PDF, a route pack file per technician per day (no customer details),
  Excel and CSV exports of five tables, with a guard against spreadsheet formulas. The Route tab opens a pack offline,
  warns when it is out of date, and links each stop to the maps app.
- **Map.** A schematic map of the day's routes, true to scale, with a labelled marker for each stop, zoom and pan, no
  network needed.
- **Languages.** English and a Hindi draft (to be read by a native speaker); a new language is a JSON file. Right-to-left
  layouts, `Intl` dates and numbers.
- **Safeguards.** A content security policy and other security headers; an error screen that offers a backup instead of
  a blank page; "Skip to content"; a size budget (first download 300 KB), a check for known vulnerabilities, weekly
  dependency updates and a check that no personal data, key or token is committed, all in CI.
- **Limits on files.** A file is refused above 20 MB or 50,000 rows, with a message that says what to do. Files are read
  and the mapping applied in a worker, so a large file shows "Checking the file…" instead of freezing the screen.
- **Limits stated.** For a centre larger than 2,000 cases, 100 technicians or 30 days (the size the app was measured at),
  the Plan screen says so and warns that planning can take much longer, most of all on a phone.
- **A privacy notice in the app** (Set-up, Your data and files): what is kept, where, for how long and who can see it.
- **Guides.** `docs/phone-guide.md`, `docs/privacy.md`, `CONTRIBUTING.md`, and a guide to adding a language.
- **MIT licence.**
- **For testing.** `npm run sample-data` writes invented sample files of any size, and `docs/phone-test-report.md` is
  the form for the real-phone test (scenarios W, X, Y and S).

### Changed

- Planning is about 40 times faster for centres whose technicians can each do several work types: 2,000 cases and 100
  technicians took 42 s in the first version and take about one second. The plans are identical (golden files and 17
  further fingerprints agree). Plans nobody is waiting for are stopped, and the Plan screen keeps its last plan, so
  coming back to it is instant when nothing changed.
- **Delete all my data** also removes the route files opened on the device.
- Reading a file and applying its mapping moved off the interface thread: on a 50,000-row file the longest block of the
  screen went from 5.2 s to 0.3 s (measured on a laptop).

### Fixed

- A technician's marker on the map no longer carries the whole name when names differ only by a number ("Technician 01",
  "Technician 02"): labels are at most three letters, and a spare letter (A, B, C) tells the rest apart.
- Accessibility findings from an audit of every screen in English, Hindi and a right-to-left test language, light and
  dark, down to 320 px: the day bars are a picture with a real "Show stops" button, markers' names start with their
  visible label, two contrast shortfalls in light mode, the route stop number, and the keyboard bypass.

- **Found on the first real-phone test (iQOO Z6 5G, Android 14, Chrome 157):** *Open in maps* dropped no pin (a bare `geo:` link only centres the map; it now carries `q=lat,lon(label)`); and *Share route pack* went straight to a download because Chrome on Android does not let `.json` through the share sheet (the pack is now offered to the share sheet as plain text first, and the Route tab opens `.txt` files too).

### Known limits

- Tried on one real phone (iQOO Z6 5G, Android 14, Chrome 157): install, offline, import, route pack, storage and layout passed (`docs/phone-test-result-2026-11-22.md`). Not tried: Samsung Internet, Firefox, TalkBack, an iPhone, a second phone for the route-pack hand-over, and the 4G first-load time (measured on Wi-Fi and 5G, without a stopwatch figure).
- *Share route pack* saves the file on the phone tested (Chrome on Android refused both `.json` and plain text through the share sheet, though CSV exports do open it); the file is then attached from Downloads.
- The engine's reasons ("Skill match …") are English; translating them needs the reference engine to give codes.
- The "Longest trip" setting is accepted and saved but the planner does not use it yet.
- Planning has been timed only on a laptop: 5,000 cases and 200 technicians take about 18 s there and 10,000 cases and
  300 technicians about 100 s, so a phone will be slower for the largest centres.
- No street-map background and no clicking the map to correct a place.
- Stops at exactly the same place (several visits to one building) are drawn on top of each other on the map, so only the last one's label shows; the stop list shows them all.
- Excel files cannot go through the share sheet of Chrome on Android; they are saved to Downloads.
- A retention period for closed cases (proposed in the requirements) is not built: closed cases stay until deleted.
- The limit on a file is its size on disk; an .xlsx is a zip, and what it holds when unpacked is not limited.
