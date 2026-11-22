# Privacy statement

Short version: **your data stays in your browser. The app sends it nowhere.** There is no account, no server of ours,
no analytics, no cookies, and no third-party scripts, fonts or maps. This document says exactly what is kept, where,
and what the app cannot protect.

## What is kept, and where

Everything below is on the device and browser you use, and nowhere else.

| What | Where | When it goes away |
|---|---|---|
| Your cases, technicians, places, set-up, saved column matchings, import history, change log, holidays | The browser's IndexedDB (database `ac-scheduler`) | *Set-up, Your data and files, Delete all my data*, the time chosen for finished work running out (finished cases and reports only; off by default), or clearing the site's data in the browser |
| Route files you opened on a phone (the Route tab) | The same IndexedDB | *Remove* in the Route tab, or the same ways as above |
| What a technician entered about their visits, before and after sending it (the Route tab) | The same IndexedDB, on the technician's phone | *Remove* of that route in the Route tab (it takes the entries with it), *Delete all my data*, or the same ways as above |
| Report files a coordinator opened (the Plan tab) | The coordinator's IndexedDB, with the workspace | *Remove all reports* in the Plan tab, *Delete all my data*, or the same ways as above |
| Your language choice | The browser's local storage (`locale`) | Clearing the site's data |
| The app itself: its pages, scripts, fonts and templates | The browser's cache, for offline use | Clearing the site's data; replaced when a new version is installed |

The app sets no cookies.

## For how long, and who can see it

- **For how long:** until you delete it with *Delete all my data*, until the time you chose for finished work runs out (see
  *Keeping finished work for a limited time*), or until the browser clears it. Without a choice the app has no expiry of
  its own: finished cases stay until you delete them.
- **Who can see it:** whoever can open this browser on this device. No one else: not the project, not the host, not the
  other devices of your technicians. Each technician's phone holds only the route files that technician opened.

The same four facts (what, where, how long, who) are in the app, in *Set-up*, *Your data and files*.

## Keeping finished work for a limited time

*Set-up, Your data and files, Keep finished work for* lets you limit how long finished work stays in the browser: 30 days,
90 days, 180 days or 1 year. **It is off until you choose a time**; nothing is ever removed by itself without it.

- **What is removed.** A finished case (marked done, or no longer in your system's export) more than the chosen time after
  the first day the app saw it finished; a report from a technician more than the chosen time after the day of its
  route; and the lines of the change log about a removed case. Cases that are not finished are never removed. Import
  history, holidays and set-up are not touched.
- **Before and after.** Choosing a time first shows how many finished cases there are and how many reports would go right
  away, and asks you to confirm. If the app is opened after the time has passed (a month after it was last used, for
  example), it removes what has expired and a notice says what it removed, until you dismiss it. Switching it off needs no
  confirmation and removes nothing.
- **The clock.** For cases that are already finished when you choose a time, it starts that day, so none of them goes on
  the first day. A case that comes back (open again in a later import) loses its date and starts over when it is
  finished again.
- **A catch.** If you marked a case done but your own system still lists it as open, then after it has been removed here the
  next import brings it back as a new case, and the planner can plan it again. Close it in your system first, or leave
  the time long.
- **What it does not do.** It runs only in the browser where you chose it. It does not reach backups or files you saved
  or sent earlier (delete those yourself), other browsers or devices, and not a technician's phone (there, removing a
  route removes the entries for it, and a phone keeps at most 20 routes). A backup that you restore is held to the choice
  stored in it: what has already expired is removed as it is restored, and a notice says so.

## What is sent

**Nothing from the app.** After its files have loaded, the app makes no network requests. This is checked, not only
promised: the page's content security policy allows requests to its own address only (`connect-src 'self'`), so a
script could not send data elsewhere, and a list of every request a session made, read from the browser, shows only the
app's own files.

The company that hosts the app's files (Cloudflare) serves them, and like any web host it can see that a request for
them was made: the address of the device, the time and the browser. That happens when the app is first opened and when
it checks for a new version. It concerns the files, not your data, which the app does not send.

## Personal data in your files

The planner does not need customer names or addresses. In the import, the columns that usually hold them (customer
name, address) are **left unmapped until you choose** to bring them in, and are marked *May contain personal data*.

