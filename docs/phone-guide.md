# Using the planner on a phone

The planner is a web page that also installs like an app. After it has been opened once with a connection, it works
with no signal. Nothing is sent anywhere: the route stays on the phone.

This guide has two parts: what a **technician** does with a route, and what the **coordinator** does to send it.

## For technicians

### 1. Open the page once, and install it

Open the planner's address in the phone's browser while you have a connection. After that visit the browser keeps the
whole app, and it opens with no connection.

To put it on the home screen, so that it opens full screen like an app:

| Browser | What to do |
|---|---|
| Chrome | Menu (three dots), then **Install app** or **Add to Home screen**. A button **Install the app** also appears in the app's **Set-up** tab, under *Install on this device*. |
| Samsung Internet | Menu, then **Add page to**, then **Home screen**. |
| Firefox | Menu, then **Install**. |

Installing is not needed for the app to work offline, but it makes the app easy to find.

### 2. Get your route

Your coordinator sends you a **route file** for the day (a small file, with a name like
`route-technician-01-2026-11-21.json`). It can come through any app that sends files: chat, email, a shared folder.
Save it on the phone.

Open the planner, choose the **Route** tab, then **Open a route file**, and pick the file. After that the route stays on
the phone, and opens again from the **Route** tab with no connection.

### 3. Follow the route

The route lists your stops in order. Each stop shows the arrival time, the case number, the work type, the place, and
how far and how long the drive is from the last stop. **Open in maps** shows the stop on a map with a pin: on an Android phone it opens your maps app (which can have the area
saved for use with no signal); on a computer or an iPhone it opens Google Maps in a new tab, which needs a connection.
Above the list, a drawn map shows the day's route; tap a stop on it to see its details.

The file holds case numbers, places, times and distances. It holds no customer names or addresses, so the case number
is what you use to find the details in your own system.

### 4. Report your visits

Under each stop on the **Route** tab you can say how the visit went:

- **Done**, **Partly done** or **Not done**. Pressing the chosen one again takes the report back.
- **Why**, for a visit that was not wholly done: customer not there, no access to the place, part missing, no time, other.
- **Finished at**: the time, filled in with the time now. Change it if you are reporting later.
- **Remarks**: a short note, up to 500 characters. **Do not write a customer's name or phone number.** The case number is
  enough for your coordinator.

What you enter is saved on the phone at once, so closing the app or losing the signal loses nothing. When you are ready,
press **Send report** at the bottom of the Route tab. It makes a small file (a name like
`report-technician-01-2026-11-23.json`) and opens the phone's share sheet: send it to your coordinator in the same chat
you got the route from. If the share sheet does not open, the file is saved in **Downloads**; attach it from there.

You can send the report again after a change, or report the visits in two parts: the coordinator keeps the newest report
of each visit.

### 5. When the file is out of date

A route file is valid for its own day. From the next day the **Route** tab warns that the route was for an earlier date.
If the plan changed after the file was made (a technician was off, a case was added), ask your coordinator for a new
file. Opening a new file for the same technician and day replaces the old one.

To remove a saved route, use **Remove** under *Saved on this phone*. This also removes what you entered for that route, so
send the report first.

## For coordinators

### Sending routes

1. In **Plan**, choose the day.
2. Under **Share and export**, find the technician. **Share route pack** tries the phone's share sheet first (on a computer,
   or when the browser refuses the file, it saves the file to Downloads instead). Send the file to the technician by any
   means. If the share sheet did not open, the file is in **Downloads**: in Telegram or WhatsApp tap the paperclip,
   choose **Document** (or **File**) and pick it from Downloads. A `.json` or `.txt` file both open in the **Route** tab.
3. **Route sheet** opens a print page for that technician and day. Use the browser's print dialog; on Android it also
   offers **Save as PDF**.
4. **Excel file, all tables** and **CSV files, one table at a time** export the schedule, the day routes, the cases not
   planned, a summary, the change log and the reports from technicians.

Make a new route file whenever you change anything that affects the plan, and tell the technician to open it.

### Collecting reports

Technicians send a **report file** back (see *Report your visits* above). Save the files you receive on the computer or
phone you plan with, then, in **Plan**, under *Reports from technicians*:

1. **Open report files** and pick all of them at once. Files that cannot be used are listed with the reason, and the
   rest are read anyway. Opening the same file twice changes nothing, and for a case reported more than once the newest
   report is kept, whatever order the files are opened in.
2. The panel reads the reports against the plan of the day you chose: how many visits are reported, how many are done,
   partly done and not done, which were not wholly done and why, and which technicians have not reported yet.
3. **Mark reported done as done** marks the cases reported *Done* as done in the workspace, so the next plan does not
   visit them again. Nothing is marked until you press it.
