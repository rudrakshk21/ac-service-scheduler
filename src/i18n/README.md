# Languages

The interface text is in message files, one per language, next to this file. No screen holds its own wording.

## How the pieces fit

| File | What it is |
|---|---|
| `en.json` | Every message, in English. The source of truth; a message that does not exist here is a compile error. |
| `hi.json` | Hindi. A draft written by the assistant, to be read by a native speaker. |
| `languages.json` | The list of real languages: `code`, `name` (in that language), `dir` (`ltr` or `rtl`), `draft`. |
| `index.ts` | `t(key, values)`, `tn(key, count, values)`, the language in use, number and date formatting. |
| `core.ts` | Filling `{name}` and choosing plural forms. |
| `pseudo.ts` | Two test languages made from the English text. |
| `messages.test.ts` | Fails when a language lacks a key, has an extra one, drops a placeholder or leaves a message empty. |

## Add a language

1. Copy `en.json` to `xx.json` (`xx` is the language code, for example `fr`, `bn`, `ar`).
2. Translate the text on the right of each line. Do not change the keys on the left. Keep every `{placeholder}`
   exactly as written; it may move within the sentence but must stay.
3. Add a line to `languages.json`: `{ "code": "xx", "name": "Name in that language", "dir": "ltr" }`, and `"dir": "rtl"`
   for a right-to-left language. Add `"draft": true` until a native speaker has read it.
4. Run `npm test`. The test finds the new file by itself and tells you what is missing or wrong.
5. Look at it: open the app with `?lang=xx` at the end of the address (for example `http://localhost:5173/?lang=xx`).

No code is changed. The file is loaded only when someone chooses that language, so it does not slow the first visit.

### Plurals

A message that depends on a number has one line per form, ending `.one` and `.other`:

```json
"plan.cases.one": "{count} case",
"plan.cases.other": "{count} cases"
```

Add the forms your language needs: `.zero`, `.one`, `.two`, `.few`, `.many`, `.other`. The browser's `Intl.PluralRules`
decides which one applies. A language that has no line for a form uses the `.other` line, so `.other` is required.
`{count}` is filled with the number written the way your language writes numbers.

### Names that come from the data

Work types, skills, priority levels, technician and place names, case numbers and the reasons the planner gives for
choosing a technician ("Skill match (Asha approved for Service); adds 6 min detour") are data or come from the planning
engine, and are shown as they are. The planner's reasons are English until the engine gives them as codes (see the spec).

## Test the layout

Two test languages need no translation. Add `?lang=xa` (long accented text, shows where a layout has no room) or
`?lang=xb` (a right-to-left script, shows a mirrored layout) to the address. Every letter in them is replaced, so any
text that is still plain English was never moved into a message file. Choosing a language in the header removes
`?lang=` from the address and keeps the choice.

## For developers

- In code: `t('plan.title')`, `tn('plan.cases', 3)`, `t('route.made', { site, when })`.
- Numbers and dates: `formatNumber(n)` and `formatDate(date, options)`, never `toLocaleString` or a fixed `en-GB`.
- Do not build a sentence from pieces in code; put the whole sentence in a message and use placeholders, so a language
  can reorder the words.
- A key that is made from a code at run time (`state.${s}`) is cast to `MessageKey`; add it to the list in
  `messages.test.ts` so the test checks it exists.
- Use CSS logical properties (`margin-inline-start`, `text-align: start`, `inset-inline-start`), not `left` and `right`.
