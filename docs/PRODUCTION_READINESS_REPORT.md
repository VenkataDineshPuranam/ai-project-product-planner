# Production-Readiness Report — Stage 9

Date of this review: 2026-08-05. Evaluated against `docs/TEST_STRATEGY.md`
§7 (Definition of Done) and source instructions Section 16 (Prompt 9) /
Section 20. Every claim below is backed by a command that was actually
run during this review, listed inline. Where something is not verified,
that is stated explicitly rather than implied.

## 1. Type checks

**Pass.** `npx tsc --noEmit` — zero errors, across `src/`, `scripts/`,
and `e2e/`.

## 2. Lint

**Pass.** `npx eslint src scripts e2e playwright.config.ts --ext .ts,.tsx`
— zero errors, zero warnings.

## 3. Unit and integration tests

**Pass.** `npx vitest run` — **176/176 tests passing** across 27 files:
domain validation, scheduling engine (calendar + CPM, including a
property-based invariant suite), persistence, product/AI lifecycle
governance rules, resource/cost/FinOps calculations, import/export,
sample-data integrity, UI components, and a jsdom-based accessibility
scan.

## 4. End-to-end tests

**Pass, but minimal.** A Playwright suite (`e2e/smoke.spec.ts`) was
added this stage and runs against the actual production build via
`vite preview`, in a real Chromium browser:

- App loads; grid (`treegrid`) and Gantt (`img` with dependency arrows,
  bars, milestones) both render against the sample data.
- Clicking a task in the grid selects the matching Gantt bar and vice
  versa (real click, real DOM, not a mocked interaction).
- After initial load, going offline (`context.setOffline(true)`) and
  interacting with the app makes **zero** network requests — verified
  by capturing every `request` event during the interaction and
  asserting the list is empty.

Command: `npx playwright test` — **3/3 passed**.

**Residual gap:** this is a smoke suite, not full e2e coverage. It does
not test drag/resize/dependency-creation (not yet implemented — see
§13), keyboard-only navigation end-to-end, print view, or multi-project
workflows. Expanding this suite is appropriate future work, not claimed
as done here.

## 5. Build

**Pass.** `npm run build` (`tsc -b && vite build`) succeeds. Output:
`dist/index.html` (0.43 kB), one CSS bundle (1.09 kB), one JS bundle
(161.74 kB, 52.04 kB gzipped). No build warnings.

## 6. Offline operation

**Pass, with a scoped claim.** Verified two ways:

1. **Static analysis**: `grep -oE "https?://[^\"' ]+" dist/assets/*.js`
   turns up only SVG/XML/XHTML namespace URIs (`w3.org/...`) and a
   static React error-decoder documentation URL embedded in an error
   *message string* — never fetched at runtime. No CDN script tags in
   `dist/index.html`.
2. **Runtime**: the Playwright test in §4 proves the loaded app makes no
   network requests during interactive use while offline.

**What this does *not* claim**: the app has no service worker, so a
hard page **reload** while the OS/browser has zero connectivity will
fail to re-fetch `index.html` — this is standard behavior for any
static site without a service worker, not a defect specific to this
app, but it means "offline-capable" here means *"requires no backend or
external API to function once loaded,"* not *"installable as an
offline-first PWA."* That distinction is now recorded in
`e2e/smoke.spec.ts` itself, not just this report.

## 7. Browser reload and persistence

**Partially verified — this is the most important residual gap in this
report.** The IndexedDB persistence layer (`src/persistence/`) is
thoroughly unit/integration-tested in isolation, including a simulated
reload (`src/tests/persistence/repository.test.ts`: close the DB
connection, reopen, confirm data is intact).

**However**, the rendered UI (`PlannerWorkspace`, wired up in
`src/app/main.tsx`) does **not currently read from or write to
IndexedDB at all** — it renders the static in-memory
`src/app/sampleData.ts` on every load. This means the Definition-of-Done
item "data persists after browser restart" is true of the persistence
*layer* (proven by tests) but **not yet true of the *application*** —
editing a task in the running app today does not persist anywhere.
Wiring the UI to the repository layer was not part of any stage's
explicit scope so far (Stages 2–8 built the layer and the grid/Gantt UI
as separate, independently-tested pieces per the plan's own
"vertical-slice" phasing) and was not silently assumed done — flagging
it here rather than letting it pass unnoticed is the point of this
report.

## 8. Import/export round trip

**Pass.** `src/tests/import-export/jsonBundle.test.ts` (JSON, including
a rejected-dangling-reference case), `csvTasks.test.ts` (CSV, including
row-level errors and formula-injection guarding), `xlsxTasks.test.ts`
(XLSX export, verified by reading the generated workbook back and
confirming cell values/types), `backup.test.ts` (full-database
backup/restore, including a rejected-corrupt-backup case that leaves
prior data untouched). All exercised again transitively by the sample
data (`enterpriseRagProgram.test.ts`), which round-trips a 150-task
program through `importProjectBundle`.

