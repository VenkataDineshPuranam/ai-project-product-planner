# Test Strategy

## 1. Layers

| Layer | Tool | Scope |
|---|---|---|
| Unit | Vitest | Domain model, validation, scheduling engine, calculations, import/export parsers |
| Integration | Vitest + fake-indexeddb | Persistence repository round trips, migration chains, cross-module linkage (feature→task, evaluation→gate) |
| End-to-end | Playwright | Grid/Gantt interaction, keyboard nav, drag/resize, undo/redo, reload persistence, print view, offline load |
| Static | tsc --strict, ESLint | Type safety, lint rules, no `any` leakage in domain/scheduling |

## 2. Scheduling engine tests (write before implementation)

Fixtures under `src/tests/scheduling/fixtures/`, one JSON+expected-output
pair per case, covering (mirrors source instructions Section 17):

- Zero-duration milestones.
- Weekend-only and holiday-only non-working time.
- Split working-hour days (e.g., 9–12, 13–17).
- Cross-month and cross-year schedules.
- DST spring-forward / fall-back boundary crossing a task duration.
- Each dependency type individually (FS, SS, FF, SF) with zero lag.
- Positive lag and negative lag (lead) for each dependency type.
- Multiple predecessors driving a single successor.
- Multiple successors from a single predecessor.
- Dependency cycles (2-node and N-node) → `CYCLE` error, no partial dates.
- Each constraint type (ASAP, ALAP, SNET, SNLT, FNET, FNLT, MSO, MFO),
  including an infeasible case that must warn, not silently ignore.
- Deadline exceeded → warning only, dates unaffected.
- Summary task rollup with 1, 2, and 3 levels of nesting.
- Critical path with a single path and with two disjoint critical paths.
- Total float and free float on a task with slack.
- Actuals + status date reschedule of remaining work.
- Baseline set, then edited, then variance computed.
- Manually scheduled task ignored by forward pass but still honored by
  successors' dependency math.
- Resource calendar override producing a different finish than the task
  calendar alone would.

Where practical, use `fast-check` (see ADR-0004) to property-test
invariants: `EF >= ES`, `LS <= LF`, `totalFloat >= freeFloat >= 0` for
non-critical tasks, `isCritical => totalFloat <= 0`, no cycle survives
undetected across randomly generated DAGs.

## 3. Data / persistence tests

- Invalid/duplicate IDs rejected on write.
- Orphan `parentId` rejected.
- Circular WBS hierarchy rejected.
- Circular dependency graph rejected (delegates to scheduling engine
  validation).
- Invalid dates (non-ISO, finish < start) rejected.
- Invalid percentages (outside 0–100) rejected.
- Unknown resource/owner/workstream references rejected.
- Broken cross-entity references (feature→outcome, evaluation→gate, etc.)
  rejected with row/field-level error detail.
- Schema migration: a fixture at `schemaVersion: N-1` migrates to `N` and
  matches expected shape, for every migration added.
- JSON import/export round trip is deep-equal on canonical fields.
- Corrupted IndexedDB record (malformed JSON, missing required field) is
  detected on load and surfaced as a recoverable error, not a crash —
  app offers export-what-can-be-read or reset-this-project, never silent
  data loss.

## 4. UI / e2e tests (Playwright)

- Grid selection scrolls/highlights the matching Gantt row and vice
  versa.
- Expand/collapse persists across reload.
- Keyboard-only task creation, edit, dependency creation, and deletion.
- Drag-to-move and resize-to-change-duration update grid values
  correctly, including the confirmation flow when successors are
  affected.
- Dependency creation by drag produces the correct `Dependency` record.
- Undo/redo across a mixed sequence of grid and Gantt edits.
- Filter/group/sort do not corrupt underlying WBS order.
- Zoom level changes preserve scroll position (same task visible).
- Print view renders a static, paginated snapshot matching current data.
- Full reload (simulated browser restart) preserves all data via
  IndexedDB.
- Large schedule (2 000 tasks, generated fixture) scrolls smoothly and
  recalculates within the performance budget (measured, not assumed).
- Automated accessibility scan (axe-core via Playwright) on grid, Gantt,
  and report views with zero critical/serious violations.

## 5. AI module tests

- A gate cannot show "passed" without all required evidence links
  present.
- `Feature.committed = true` blocked unless outcome, acceptance criteria,
  evaluation criteria, owner, and release are all set (validation test).
- Model/prompt version changes are traceable: an `EvaluationRun`
  referencing a retired `ModelVersion`/`PromptVersion` is still
  resolvable (no dangling reference after version supersession).
- Cost-per-accepted-outcome calculation matches hand-computed expected
  value for a fixture with known token volumes and rates.
- Token-budget alert fires when consumed/limit crosses threshold, and
  does not fire below it.
- Governance approval required before a `DeploymentGate` can be marked
  passed.
- Risk with `treatment` unset and `likelihood*impact` above threshold
  blocks the linked milestone from being marked complete (soft warning,
  not a hard block, since Section 19 excludes autonomous governance
  approvals/blocks — UI surfaces the conflict, user decides).
- Missing quality metric on an `EvaluationRun` produces a warning, not a
  fabricated default value.

## 6. Non-functional checks

- Bundle contains no network calls at runtime (verified by an e2e test
  running with network disabled/blocked).
- No secrets or API keys checked into the repo (basic secret-pattern
  scan as part of CI-equivalent local check).
- Dependency license and vulnerability review before Stage 9 sign-off.

## 7. Definition of Done

Reproduced from source instructions Section 20 — a checklist gate before
declaring any stage or the overall product "done":

- [ ] Approved requirements traceable to implementation and tests.
- [ ] Scheduling engine passes all focused tests.
- [ ] Sample project loads without validation errors.
- [ ] WBS and Gantt remain synchronized.
- [ ] Dependencies, calendars, constraints, critical path, baselines
      calculate correctly.
- [ ] Product and AI lifecycle records link to schedule items.
- [ ] Resources, budgets, AI FinOps calculate correctly.
- [ ] Data persists after browser restart.
- [ ] Backup and restore work.
- [ ] JSON and CSV round trips preserve data.
- [ ] XLSX exports open correctly.
- [ ] No runtime internet connection required.
- [ ] Accessibility checks pass for core workflows.
- [ ] Application usable with 2 000 tasks.
- [ ] Security and dependency checks reviewed.
- [ ] README covers installation, use, backup, recovery, troubleshooting.
- [ ] Remaining limitations and unverified areas explicitly documented.
- [ ] No unverified claim of MS Project compatibility or full production
      readiness.
