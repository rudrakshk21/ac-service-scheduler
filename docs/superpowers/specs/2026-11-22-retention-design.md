# Retention of finished work: design

Requirement PRV-4 (should): a period after which closed cases are removed. Release 1.0 left it out; closed cases stay until
the person deletes them. This adds it as an option that is off by default.

## 1. Purpose and limits

- Data minimisation. Finished cases, and the reports and change-log lines about them, are the data a centre has least reason
  to keep; some of it may carry personal columns the person chose to map (address, notes) or free-text remarks.
- Off by default: nothing changes for a person who does not touch the setting. No deletion ever happens that the person did not
  choose, saw the size of, and was told about afterwards.
- Out of scope: the technician's phone (its route files and entries are already bounded to 20 routes and removable one by
  one, and removing a route removes its entries), the import history (file names and counts), holidays, set-up.

## 2. Decisions

| Question | Decision |
|---|---|
| Where is the setting kept? | In the workspace (`retentionDays`), not in the site file: it is a choice about this browser's data, not about the centre, and a site file shared between computers must not delete another computer's data. |
| What can the person choose? | Until I delete them (default), 30, 90, 180 days, 1 year. A fixed list: easy to explain, easy to test, no 0 or 1-day trap. |
| What is "finished"? | A case whose state is `done` or `closed`. |
| When does a case's time start? | The day the app first sees it finished (`closedAt`, stamped by the sweep). Switching the setting on starts the clock today for cases that are already finished, so nothing finished before today is removed on the first day. |
| What is removed? | Finished cases more than N days after `closedAt`; reports whose day is more than N days ago; change-log lines of removed cases. |
| When does it run? | After the workspace loads and after every change (so the stamps are exact), but only while the setting is on. A pass that changes nothing returns the same object, so nothing is saved or planned again. |
| Is the person told? | Before: choosing a period shows how many cases are finished, how many reports go now, and what comes back (below), and asks to confirm; switching it off needs no confirmation. After: a banner says what was removed and does not go away until dismissed. |
| Switching it off | Removes the setting and the stamps, so switching it on again starts a fresh clock rather than removing at once. |
| A restored backup | Carries the setting and the stamps, and is subject to it as it is restored (a restore is a change like any other). Expired data in an old backup is removed at once and the banner says so; the confirmation for restoring already says everything is replaced. |

The catch, stated in the app and in the privacy statement: a case that was marked done but that the person's own system still
lists as open comes back as a new case at the next import, once it has been removed here.

## 3. The records

- `Workspace.retentionDays?: 30 | 90 | 180 | 365`. A value outside the list is dropped when a workspace is read.
- `StoredCase.closedAt?: string` (`YYYY-MM-DD`). Set by the sweep for a finished case without one; removed from a case that is no
  longer finished (it reappeared in an import). A value that is not a date counts as missing.

## 4. Pieces

1. `src/workspace/retention.ts`: `RETENTION_CHOICES`, `isRetentionDays`, `applyRetention(w, today)`, `previewRetention(w, days,
   today)`, `setRetention(w, days, today)`.
2. `workspace.ts` / `merge.ts`: the two fields, and reading the setting.
3. `WorkspaceProvider`: runs the sweep after load and after each change; keeps what was removed for the banner.
4. `RetentionNotice` banner in the shell.
5. Set-up, Your data and files: the select and the confirmation.
6. English and Hindi (a draft) messages; `docs/privacy.md`, the in-app privacy text, `docs/phone-guide.md`, `CHANGELOG.md`,
   version 1.2.0 (no tag).

## 5. Checks

- Tests first for the pure piece: off does nothing and returns the same object; stamping; removal on the boundary day (kept at N
  days, removed at N+1); reports by their day; change-log lines of removed cases only; a reappeared case loses its stamp;
  switching off clears stamps; a second pass changes nothing; the preview equals what applying removes; a damaged `closedAt`
  is re-stamped, not trusted; the input is never changed.
- In the built app: a seeded workspace with finished cases and reports of different ages; the confirmation counts; the banner;
  nothing removed with the setting off; the setting survives a reload; delete-all and restore behave; axe on the new controls;
  320 px; Hindi; no security-policy violations.

## 6. Finish line

A person can choose how long finished work is kept; nothing is removed unless they chose it, saw the effect first, and are told
what went; the default is unchanged; the privacy statement says exactly what the option does and does not do.

## 7. As built

All six pieces are built. Where the build differs from the plan, or settles something the plan left open:

- `previewRetention` returns `{ removeNow, finishedKept }`: what applying a period removes right now, and how many finished cases
  stay. It is computed by running `setRetention` on a copy, so the preview cannot disagree with what applying does (a test
  checks it).
- The sweep runs inside the provider's `update` as well as after load, so a restore, an import and the Set-up control all pass
  through it. Removal through the Set-up control reports itself in that section; only removals the person did not just ask
  for (opening the app after the time has passed, a restore, an import) raise the banner.
- A stamp that is not a real calendar day (for example `2026-13-45`, found by a test) is not trusted and is replaced by today.
- The select uses the app's `.field` class (48 px high) and is tied to its help text with `aria-describedby`; a first version
  with a bare select was 18 px high and white in dark mode, caught in the 320 px dark check.
- Checked in the built app: off does nothing; choosing a period changes nothing until confirmed; Cancel leaves everything; the
  counts in the confirmation; applying stamps six finished cases and removes the two old reports; a case exactly 90 days
  after its stamp is kept and 91 removed; opening the app later removes, saves, and shows the banner (English and Hindi);
  switching off removes the setting and every stamp and nothing else; axe finds nothing with the confirmation open, in light
  and in dark at 320 px; no content-security-policy violations.
