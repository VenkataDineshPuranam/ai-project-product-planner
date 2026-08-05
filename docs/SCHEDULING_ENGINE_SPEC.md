# Scheduling Engine Specification

The scheduling engine (`src/calculations/` + `src/domain/scheduling/`) is a
pure, deterministic, UI-independent TypeScript module. It takes a project
snapshot (tasks, dependencies, calendars, resources) and produces computed
schedule fields (dates, float, critical flag) without side effects. It must
be fully testable via Vitest with no DOM.

## 1. Design principles

- **Pure functions.** `computeSchedule(input: ScheduleInput): ScheduleOutput`.
  No mutation of input; no I/O; no `Date.now()` except where a status date
  is explicitly not supplied (falls back to input's own status date field,
  never wall-clock, to keep tests deterministic).
- **Explicit calendar arithmetic.** All duration math goes through a
  `CalendarEngine` that resolves working time in a given IANA time zone.
  No naive `Date` day-adding.
- **Fail loud.** Cycles, invalid references, and impossible constraints
  produce a typed `ScheduleError[]`, never a silently wrong schedule.

## 2. Calendar logic

`CalendarEngine` responsibilities:

- Resolve a `Calendar` (with `baseCalendarId` inheritance — override wins)
  to a working-time predicate over any UTC instant, correctly localized to
  `Calendar.timeZone`.
- `addWorkingMinutes(start, minutes, calendar): Date` and its inverse
  `workingMinutesBetween(start, end, calendar): number`.
- Support multiple working-hour intervals per day (split shifts).
- Resource calendars override the project/task calendar for the portion of
  work assigned to that resource; task calendar governs unassigned work.
- All date-time values are stored/compared as ISO 8601 UTC strings; local
  wall-clock working hours are derived via `Calendar.timeZone`, so DST
  transitions do not shift working-hour boundaries.

## 3. Dependency logic

For a `Dependency` of `type` with `lagMinutes` (may be negative):

| Type | Rule |
|---|---|
| FS | successor.start ≥ predecessor.finish + lag |
| SS | successor.start ≥ predecessor.start + lag |
| FF | successor.finish ≥ predecessor.finish + lag |
| SF | successor.finish ≥ predecessor.start + lag |

- Multiple predecessors: successor's driving date is the latest (forward
  pass) / earliest (backward pass) constraint among all applicable edges.
- Cycle detection: build a directed graph over `Task.id` via
  `Dependency` edges; run DFS/Kahn's algorithm before scheduling. On cycle,
  return `ScheduleError{ code: "CYCLE", taskIds: [...] }` and abort
  recalculation for the affected component (rest of the project still
  schedules).
- Manually scheduled tasks (`schedulingMode: "manual"`) are not moved by
  dependency propagation; they still participate in successors'
  constraint math using their fixed dates, and are flagged in the UI as
  not honoring auto-computed dates when they conflict.

## 4. Critical Path Method

1. Topologically order tasks by the dependency graph (per project;
   summary tasks excluded from the graph and computed by rollup instead).
2. **Forward pass**: `ES`/`EF` per task honoring dependencies, calendars,
   and constraints (`ASAP` tasks only; `ALAP` handled in backward-first
   mode — see §5).
3. **Backward pass**: from project finish (or deadline-constrained tasks),
   compute `LS`/`LF`.
4. `totalFloatMinutes = LS - ES` (in working minutes); `freeFloatMinutes`
   = minutes task can slip without delaying any successor's ES.
5. `isCritical = totalFloatMinutes <= 0` (configurable epsilon = 0 by
   default). Multiple disjoint critical paths are expected and supported
   — no assumption of a single path.
6. Summary task dates = min(child ES) / max(child EF); summary
   `isCritical` is derived (true if any child is critical), never
   independently computed, to avoid circular calculation.
7. Recalculation is triggered on any edit to tasks/dependencies/calendars
   and must be idempotent and re-runnable from scratch (no incremental
   state carried between runs in v1 — correctness over micro-optimization,
   revisit only if the 250 ms/2 000-task budget requires it).

## 5. Constraints

| Constraint | Effect on forward/backward pass |
|---|---|
| ASAP | default; start as early as dependencies allow |
| ALAP | start as late as possible without delaying successors |
| SNET | start ≥ constraintDate |
| SNLT | start ≤ constraintDate (warn if infeasible) |
| FNET | finish ≥ constraintDate |
| FNLT | finish ≤ constraintDate (warn if infeasible) |
| MSO | start = constraintDate (hard) |
| MFO | finish = constraintDate (hard) |

`deadline` never constrains the computed schedule; it only produces a
`ScheduleWarning` when the computed finish exceeds it (Section 8.4 of
source instructions).

## 6. Progress & forecasting

- `statusDate` drives "as-of" recalculation: incomplete work at/behind the
  status date is treated as rescheduled forward per the project's
  rescheduling policy (v1: incomplete remaining work moves to start no
  earlier than statusDate, auto tasks only).
- `forecastFinish` = computed finish using remaining work + remaining
  dependencies as of status date.
- `scheduleVarianceMinutes = forecastFinish - baselineFinish`.
- Milestone slippage surfaced wherever `finish` (or `baselineFinish` if
  present) moves versus the last captured baseline.
- Earned value fields (`PV`, `EV`, `AC`, `SPI`, `CPI`) computed only when
  the project has resource cost data; otherwise omitted, not
  zero-filled (Section 14: never fabricate missing values).

## 7. Resource scheduling

- `Assignment.plannedWorkMinutes` combined with `Resource.maxUnits` and
  the resource's calendar determines whether the resource is
  over-allocated on a given day (`sum(units) > maxUnits`).
- Over-allocation is surfaced (resource histogram, indicator) but never
  auto-resolved by moving task dates unless the user explicitly invokes a
  "leveling suggestion" action, and that action always requires
  confirmation before applying (Section 8.6, Section 19).

## 8. Errors & Warnings (typed)

```ts
type ScheduleError =
  | { code: "CYCLE"; taskIds: string[] }
  | { code: "INVALID_CONSTRAINT"; taskId: string; reason: string }
  | { code: "MISSING_CALENDAR"; taskId: string; calendarId: string }
  | { code: "BROKEN_REFERENCE"; entity: string; id: string; field: string };

type ScheduleWarning =
  | { code: "DEADLINE_MISSED"; taskId: string; deadline: string; forecastFinish: string }
  | { code: "OVER_ALLOCATION"; resourceId: string; date: string }
  | { code: "MANUAL_TASK_CONFLICT"; taskId: string };
```

## 9. Performance budget

- < 250 ms recalculation for a 500-task project; < 1 s for 2 000 tasks
  (Section 18). Achieved via: O(V+E) topological sort/CPM, memoized
  calendar working-time lookups, and avoiding recomputation of unaffected
  subgraphs where profiling shows it's needed (documented exception
  required if a non-linear path is kept).

## 10. Test-first requirement

No implementation code is written before the corresponding test in
`src/tests/scheduling/` exists and fails for the right reason. See
TEST_STRATEGY.md §2 for the full fixture list.