## 9. Scheduling correctness

**Pass.** 34 fixture-based tests (`calendar.test.ts`, `schedule.test.ts`)
covering every dependency type, lag/lead, cycle detection, all 8
constraint types, summary rollup, critical path (including multiple
disjoint paths), float, manual tasks, DST boundary handling, and 2
property-based invariant tests generating random acyclic graphs (200
runs) — which caught and led to fixing a genuine free-float
lag-accounting bug during Stage 3. The sample-data integrity test
additionally proves the engine is idempotent (recomputing the shipped
150-task program's schedule from scratch reproduces the same dates with
zero errors) — a real-world-shaped regression check beyond hand-picked
fixtures.

## 10. Accessibility

**Pass, automated + partial manual.** `src/tests/app/accessibility.test.tsx`
runs `axe-core` against the rendered `PlannerWorkspace` (jsdom) —
**zero violations**. `TaskGrid` exercises real keyboard navigation
(arrow keys, Enter) in its own test suite. Critical-path/status
indication uses `data-*` attributes plus visible text, not color alone
(verified by test assertion, not just visual inspection).

**Not verified**: a real screen-reader walkthrough (NVDA/VoiceOver) was
not performed — automated scans catch programmatically-detectable
issues (missing labels, contrast, ARIA misuse) but not all usability
issues a screen-reader user would encounter. This is a known category
gap in automated accessibility testing generally, noted rather than
elided.

## 11. Performance with 2 000 tasks

**Pass, after fixing a real bug found during this review.** Initial
measurement **hung for 60+ seconds** and had to be killed. Root cause:
`src/calculations/calendar.ts` constructed a brand-new
`Intl.DateTimeFormat` on every single call (a well-documented V8
performance pitfall), and `workingMinutesBetween` iterated day-by-day
for the float calculation on every task — with 2 000 tasks where many
have large slack (weeks of float), this compounded into hundreds of
thousands of formatter constructions.

Fix (both landed in this stage, not deferred):

1. Cache `Intl.DateTimeFormat` instances per time zone instead of
   constructing them per call.
2. Replace the day-by-day loop in `workingMinutesBetween` with a
   closed-form calculation (weekly-pattern arithmetic + a small
   exception-list adjustment) for the bulk of any date range, keeping
   only the two boundary days computed via precise interval clipping.

Measured after the fix (`src/tests/performance/largeSchedule.test.ts`,
`npx vitest run src/tests/performance`):

| Scenario | Budget (docs/PRD.md §18) | Measured |
|---|---|---|
| 500-task recalculation | < 250 ms | **~85–100 ms** |
| 2 000-task recalculation | < 1 000 ms | **~207–340 ms** |

Both comfortably inside budget, with real numbers from an actual run,
not an estimate.

**Not verified**: DOM rendering/scroll performance at 2 000 tasks in a
real browser. `src/features/wbs/TaskGrid.tsx` and
`src/features/gantt/GanttChart.tsx` render every visible row directly
with no virtualization/windowing — this was already flagged as a known
limitation in the Stage 4 README entry and remains unverified at scale.
The *calculation* engine meets budget; the *rendering* layer's budget
compliance is not yet measured and should not be assumed.

## 12. Security and privacy review

- **No secrets**: `grep` for API-key/token/password/private-key patterns
  across `src/`, `scripts/`, `docs/`, `sample-data/`, `package.json` —
  zero matches. No `.env` files present.
- **Formula injection**: guarded on CSV and XLSX export (tested).
- **XSS**: all user-authored text renders through React's default
  escaping; no `dangerouslySetInnerHTML` anywhere in `src/`.
- **Import validation**: strict zod schema + referential-integrity
  checks on every import path; row-level CSV errors; corrupted
  IndexedDB records are quarantined on read rather than crashing the
  app (tested).
- See `docs/SECURITY_AND_PRIVACY.md` for the full model, including the
  §5a XLSX-vulnerability-acceptance decision reaffirmed below.

## 13. Dependency licenses and vulnerabilities

Production runtime dependencies (`npm ls --omit=dev --depth=0`), all
license-checked directly from each package's own `package.json`:

| Package | License | Notes |
|---|---|---|
| `idb` | ISC | IndexedDB wrapper |
| `react`, `react-dom` | MIT | |
| `xlsx` | Apache-2.0 | export-only usage, see below |
| `zod` | MIT | |

All permissive, all safe to bundle into an offline distributable.
`ulid` was installed early but never actually imported anywhere in the
codebase — removed as dead weight during this review rather than left
in as speculative inclusion (`npm uninstall ulid`).

