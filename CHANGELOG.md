# Changelog

All notable changes. The format follows [Keep a Changelog](https://keepachangelog.com), and versions follow
[Semantic Versioning](https://semver.org). Each pull request that changes what a user sees adds a line here.

## [1.0.0] - 2026-11-22 (the version in `package.json`; no release tag has been made yet)

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
  dependency updates and a check that no personal data is committed, all in CI.
- **Guides.** `docs/phone-guide.md`, `docs/privacy.md`, `CONTRIBUTING.md`, and a guide to adding a language.

### Changed

- Planning is about 40 times faster for centres whose technicians can each do several work types: 2,000 cases and 100
  technicians took 42 s in the first version and take about one second. The plans are identical (golden files and 17
  further fingerprints agree). Plans nobody is waiting for are stopped, and the Plan screen keeps its last plan, so
  coming back to it is instant when nothing changed.
- **Delete all my data** also removes the route files opened on the device.

### Fixed

- A technician's marker on the map no longer carries the whole name when names differ only by a number ("Technician 01",
  "Technician 02"): labels are at most three letters, and a spare letter (A, B, C) tells the rest apart.
- Accessibility findings from an audit of every screen in English, Hindi and a right-to-left test language, light and
  dark, down to 320 px: the day bars are a picture with a real "Show stops" button, markers' names start with their
  visible label, two contrast shortfalls in light mode, the route stop number, and the keyboard bypass.

### Known limits

- Not yet tried on a real Android phone (Chrome, Samsung Internet, Firefox), with TalkBack, or on an iPhone.
- The engine's reasons ("Skill match …") are English; translating them needs the reference engine to give codes.
- The "Longest trip" setting is accepted and saved but the planner does not use it yet.
- Planning has been timed only on a laptop: 5,000 cases and 200 technicians take about 18 s there and 10,000 cases and
  300 technicians about 100 s, so a phone will be slower for the largest centres.
- No street-map background and no clicking the map to correct a place.
