# Visit reports: design

A technician says, on their own phone, whether each visit of the day was done, with a time and remarks. The report goes back
to the planner as a small file, the way route files go out. No server, no account, no running cost. Written 2026-11-22
after the owner chose the "completion file" over a live feed; the scope and the defaults below were approved in chat. A live
feed (release 2) can send the same record later.

## 1. Purpose and limits

The head of the service centre sees, next to the plan, which visits were done, which were not and why, and what the
technicians wrote, without anybody typing a result in by hand. Not live: a report is as fresh as the file that carries it.
Works with no connection on the phone; the file is sent when there is one.

Sized for **300 technicians** (the owner's target): at that size the hand-over must not mean 300 manual steps on the planner's
side, so reports are imported many files at a time. At 1,000 technicians planning itself is slow (measured: 2,000 cases in
18 s, 5,000 in 52 s on a laptop) and sending files by hand stops being sensible; that case belongs to the live feed.

## 2. Decisions

| Question | Decision |
|---|---|
| What does a technician report, per visit? | A status: **Done**, **Partly done** or **Not done**; for the last two a reason (customer not there, no access, part missing, no time, other); the time finished (`HH:MM`, default now); free-text remarks, at most 500 characters. No photos (too big for a file). |
| Where on the phone? | The **Route** tab, under each stop of the opened route. Three buttons, then the details. Saved on the phone as it is typed (IndexedDB key `reports`), so it survives closing the app and works offline. |
| How does it go back? | A **Send report** button makes one file for the route (`report-<technician>-<date>.json`) and offers it to the share sheet, else saves it to Downloads, exactly like a route file (the share sheet refused `.json` on the first test phone; the fallback is the working path). Plain text `.txt` is also offered, and read. |
| The file | `reportVersion`, `site`, `technician`, `date`, `createdAt`, `visits[]` of `{caseId, status, reason?, finishedAt?, remarks?}`. Read with a whitelist: anything else in the file is dropped. At most 200 visits, 500 characters of remarks, 256 KB per file. |
| Planner side | On the **Plan** tab, a new panel under *Share and export*: **Open report files** takes many files at once. Records are kept in the workspace (`reports`), merged by case and date: the newer file wins. Shown for the chosen day: how many visits are reported, done, partly, not done; the visits that were not done or partly (reason and remarks); technicians who have not reported. |
| Exports | A sixth table, **Reports from technicians**, in the Excel file and as CSV (the formula guard of SEC-5 covers remarks). |
| Does a report change the plan? | Not by itself. A button, **Mark reported done as done**, sets the "done" mark on every case reported done, so the next plan does not visit it again. Partly done and not done stay in the plan. |
| Privacy | Remarks are free text: a technician could type a customer's name or phone number. A warning sits above the box ("Do not write customer names or phone numbers"), `docs/privacy.md` says so, backups hold the reports, and *Delete all my data* removes them on both sides (the planner's workspace and the phone's saved reports). The route pack is unchanged: still no customer details. |
| Not built here | Live updates, photos, signatures, a report that changes a case's work type or time, reminders to technicians, per-technician statistics. |

## 3. The records

```
ReportFile { reportVersion: 1, site, technician, date: 'YYYY-MM-DD', createdAt: ISO, visits: Visit[] }
Visit      { caseId, status: 'done' | 'partly' | 'not_done', reason?: Reason, finishedAt?: 'HH:MM', remarks?: string }
Reason     'customer_absent' | 'no_access' | 'part_missing' | 'no_time' | 'other'
```

The workspace keeps `reports: StoredReport[]`, a `Visit` plus `date`, `technician` and `reportedAt` (the file's
`createdAt`). Key: case and date. An older workspace without the list reads as an empty list. Reasons are codes, so they
translate; remarks are the person's own words.

## 4. Pieces

1. `src/share/report.ts`: the types, building a file from the phone's entries, `serialiseReport`, `parseReport` (strict, plain
   messages naming the visit), `reportFileName`, `REASONS`.
2. `src/screens/route/reportStore.ts`: the phone's saved entries (load, save, change one visit, clear), pure helpers.
3. `src/workspace/reports.ts`: `mergeReports`, `reportsOfDay` (the day's summary against a plan), `markReportedDone`, `clearReports`;
   the `reports` field of `Workspace`.
4. `buildTables`: the sixth table and its file name.
5. Route tab: the report controls per stop and the *Send report* button.
6. Plan tab: `ReportsPanel` (import many, day summary, problems, not yet reported, *Mark reported done*, *Remove reports*).
7. Messages in English and Hindi (a draft), `docs/privacy.md`, `docs/phone-guide.md`, `CHANGELOG.md`, version 1.1.0 (no tag).

## 5. Checks

- Tests first for every pure piece: building and reading a file (every refusal, the whitelist, the limits), the merge (new, updated,
  unchanged, older file does not overwrite, same-day files from two technicians), the day summary, the export table.
- In the built app: fill in a route on a phone-sized screen, send, import the files on the Plan tab, see the summary; with a
  violation listener (the content security policy); an accessibility pass (axe) on the new controls; 320 px with no sideways scroll.
- The real phone: the owner tries it (the report goes through Telegram or Downloads like a route file).

## 6. Finish line

A technician can report a route offline and send the file; the planner opens many files and sees the day's results next to the
plan, exports them, and can mark done cases done; nothing leaves the device except by the file the person chooses to send.

## 7. As built

All seven pieces are built. Where the build differs from the plan above, or settles something the plan left open:

- `reportsOfDay` became `daySummary(reports, date, planned)`; it also returns the technicians who have not reported and the
  reports of the day that are not in its plan (`other`: done cases marked done and planned again, or cases moved).
- Files are merged in the order of their `createdAt`, and for one case the newer `reportedAt` wins whatever the order, so the
  result does not depend on the order the files were picked in. The same file twice counts as *already known*.
- The Route tab reports a stop by pressing a status; pressing the chosen status again takes the report back. The time
  defaults to now; a reason is offered only for *Partly done* and *Not done* and is dropped from a *Done* visit.
- The phone keeps at most 20 routes' entries. Removing a saved route removes its entries (and says so); *Delete all my data*
  removes all of them. This was not in the plan; without it remarks would stay on the phone with no way to delete them.
- *Send report* hands the file to the share sheet as `.json`, then as `.txt` (text/plain), then downloads it, the same ladder
  as the route pack, because Chrome on Android refused `.json` on the test phone. The Plan tab opens both.
- Messages use plural forms (`tn`) wherever a count can be one. The remark is shown in quotation marks in the problems list so
  it reads as the technician's own words in any language.
- Checked in the built app at 320 px in light and dark, English and Hindi, with an axe audit of the Plan panel and the Route
  controls (no findings) and a content-security-policy listener (no violations). Not yet tried on a real phone.
