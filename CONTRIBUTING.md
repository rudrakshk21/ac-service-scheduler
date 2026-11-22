# Contributing

Thank you for helping. This page says how changes are made here, and the rules that keep the project what it set out
to be: free to run, working on any centre's data, private by construction, and usable on a phone with no signal.

## Ground rules

1. **No cost, no account, no server.** The app is static files. A change must not need a paid service, a login or a
   backend. The app makes no network requests of its own; the content security policy would block them.
2. **Any centre's data.** Nothing in the code may be specific to one company: no place, technician or work-type names.
   Everything a centre can differ in is a setting or a mapping. The only data in the repository is invented.
3. **No real data in git, ever.** Real exports stay in `reference-local/`, which git ignores. Not even anonymised
   copies without the data owner's written consent. `npm run check:privacy` fails the build on a local path, a key or
   token, a person's email address or a cloud-drive folder; do not work around it, remove the thing. To ask for support
   for a new file layout, share its column names only, never rows.
4. **Every visible word goes through `t()`.** See [src/i18n/README.md](src/i18n/README.md). Look at your screen with
   `?lang=xa` (accented, longer text) and `?lang=xb` (right to left): any plain English left is a word you missed.
5. **Plans must not change by accident.** See *The engine* below.

## Getting started

[README.md](README.md) has the commands. In short: `npm ci`, then `npm run dev`.

Adding something that needs no planning code:

- **A language:** a JSON file and one line, see [src/i18n/README.md](src/i18n/README.md).
- **A starter template or a mapping profile** (the column names of another system): files in the app's own formats,
  see [src/intake/README.md](src/intake/README.md). A profile holds column names and value spellings, never case data;
  a test checks that.

## How a change is made

1. Branch from `main`, with a name that says what it is (`fix-map-labels`, `add-german`). Do not commit to `main`.
2. Write the test first, watch it fail for the right reason, then write the code. Small commits; each one passes.
3. Run the full check before you push:

   ```bash
   npm run lint && npx tsc -b && npm run test:coverage && npm run build && npm run check:size && npm run check:privacy
   py -m unittest discover -s reference -p "test_*.py"
   ```

4. Open a pull request. The same checks run on GitHub, together with a check of the dependencies for known
   vulnerabilities. It is merged when they are green and a maintainer has looked at it.
5. Commit messages: `type(area): what changed`, then a paragraph on **why**, and what you measured or checked. Types
   in use: `feat`, `fix`, `perf`, `docs`, `test`, `refactor`. Write for someone who will read it in a year.

Coverage must stay at 90% or more of statements and lines. Opt-in tests that measure rather than check (speed) are
skipped unless asked for.

## The engine

`src/engine/` is a TypeScript port of the validated Python reference in `reference/python/engine.py`. The Python is the
specification: golden files in `reference/golden/` hold its inputs and results, and `src/engine/golden.test.ts` demands
that the TypeScript gives the same plans.

- **A change of behaviour starts in the Python.** Change `engine.py`, add a scenario, export the golden files, check
  that only new files appeared, then port it. The 16 original golden files must never change (their checksums are in
  `reference/golden/LEGACY.sha256` and tested). Changes to the reference engine are agreed with the project owner first.
  [reference/README.md](reference/README.md) explains each step.
- **A change that is only faster must give identical plans.** The golden files and the fingerprints in
  `src/engine/fingerprint.test.ts` (made from the engine before it was sped up, on many shapes of centre) must pass
  unchanged. Break the rule you touched on purpose and see a test fail before you trust the net.
- **Measure before and after.** `VITE_MEASURE_SPEED=1 npx vitest run src/engine/speed.measure.test.ts
  src/screens/plan/planSpeed.measure.test.ts` prints the planning time for centres of 500 to 10,000 cases. The target
  is 2,000 cases, 100 technicians and 30 days in 30 seconds on an ordinary laptop. The shape of the data matters:
  a centre where each technician can do two work types is about twice as costly as one skill each.
  `src/workspace/scale.measure.test.ts` (same switch) measures a centre of 300 technicians, and a month of their report
  files: what planning, merging reports and saving the workspace cost.

## Accessibility

Rules the screens follow, and that a change must keep: every control at least 48 px; a visible focus ring; text
contrast 4.5:1 and other graphics 3:1 in light and dark; a control's accessible name contains its visible text; no
`aria-label` on a plain `span` or `div`; everything reachable by keyboard, with a skip link first; nothing scrolls
sideways down to 320 px wide.

To audit a screen with [axe-core](https://github.com/dequelabs/axe-core), which is not a dependency of the project:

```bash
npm install --no-save axe-core
npm run dev
```

Open the app, then in the browser's console (the development server only; the production build's content security
policy refuses injected scripts):

```js
await new Promise((ok) => { const s = document.createElement('script'); s.src = '/@fs/<path of this repository>/node_modules/axe-core/axe.min.js'; s.onload = ok; document.head.append(s) })
const r = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] } })
console.table(r.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length })))
```

Do it on every tab and state you changed, in English and Hindi, in light and dark (the browser's developer tools can
emulate both), and at 375 and 320 px wide. axe cannot judge text drawn in the SVG map (it lists it under `incomplete`);
measure that contrast by hand. Walk the screen with the Tab key as well: a tool does not find a bad focus order.

## Documents

Each piece of the build has a design in `docs/superpowers/specs/` and a plan in `docs/superpowers/plans/`. When you
finish something, add what was **built** and **measured** to its design, not only what was planned. Documents that
users read are `docs/phone-guide.md` and `docs/privacy.md`; if you change what the app stores, sends or shows,
change `docs/privacy.md` in the same pull request. User-visible changes go in [CHANGELOG.md](CHANGELOG.md).

## Reporting a problem

Open an issue with the steps, the browser and phone, and what you expected. **Do not paste real case data, customer
names or addresses into an issue**; describe the shape of the data, or invent a small example.

## Licence

The project is under the [MIT licence](LICENSE). By contributing you agree that your contribution is under it too.