`npm audit --production`: **1 high-severity advisory**, in `xlsx`
(prototype pollution + ReDoS, both in its *parsing* path). This
application only ever calls the *write* path
(`XLSX.utils.json_to_sheet`/`XLSX.write`) — confirmed by reading
`src/import-export/xlsxTasks.ts` — and never calls `XLSX.read` on
untrusted input. This was already documented as an accepted, scoped
risk in `docs/SECURITY_AND_PRIVACY.md` §5a during Stage 7; reaffirmed
here after a fresh audit run rather than assumed still valid.

Dev-only dependencies (`vite`/`vitest`/`esbuild` toolchain) have their
own moderate advisories (a dev-server request-forwarding issue) that
have zero effect on the shipped `dist/` bundle — confirmed by
`npm audit --production` showing only the `xlsx` entry.

## 14. No external runtime network dependency

**Pass.** See §6 and §11. Confirmed by static bundle analysis and a
live Playwright network-request assertion, not by absence of a search.

## 15. No fabricated completion claims

This report itself is the enforcement mechanism for that requirement:
§7 and §11 above name specific, real gaps (UI not wired to persistence;
rendering not virtualized/perf-tested at scale; e2e suite is a smoke
test, not full coverage) rather than presenting a uniformly "done"
picture. No claim of Microsoft Project file-format compatibility is
made anywhere in the product (`README.md` states this explicitly).

## Residual risks (carried forward)

| # | Risk | Severity | Recommended next step |
|---|---|---|---|
| 1 | UI is not wired to IndexedDB persistence — edits in the running app do not persist | **High** | Wire `PlannerWorkspace` to `src/persistence/repository.ts`; this is the top priority before any further UI work |
| 2 | No virtualization in grid/Gantt; 2 000-task rendering performance unmeasured in a real browser | Medium | Add windowing (e.g. row virtualization) and a Playwright-based render-time measurement before claiming the 2 000-task UI budget is met |
| 3 | `xlsx` has two unfixed advisories in its parsing path | Low (mitigated) | Re-evaluate if XLSX import is ever added; do not add `XLSX.read` on user files without revisiting `SECURITY_AND_PRIVACY.md` §5a |
| 4 | No drag-to-move/resize/dependency-creation interactions yet | Medium | Planned but not yet built; Gantt is currently view/select-only |
| 5 | No service worker — hard reload while fully offline (zero connectivity, not just "no backend") will fail to re-fetch the page | Low | Out of scope for v1 per `docs/PRD.md`; would require a PWA/service-worker addition if ever needed |
| 6 | e2e coverage is a 3-test smoke suite, not comprehensive | Medium | Expand alongside future interaction features (drag/resize, print view, keyboard-only flows) |
| 7 | No real screen-reader manual walkthrough performed | Low | Automated axe-core scan passes; manual NVDA/VoiceOver pass recommended before a v1 accessibility sign-off |

## Definition of Done — final checklist

- [x] Approved requirements traceable to implementation and tests (`docs/IMPLEMENTATION_PLAN.md` traceability matrix)
- [x] Scheduling engine passes all focused tests (34 fixture + 2 property-based)
- [x] Sample project loads without validation errors (21 sample-data integrity tests)
- [x] WBS and Gantt remain synchronized (tested both directions)
- [x] Dependencies, calendars, constraints, critical path, baselines calculate correctly
- [x] Product and AI lifecycle records link to schedule items (Stage 5 gate rules, exercised against real sample data)
- [x] Resources, budgets, AI FinOps calculate correctly
- [ ] **Data persists after browser restart — persistence layer only, UI not wired (see §7 / residual risk #1)**
- [x] Backup and restore work (at the persistence-layer API level)
- [x] JSON and CSV round trips preserve data
- [x] XLSX exports open correctly (verified by reading them back)
- [x] No runtime internet connection required (during use; not across a hard offline reload — see §6)
- [x] Accessibility checks pass for core workflows (automated; no manual screen-reader pass — see residual risk #7)
- [ ] **Application usable with 2 000 tasks — calculation engine verified fast; UI rendering at that scale not yet measured (see §11 / residual risk #2)**
- [x] Security and dependency checks reviewed (§12–13)
- [x] README documents installation, use, and known limitations
- [x] Remaining limitations and unverified areas explicitly documented (this report)
- [x] No claim of Microsoft Project compatibility or unqualified full production readiness

**Overall assessment**: the domain model, scheduling engine, and
governance/FinOps logic are genuinely well-tested and, as of this
review, fast. The two starred items above are real, named gaps — not
polish items — and should be the next work before this is presented as
"production ready" in the full sense the source instructions define.
