# Real-phone test: result, 2026-11-22

The first test on a real Android phone, with the form [phone-test-report.md](phone-test-report.md). Only the invented
sample files were used. Marks: **measured** (a figure or a screenshot), **reported** (the tester's word, no figure),
**not reported** (nothing was told, so it counts as not tested).

| | |
|---|---|
| Phone | iQOO Z6 5G, Android 14, Funtouch OS |
| Browser | Chrome 157.0.8103.78 (installed to the home screen) |
| Connection | Wi-Fi for the first checks; 5G mobile data for the storage test (not 4G) |
| Phones | One. The route pack was moved to a computer through Telegram and opened again on the same phone |
| Data | `npm run sample-data`: 300 cases, 20 technicians; later the same size around Kolkata (`--lat 22.57 --lon 88.36`) |

## Results

| Scenario | Result |
|---|---|
| **W** Install and offline (AC-31, FR-28.1) | **Pass.** Installed; opens full screen from the icon (reported). In airplane mode it opens at once, shows the stored data, and re-plans after a technician is switched off (reported) |
| Import with the Android file picker (FR-28.5) | **Pass** (screenshots: the file read as UTF-8, 20 rows; the Data tab shows 300 cases, 20 technicians, 12 places). The Continue button was not hard to reach behind the bottom bar |
| Speed on the phone (NFR-1, NFR-20) | First load and the plan of 300 cases and 20 technicians were "instant" on Wi-Fi (reported, **no stopwatch figure**: far inside 10 s and 5 s). The 4G first-load figure was not isolated (Wi-Fi and 5G only). The 2,000-case set was not reported |
| **X** Route pack (AC-33, FR-28.6 to 28.9) | **Pass, with two findings, both fixed (below).** The file made on the phone holds only the allowed fields and no customer name or address (read by hand). Opens on the Route tab with its stops, times, distances, map and *Open in maps* links, and stays after airplane mode. *Share route pack* saved to Downloads and was sent on through Telegram. Not tested: a second phone, the out-of-date warning |
| **Y** Storage cleared (FR-28.10) | **Pass** (reported as passed, without details or figures). *Storage* said "The browser has promised to keep your data" (reported) |
| Layout and touch (AC-32, FR-28.2 to 28.4, FR-28.11) | **Pass** (reported, no details). Every tab upright and sideways, rotation, switching apps |
| Samsung Internet, Firefox (NFR-21, R-19) | **Not reported.** Only Chrome was tried |
| TalkBack (AC-34) | **Not reported.** |
| Hindi (AC-30 on the phone) | **Not reported.** |

## Findings, and what was done

1. **Open in maps dropped no pin.** Google Maps opened on an empty map. The link was a bare `geo:lat,lon`, which only
   centres the map; the made-up region of the sample (20°N, 30°E) is also empty desert on a real map. Now
   `geo:lat,lon?q=lat,lon(Stop 1: case 100152)`. Confirmed on the phone: Google Maps shows the red pin and the label on
   real streets in Howrah (22.59883, 88.33967). `npm run sample-data` takes `--lat` and `--lon` for this.
2. **Share route pack went straight to a download.** Chrome on Android lets only certain file types through the share
   sheet. The pack is now offered to the share sheet as plain text as well, but the phone still saved a file: both `.json`
   and plain text were refused, while a CSV export did open the share sheet with all the apps. The reason was not found
   (the build machine's browser has no share function to test with). The download is the fallback the requirements
   allow (FR-28.6), and it worked. Option for later: a route pack in CSV form, which the share sheet accepts.
3. **Minor, not changed.** Stops at exactly the same place are drawn on top of each other on the map, so only the last
   visit's label shows; the stop list shows them all.

## Against the criteria

| Criterion | State |
|---|---|
| AC-31 install and speed on one real mid-range phone; NFR-20; phone limit of NFR-1 | **Met**, by observation. No stopwatch figures; the 4G case was not isolated |
| AC-32 phone layout, 48 px, by hand on the real phone | **Met** (reported). Playwright Android emulation was not used; the browser pane's device emulation was |
| AC-33 route pack | **Partly met.** Opens, holds no customer name, works offline. Not tested between two phones |
| AC-34 TalkBack | **Not done** |
| NFR-21 Samsung Internet and Firefox | **Not done**; Chrome only |
| NFR-22 DS-1 on the phone | Not tested (DS-1 is real data and stays off the phone); the 300-case size was |

What would raise confidence further: a second phone for the hand-over, Samsung Internet and Firefox once, a TalkBack walk,
and a stopwatch figure for the 2,000-case set.
