# Hardening and release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The app is safe to hand to a real centre: it cannot fail silently, it sends nothing anywhere, it is checked for accessibility and speed, its limits are stated, and a person who finds it can understand, install and trust it.

**Architecture:** No new features. Guards (an error screen, a content security policy, a size budget in CI), measurements recorded in the repository, and the documents the requirements list (README, phone guide, privacy statement, changelog, contributor guide).

**Tech Stack:** As before. `axe-core` is run in the browser pane, not added to the app.

**Spec:** `docs/superpowers/specs/2026-11-21-phone-sharing-design.md` (section 13 will record this piece). Requirements v4.1: NFR-1 to NFR-4, NFR-20, NFR-22, SEC-1 to SEC-10, PRV-1 to PRV-9, AC-25, AC-27, AC-29, AC-32, DL-12, DL-13.

## Global Constraints

- No real data in the repository (DS-1 stays in `reference-local/`). No credentials. No change to the engine or the Python reference.
- The first download stays at most 300 KB compressed (NFR-3). It is about 89 KB now.
- Commit with `git commit -F <file>`; messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Full check before every push: `npm run lint && npx tsc -b && npm run test:coverage && py -m unittest discover -s reference -p "test_*.py" && py reference/check_ds1_local.py`, then `npm run build`.
- Decisions that are the owner's (licence, a release tag, the reference phone, publishing sample data) are asked, not taken.

---

### Task H1: An error screen instead of a blank page

- [ ] A React error boundary around the shell: a plain message, "Reload", and "Save a backup of my data" when the workspace is readable. Messages in `en.json` and `hi.json`. Verify in the browser by forcing an error.

### Task H2: A content security policy and the other headers

- [ ] `public/_headers`: `Content-Security-Policy` (own origin only; no inline script), `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` (geolocation only for the app itself), `Cross-Origin-Opener-Policy`. Serve the built app with a local server that applies the file, use every feature (import, plan, map, Excel, route pack, language, install worker) and read the console for violations. Then check the live site's headers.

### Task H3: Guards in CI

- [ ] `scripts/check-size.mjs` fails the build when the first download exceeds the budget; `npm run check:size`; a CI step. `npm audit --omit=dev` in CI. `.github/dependabot.yml` for npm and GitHub Actions, weekly, grouped.

### Task H4: Accessibility audit

- [ ] Run `axe-core` in the browser on every tab and state in English, Hindi and the right-to-left test language; fix serious and critical findings. Keyboard walk-through: tab order, focus visible, no trap. Record results.

### Task H5: Speed and limits

- [ ] Measure planning 2,000 cases / 100 technicians / 30 days in the browser worker, and importing a 5,000-row file; record the figures and the largest data set a phone can be expected to plan (NFR-1, NFR-4, NFR-22). If a limit is found, state it in the app.

### Task H6: Privacy check

- [ ] The network log of the live site over a full session shows requests only to its own host (AC-27). A scan of the repository finds no personal data. Record both.

### Task H7: Documents

- [ ] `README.md` (what it is, how to use it, privacy in one paragraph, how to run and contribute), `docs/phone-guide.md` (DL-13), `docs/privacy.md`, `CHANGELOG.md`, `CONTRIBUTING.md`, version `1.0.0`. Quick checks that every link in them works.

### Task H8: Finish

- [ ] Full check, build, record "As built" in the spec, update memory, push, ask for the pull request and the merge. After the merge, verify the live site, then ask the owner the open questions (licence, release tag, reference phone, sample data, Hindi review).
