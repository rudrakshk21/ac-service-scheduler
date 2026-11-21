# AC Service Scheduler

Plans which technician visits which air-conditioner service call, on which day, and in what order, for any service
centre. It runs entirely in the browser: no server, no account, no cost, and after the first visit no connection
either. A technician can open their day's route on a phone with no signal.

**Live:** https://ac-service-scheduler.rudrakshkhatarker21.workers.dev

## What it does

- **Imports your data as it is.** A CSV, Excel (`.xlsx`) or JSON export from any system. You match its columns once,
  check the words it uses (work types, statuses), and the app remembers the matching for the next file. Nothing in the
  code is specific to one company. Templates with the app's own field names: `/templates/cases.csv`,
  `technicians.csv`, `places.csv`.
- **Plans the work.** Skills, working hours, leave, holidays, priorities and due dates are all settings of your centre.
  Every choice comes with a reason. Switch a technician off in Set-up and the plan is made again in seconds.
- **Gets the plan out.** Print a route sheet, send a technician their **route pack** (one small file per technician
  per day), or export everything to Excel or CSV. A technician opens the pack on their own phone, offline, with a link
  to each stop in their maps app.
- **Shows the day on a map.** A drawn map of the routes from the coordinates, true to scale, with no map service and
  no network.
- **Speaks your language.** English, and a Hindi draft. A new language is a JSON file, with no code.

## Using it

1. **Set-up** (the `Set-up` tab): name your centre, add work types and skills, and put the base in the middle of your
   cases. The defaults are a working starting point.
2. **Import** technicians, then cases, from your files. Personal columns (customer name, address) are left unmapped
   unless you choose to bring them in; the plan does not need them.
3. **Plan** shows the schedule per day with a reason for each choice, what could not be planned and why, and the map.
4. **Share**: route sheet, route pack, Excel or CSV. The technician opens the pack in the **Route** tab.

Phones: [docs/phone-guide.md](docs/phone-guide.md), and the form for testing on a real phone,
[docs/phone-test-report.md](docs/phone-test-report.md). What is stored and what is not: [docs/privacy.md](docs/privacy.md).

## Running it from the source

You need Node.js 22.18 or later (the check scripts use its built-in TypeScript support; CI uses the current LTS),
and Python 3 only for the reference engine's tests.

```bash
npm ci
npm run dev
```

| Command | What it does |
|---|---|
| `npm run dev` | The app with live reload, at http://localhost:5173 |
| `npm run build` | Type-checks and builds the app into `dist/` |
| `npm run serve:dist` | Serves `dist/` with the same security headers as the live site |
| `npm test` | The tests. `npm run test:coverage` adds the coverage report (90% is the floor) |
| `npm run lint` | Lints the code |
| `npm run check:size` | Fails when the build passes its size budget (first download 300 KB compressed) |
| `npm run check:privacy` | Fails when a committed file holds a local path, a person's email address, a cloud folder or a key |
| `npm run sample-data` | Writes invented sample files (default 300 cases, 20 technicians) into `sample-data/`, for trying the app |
| `py -m unittest discover -s reference -p "test_*.py"` | The Python reference engine's tests |

The same checks run on every pull request. Opt-in measurements of planning speed:
`VITE_MEASURE_SPEED=1 npx vitest run src/engine/speed.measure.test.ts src/screens/plan/planSpeed.measure.test.ts`.

## How it is built

A static React 19 and TypeScript app built with Vite. The planning engine runs in a Web Worker so the screen never
freezes. Data lives in the browser (IndexedDB). A small hand-written service worker makes it work offline. It is hosted
as static files on Cloudflare Workers.

| Folder | What is in it |
|---|---|
| `src/engine/` | The planning engine, a TypeScript port of the validated Python reference, proven identical by golden files |
| `src/intake/` | The data intake library: reading files, matching columns, validating, merging imports ([README](src/intake/README.md)) |
| `src/workspace/` | The browser storage and backups |
| `src/screens/`, `src/demo/` | The screens: Plan, Data, Import, Set-up, Route |
| `src/share/`, `src/map/` | Exports, route packs, the drawn map |
| `src/i18n/` | Languages ([README](src/i18n/README.md): how to add one) |
| `reference/` | The Python reference engine and its golden files ([README](reference/README.md)) |
| `vite-plugins/`, `public/_headers`, `scripts/` | The service worker and its build step, the security headers, the size and privacy checks |
| `docs/` | This project's design and plan documents, and the guides |

Design documents, one for each piece of the build, are in `docs/superpowers/specs/`; each ends with what was built and
what was measured.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Changes to the version are in [CHANGELOG.md](CHANGELOG.md).

## Licence

[MIT](LICENSE). The planner is free to use, copy and change, including for a business, as long as the licence text stays
with it. The sample data in the repository is invented; the licence says nothing about, and gives no right to, any
centre's real data.
