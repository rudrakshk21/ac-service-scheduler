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
how far and how long the drive is from the last stop. **Open in maps** hands the stop's position to your maps app.
Above the list, a drawn map shows the day's route; tap a stop on it to see its details.

The file holds case numbers, places, times and distances. It holds no customer names or addresses, so the case number
is what you use to find the details in your own system.

### 4. When the file is out of date

A route file is valid for its own day. From the next day the **Route** tab warns that the route was for an earlier date.
If the plan changed after the file was made (a technician was off, a case was added), ask your coordinator for a new
file. Opening a new file for the same technician and day replaces the old one.

To remove a saved route, use **Remove** under *Saved on this phone*.

## For coordinators

### Sending routes

1. In **Plan**, choose the day.
2. Under **Share and export**, find the technician. **Share route pack** opens the phone's share sheet (on a computer it
   saves the file). Send the file to the technician by any means.
3. **Route sheet** opens a print page for that technician and day. Use the browser's print dialog; on Android it also
   offers **Save as PDF**.
4. **Excel file, all tables** and **CSV files, one table at a time** export the schedule, the day routes, the cases not
   planned, a summary and the change log.

Make a new route file whenever you change anything that affects the plan, and tell the technician to open it.

### Importing

The app reads a file of up to 20 MB and 50,000 rows. A bigger file is refused with a message; export only the cases you
need (for example the open ones), or split it. While a large file is checked the screen shows *Checking the file…*, and
stays usable. For a centre larger than 2,000 cases, 100 technicians or 30 days, the Plan screen says that the app was
measured only up to that size.

### Updates

When a new version of the app is published, a banner says *A new version of the app is ready* with a **Reload**
button. The page never reloads by itself, so an import in progress is not lost. Press **Reload** when it suits you.

### Your data and backups

Your cases, technicians and settings live only in the browser you used. A browser can clear its stored data when the
phone runs low on space or when its data is cleared by hand. To be safe, open **Set-up**, then *Your data and files*, and
**Save a backup** now and then. After 14 days without a backup the app reminds you. **Restore a backup** brings
everything back, on the same phone or another. The backup contains your case data: keep it private.

## Language

The language chooser is at the top of every screen. English is complete. The Hindi translation is a draft that a Hindi
speaker has not yet read; treat its wording with care. Adding a language needs no code: see
[`src/i18n/README.md`](../src/i18n/README.md).

## If something does not work

| What you see | What to do |
|---|---|
| There is no install button | Use the menu steps in the table above. Some browsers do not offer installing at all; the app works in them as a normal page. |
| The route file does not open | The message says why: a damaged file, a file from a newer version of the app, or a bad time or place. Ask for a new file, and reload the app if a new version is ready. |
| The app is empty after some time | The browser cleared its stored data. Restore your backup. The **Route** tab keeps routes only while the browser keeps data, so ask for a new file. |
| The route is for yesterday | See *When the file is out of date*. |
| The page looks old after an update | Press **Reload** in the banner. If there is no banner, close all tabs of the app and open it again with a connection. |
| A screen reader reads something strangely | Please report it, with the screen reader and phone. |

## What has been tested

Checked in Chrome at phone widths (375 and 320 px): every screen, the installed worker, opening the app again with the
server stopped, the update banner, a route file made in one browser and opened in another with no connection, and an
accessibility audit of every screen (axe-core, the WCAG 2.2 AA rules) with no remaining findings.

**Not yet checked, and needed before relying on it in the field:** installing and using it on a real Android phone, in
Chrome, Samsung Internet and Firefox; using it with TalkBack; and Safari on an iPhone, which this guide only mentions.
Planning has been timed only on a laptop (about a second for 2,000 cases and 100 technicians); on a phone it will be
slower, and has not been timed.
