# ADR-0004: fast-check for scheduling invariant property tests

## Status
Proposed

## Context
Section 16 (Prompt 3) asks for property-based or generated tests for
schedule invariants where practical, in addition to fixture-based tests
for specific dependency/constraint/calendar cases.

## Decision
Add `fast-check` as a dev dependency for the scheduling engine test
suite only. Use it to generate random valid DAGs of tasks/dependencies
(bounded size) and assert invariants: `EF >= ES`, `LS <= LF`,
`totalFloat >= freeFloat >= 0` for non-critical tasks, `isCritical =>
totalFloat <= 0`, and that cycle detection never leaves a schedule
partially computed. Fixture-based tests remain the primary vehicle for
specific documented behaviors (each dependency type, each constraint,
DST boundaries); property tests supplement rather than replace them.

## Consequences
- Small added dev-dependency footprint (test-only, not in the production
  bundle, so it has no effect on offline/runtime constraints).
- Higher confidence that CPM invariants hold across inputs beyond the
  hand-picked fixtures, at the cost of slightly longer test-suite runtime
  — acceptable since this suite runs pre-commit/pre-stage, not on every
  keystroke.