| Field | Stored in the browser | Shown in the app | In exports, route sheets, route packs |
|---|---|---|---|
| Customer name | Only if you map it | No screen shows it | No |
| Address, notes, other reference | Only if you map them | On the Data tab, for you | No |
| Case number, work type, place, coordinates, status, dates | Yes | Yes | Yes (the plan's tables use the ones the plan needs) |

A **route pack** is a small file with exactly these fields: centre name, technician, date, when it was made, the day it
is valid for, and per stop the visit number, case number, work type, place, coordinates, arrival time, kilometres and
driving minutes. When a pack is opened, anything else in the file is dropped, so a file that had been altered to carry a
customer name would still show none.

A **backup** contains everything in the app, including any address or notes you mapped, and the reports from
technicians that were opened. Keep backups private.

## Reports from technicians

A technician reports each visit on the Route tab: done, partly done or not done; a reason (customer not there, no
access, part missing, no time, other); the time it was finished; and **remarks**. A **report file** holds the centre's
name, the technician, the day, when it was made, and per visit the case number, the status, the reason, the time and the
remarks. No customer name, address or phone number is asked for, and no photo.

- **Remarks are free text, and the app cannot know what is typed in them.** The Route tab warns the technician not to
  write a customer's name or phone number. The warning is the only protection: a remark that does contain one is kept
  and sent like any other. Reports are for case numbers and short notes about the visit.
- **Where it goes.** The report file is made on the technician's phone and sent by the technician through whatever app
  they choose (chat, email, a shared folder), like a route pack. It is not encrypted, and that service handles it under
  its own terms. The coordinator opens the files in the Plan tab; they are read in the browser and sent nowhere.
- **Checked on opening.** Like a route pack, a report is read against a fixed list of fields. Anything else in the file is
  dropped, a file that is too big or damaged is refused with a message, and a report that does not fit the format is never
  partly read. The same case reported again keeps the newer report.
- **Exports.** The Reports table is in the Excel and CSV exports with the same guard against spreadsheet formulas.
  It is the only table that carries free text, so treat an export that includes it as you would the reports themselves.
- **Removing it.** On the phone, removing a route in the Route tab removes what was entered for it. In the Plan tab,
  *Remove all reports* removes every report that was opened. *Delete all my data* removes both, on the device where it
  is used.

## What the app cannot protect

- **The device.** Anyone who can open your browser profile can read what the app stores. Use the phone's own lock, and do
  not use the app in a shared browser profile.
- **What is typed in remarks.** See *Reports from technicians*. A warning is not a filter.
- **Files you send.** A route pack, a report file and an Excel export are not encrypted. Anyone who has the file can read it, and the
  chat or email service you send it through handles it under its own terms. A route pack holds places, coordinates and
  case numbers, no customer details, but the places are where your technicians will be.
- **A cleared browser.** If the browser removes its data, the app's data is gone. Keep a backup.

## Safeguards built in

- **No inline or foreign code.** The content security policy allows scripts, styles, fonts, images and workers from the
  app's own address only; it forbids framing the app in another page. Other headers stop content-type guessing and
  send no referrer.
- **Spreadsheet formulas.** In CSV and Excel exports, text that starts with `=`, `+`, `-` or `@` is written with a
  leading apostrophe so a spreadsheet shows it as text and runs nothing.
- **Damaged or altered files** are refused with a plain message that names the problem, never partly read.
- **A crash** shows a screen that offers a backup of your data before reloading, not a blank page.
- **Dependencies** are checked for known vulnerabilities on every change and once a week, and updates are proposed
  automatically.
- **The code is public**, and a check on every change fails if a path on someone's computer, a person's email address or
  a cloud-drive folder is committed.

## Your choices

- Do not map the personal columns; the plan works without them.
- Tell technicians what the remarks are for, and not to write personal details in them.
- Choose a time for finished work (*Set-up, Your data and files, Keep finished work for*) if you do not need old cases.
- *Set-up, Your data and files, Delete all my data* removes everything from the browser. It cannot be undone.
- Use a browser's private window or a separate profile for a trial; closing it removes the data.

## Questions

Open an issue in the project's repository. This statement describes the app as built; if the app changes, this document
changes in the same pull request.