4. The **Reports from technicians** table in the Excel file (and as a CSV) lists every report with its remarks.
   **Remove all reports** empties the list.

Report files hold case numbers and free-text remarks, no customer details by design. Read [privacy.md](privacy.md) on
remarks before you roll this out.

### Importing

The app reads a file of up to 20 MB and 50,000 rows. A bigger file is refused with a message; export only the cases you
need (for example the open ones), or split it. While a large file is checked the screen shows *Checking the file…*, and
stays usable. For a centre larger than 2,000 cases, 300 technicians or 30 days, the Plan screen says that the app was
measured only up to that size. (A centre of 300 technicians was measured on a laptop: planning 2,000 cases takes about two
seconds. It has not been timed on a phone, so use a computer for the planning of a large centre.)

### Updates

When a new version of the app is published, a banner says *A new version of the app is ready* with a **Reload**
button. The page never reloads by itself, so an import in progress is not lost. Press **Reload** when it suits you.

### Your data and backups

Your cases, technicians and settings live only in the browser you used. A browser can clear its stored data when the
phone runs low on space or when its data is cleared by hand. To be safe, open **Set-up**, then *Your data and files*, and
**Save a backup** now and then. After 14 days without a backup the app reminds you. **Restore a backup** brings
everything back, on the same phone or another. The backup contains your case data: keep it private.

### Keeping finished work for a limited time

By default finished cases and reports stay until you delete them. If you do not need them for long, open **Set-up**, *Your
data and files*, **Keep finished work for**, and choose 30 days, 90 days, 180 days or 1 year. The app first shows how many
reports would go right away and asks you to confirm; after that it removes finished cases and old reports by itself when
their time has passed, and tells you with a notice at the top of the screen. Save a backup first if you may need them
later, and close the cases in your own system as well: a case that your system still lists as open comes back as a new
case at the next import. The full explanation is in [privacy.md](privacy.md).

## Language

The language chooser is at the top of every screen. English is complete. The Hindi translation is a draft that a Hindi
speaker has not yet read; treat its wording with care. Adding a language needs no code: see
[`src/i18n/README.md`](../src/i18n/README.md).

## If something does not work

| What you see | What to do |
|---|---|
| There is no install button | Use the menu steps in the table above. Some browsers do not offer installing at all; the app works in them as a normal page. |
| The route file does not open | The message says why: a damaged file, a file from a newer version of the app, or a bad time or place. Ask for a new file, and reload the app if a new version is ready. |
| A report file is refused in the Plan tab | The message names the file and says why (not a report, too big, from a newer version, a visit that is damaged). Ask the technician to send it again from the Route tab. |
| The app is empty after some time | The browser cleared its stored data. Restore your backup. The **Route** tab keeps routes only while the browser keeps data, so ask for a new file. |
| The route is for yesterday | See *When the file is out of date*. |
| The page looks old after an update | Press **Reload** in the banner. If there is no banner, close all tabs of the app and open it again with a connection. |
| A screen reader reads something strangely | Please report it, with the screen reader and phone. |

## What has been tested

Checked in Chrome at phone widths (375 and 320 px): every screen, the installed worker, opening the app again with the
server stopped, the update banner, a route file made in one browser and opened in another with no connection, and an
accessibility audit of every screen (axe-core, the WCAG 2.2 AA rules) with no remaining findings.

Checked on a real phone (iQOO Z6 5G, Android 14, Chrome 157, 2026-11-22): installing, full screen, opening with no
connection and planning again, importing with the Android file picker, sending a route file and opening it on the Route
tab, the phone clearing its stored data and restoring a backup, and the layout of every tab upright and sideways. The
results are in [phone-test-result-2026-11-22.md](phone-test-result-2026-11-22.md). The form used, with the exact steps
and limits, is [phone-test-report.md](phone-test-report.md).

Visit reports (added in 1.1.0) were checked in Chrome on a computer at 320 px, in light and dark, in English and Hindi:
entering visits, closing and reopening the app, making the report file, opening several report files at once including
a damaged one and an older report of the same case, marking cases done, the Excel and CSV tables, removing reports and
deleting all data, and an accessibility audit (axe-core, WCAG 2.2 AA) with no findings. **They have not yet been tried on
a real phone**: the share sheet may refuse a `.json` file as it did for the route file, in which case the app offers a
`.txt` file and then a download.

**Not yet checked, and worth doing before relying on it in the field:** Samsung Internet and Firefox on Android; using it
with TalkBack; Safari on an iPhone, which this guide only mentions; sending a report from a phone to the coordinator's
computer; and a route file handed from one phone to another.
Planning of 300 cases felt instant on the phone tested; the 2,000-case size has been timed only on a laptop (about a
second), not on a phone.
