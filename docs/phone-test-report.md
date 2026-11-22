# Android test report

The test that is still open (AC-31 to AC-34, NFR-1 and NFR-20 on a phone, NFR-21, risk R-19). It takes about 45 minutes
with one phone, or an hour with two. Copy this file, fill it in, and send it back or attach it to an issue. **Use only
the invented sample files below, never real case data**, because the report may be made public.

## The phone

| | |
|---|---|
| Make and model | |
| Android version | |
| Memory (4 GB is the reference class, PD-9) | |
| Browser and its version | Chrome / Samsung Internet / Firefox: |
| Second phone, for scenario X (make, model) | |
| Date of the test | |
| Connection used for the first visit | |

## Before you start

1. On a computer: `npm ci`, then `npm run sample-data`. It writes `sample-data/technicians.csv` (20 technicians) and
   `sample-data/cases.csv` (300 cases): the size NFR-1 is written for. For the larger check in section 2:
   `npm run sample-data -- --cases 2000 --technicians 100 --out sample-large`.
   The made-up jobs lie in the app's starting region, which is empty desert on a real map, so *Open in maps* shows a pin
   in the sand. To see pins on real streets, scatter them around your own city:
   `npm run sample-data -- --lat 22.57 --lon 88.36 --out sample-city` (use your city's coordinates). On the *Plan* screen
   the app then offers *Put the base in the middle of my cases*: tap it once.
2. Put the files on the phone: by cloud storage, email or a cable. Putting at least one in cloud storage tests FR-28.5.
3. Have a stopwatch ready. Note which of the steps below you did with a connection and which without.

The live address is in the README.

## 1. Install and offline (scenario W; AC-31, FR-28.1, NFR-20)

| Step | Expected | Result |
|---|---|---|
| Open the address in the browser with a connection | The page loads. Time to a usable screen on 4G (NFR-20: 5 s): ___ s | |
| Add it to the home screen (Chrome: menu, *Install app* or *Add to Home screen*; Samsung Internet: menu, *Add page to*, *Home screen*; Firefox: menu, *Install*). Or use *Set-up*, *Install on this device* | An icon appears with its own name and picture | |
| Open it from the icon | Full screen, no browser bars | |
| *Import*: choose `technicians.csv` with the phone's file picker, then `cases.csv` (FR-28.5) | Both import; "Imported 20 technicians", "Imported 300 cases" | |
| Open the *Plan* tab | A plan appears (time: section 2) | |
| Close the app. Switch on airplane mode. Open it from the icon | Starts full screen. Time from tap to a usable screen (NFR-20: 3 s): ___ s. It shows the stored data | |
| In airplane mode: *Set-up*, *Technicians*, switch one technician off, open *Plan* | The plan is made again and changes | |

## 2. Speed (NFR-1, NFR-22, AC-31)

| Check | Limit | Result |
|---|---|---|
| With 300 cases and 20 technicians: time from opening the *Plan* tab for the first time after the import until "300 cases planned" appears | 10 s | ___ s |
| Same, after switching a technician off in *Set-up* (the plan is made again) | 10 s | ___ s |
| Come back to *Plan* with nothing changed | Instant (the plan is kept) | |
| With the larger files (2,000 cases, 100 technicians): time to "2,000 cases planned" (information, no limit) | | ___ s |
| Did the browser close or reload the page during any of these? | No | |
| Optional: with `--cases 2100 --technicians 100`, does the *Plan* screen show the note about a large set? (2,000 cases is the measured limit and 2,100 is above it) | Yes, above 2,000 cases, 300 technicians or 30 days | |

## 3. Route pack to a technician (scenario X; AC-33, FR-28.6 to 28.9)

Phone A has the plan (sections 1 and 2). Phone B is the technician's.

| Step | Expected | Result |
|---|---|---|
| On A: *Plan*, pick a day, *Share and export*, *Share route pack* for one technician | The Android share sheet opens, or the file is saved to Downloads as `route-technician-01-....json` (the first test phone did the latter; CSV exports did open the share sheet): note which happened, then attach the file from Downloads | |
| Send it to B and save it on B | | |
| On B: open the app, *Route*, *Open a route file*, choose the file | The same ordered stops, arrival times and distances as on A | |
| On B: switch on airplane mode and reopen the app | The route is still there, with the map | |
| On B: tap *Open in maps* on a stop | The installed maps app opens at that place **with a pin** (labelled *Stop 1: case ...*), with one tap (FR-28.9). Works with no connection only if the maps app has the area saved offline: the app only hands over the position | |
| Look at the file in a text editor, or ask the coordinator: does it hold a customer name or an address? | It holds none | |
| Open a pack whose date has passed (a day later, or the phone's date set a day ahead) | A warning that the route was for an earlier date | |

## 3b. Visit report to the coordinator (visit reports, 1.1.0)

Continues section 3: phone B has the route open, phone A (or a computer) has the plan. Use invented remarks only.

| Step | Expected | Result |
|---|---|---|
| On B: under the first stop, press *Done*; under the second, *Not done* and choose a reason; under the third, *Partly done*, a reason and a remark | The buttons show the choice (the pressed one is filled); *Finished at* shows the time now; the summary says *3 of 3 visits reported* | |
| On B: is every button, the reason list, the time and the remarks box easy to hit and read, upright and sideways, with the on-screen keyboard open once? | Yes; the keyboard does not hide the remarks box | |
| On B: close the app completely and open it again, *Route* | The three entries are still there | |
| On B: switch on airplane mode, change one entry | It works with no connection | |
| On B: press *Send report* | The share sheet opens (a `.json` or `.txt` file), or the file `report-technician-01-....json` is saved to Downloads: note which happened | |
| Send it to A, save it there. On A: *Plan*, pick the same day, *Reports from technicians*, *Open report files* | A line says *Read 1 file* with 3 new visits; the day line says *3 of N reported* with 1 done, 1 partly, 1 not done; the two visits not wholly done are listed with their reason and remark | |
| On A: open the same file again | Nothing changes: 3 already known | |
| On A: *Mark 1 reported done as done* | The plan is made again without that case | |
| On A: export the Excel file, open the *Reports from technicians* sheet | One row per reported visit, with the remark; a remark that starts with `=` shows as text | |
| On B: press *Remove this route* | It says the report is removed with it; the entries are gone afterwards | |

## 4. Storage cleared (scenario Y; FR-28.10)

| Step | Expected | Result |
|---|---|---|
| *Set-up*, *Your data and files*: what does *Storage* say? | Persistent, or advice to save a backup: ___ | |
| *Save a backup*; note the plan's first line (cases planned, days): ___ | A file is saved | |
| Clear the browser's data for the site, then open the app | It says nothing is stored (*Import your technicians*) | |
| *Set-up*, *Your data and files*, *Restore a backup*, choose the file, *Replace everything* | Everything is back; *Plan* gives the identical first line | |

## 5. Layout and touch (AC-32, FR-28.2 to 28.4, FR-28.11)

Portrait, then landscape, on each of *Plan*, *Data*, *Import*, *Set-up*, *Route*:

| Check | Result |
|---|---|
| No horizontal scroll of the page (the *Data* case list and the import preview scroll inside their own frame; the case number and status stay visible) | |
| Every button and switch is easy to hit with a thumb; nothing is too small or too close to another (48 px) | |
| Nothing needs hover or a right click | |
| Turn the phone while a field is half filled in *Set-up*: the entry and the screen position stay | |
| Switch to another app and back, with the on-screen keyboard open once: the screen and the data are as they were | |
| The on-screen keyboard does not hide the field being typed in | |

## 6. Other browsers (NFR-21, R-19)

Repeat section 1 (install, offline, import) once on each, and note what differs.

| Browser | Installed? | Worked offline? | Differences, problems |
|---|---|---|---|
| Chrome (current) | | | |
| Samsung Internet | | | |
| Firefox for Android | | | |

## 7. Screen reader (AC-34)

With TalkBack on, go through three tasks: **import** a file (choose it, Columns, Words, Check, Import), **plan** (day
buttons, *Show stops* for a technician, the switches in *Set-up*), and **route** (open a pack, move through the stops).
Write down anything that is not announced, cannot be reached, has the wrong name, or traps the focus. A *blocking*
problem is one that stops you finishing the task.

| Task | Finished? | Problems (blocking or not) |
|---|---|---|
| Import | | |
| Plan | | |
| Route | | |

## 8. Language (scenario S; AC-30)

Switch to *हिन्दी* in the header. Every screen readable, nothing cut off at the phone's width, dates and numbers sensible.
Note any wording that reads wrongly: the Hindi is a draft that a native speaker has not yet read.

## Result

| | Pass | Fail | Notes |
|---|---|---|---|
| AC-31 install and speed | | | |
| AC-32 layout | | | |
| AC-33 route pack | | | |
| AC-34 TalkBack | | | |
| NFR-1 phone (10 s) | | | |
| NFR-20 start-up (5 s first, 3 s installed) | | | |
| NFR-21 browsers | | | |

Not part of release 1, so not tested here: keeping the screen awake while a route is open (FR-28.12, a "could"), and a
live route with completion updates.
