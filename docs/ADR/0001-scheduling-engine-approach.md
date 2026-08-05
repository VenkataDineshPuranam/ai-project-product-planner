# ADR-0001: Custom in-house scheduling engine

## Status
Proposed

## Context
The application needs deterministic CPM scheduling with four dependency
types, calendar-aware duration math, constraints, baselines, and float
calculation — matching Microsoft Project's rigor without claiming file
compatibility. Third-party JS scheduling/CPM libraries are scarce,
mostly bundled with a specific Gantt UI (coupling risk), of uncertain
maintenance status, and rarely expose calendar/constraint semantics to
the level Section 8 of the source instructions requires.

## Decision
Implement the scheduling engine in-house as a pure TypeScript module
(`src/calculations/`, `src/domain/scheduling/`), independent of any UI or
Gantt rendering library, per SCHEDULING_ENGINE_SPEC.md. Do not adopt a
third-party CPM/scheduling library for v1.

## Consequences
- Full control over calendar inheritance, DST-safe time-zone handling,
  four dependency types, and constraint semantics — testable in
  isolation with Vitest before any UI exists.
- More upfront engineering effort than adopting a library, but avoids
  license/maintenance/coupling risk and avoids overclaiming
  compatibility we haven't implemented.
- Revisit only if profiling under the 2 000-task performance budget
  shows the in-house implementation cannot meet it after reasonable
  optimization — in that case evaluate a computational (not UI) library
  addition, not a wholesale replacement.
