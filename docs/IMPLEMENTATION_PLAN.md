# Phased Implementation Plan

This plan follows the staged prompts in Section 16 of
`instructions-for-project-planner.txt`. Each stage is a separate work
session/review gate — never collapse stages, per the source doc's own
warning against building the entire product in one run.

## Phase order and dependencies

```
Stage 1  Docs & architecture (this stage)          — no code deps
Stage 2  Domain model + persistence                — depends on Stage 1 data model
Stage 3  Scheduling engine (tests first)           — depends on Stage 2 types
Stage 4  Task grid + Gantt UI                       — depends on Stage 3 (tested engine)
Stage 5  Product & AI lifecycle modules             — depends on Stage 2 domain, Stage 4 UI shell
Stage 6  Resources, cost, AI FinOps                 — depends on Stage 2/3 (assignments, cost fields)
Stage 7  Import/export & reports                    — depends on Stage 2 (schema), Stage 6 (cost fields in reports)
Stage 8  Sample data (Enterprise RAG program)        — depends on Stages 2–7 (exercises full schema)
Stage 9  End-to-end production-readiness review      — depends on all prior stages
```

## Stage 1 — Documentation & architecture (this delivery)

Deliverables: PRD.md, DATA_MODEL.md, SCHEDULING_ENGINE_SPEC.md,
UX_SPEC.md, TEST_STRATEGY.md, SECURITY_AND_PRIVACY.md, ADR-0001..0004,
this implementation plan, traceability matrix (below), risk register
(below). No production code. Repo directory scaffolding created; no
`package.json`/build tooling pinned yet — deferred to Stage 2 so tooling
choices are made against real domain-model needs rather than guessed
upfront.

**Smallest working vertical slice (for Stage 2 onward):** a single
project with 3 tasks and one FS dependency, entered via a minimal grid,
scheduled by the engine, persisted to IndexedDB, and surviving reload.
Every later stage extends this slice rather than starting a parallel
path.

## Stage 2 — Domain model & persistence

- Implement typed entities from DATA_MODEL.md in `src/domain/`.
- Validation schemas in `src/validation/` (referential integrity rules,
  §6 of DATA_MODEL.md).
- Repository interfaces + IndexedDB implementation in `src/persistence/`.
- Schema versioning + migration harness, tested with at least one
  synthetic migration.
- Tests written first (Vitest): entity validation, repository CRUD,
  transaction rollback, corrupted-record recovery.
- Explicitly excluded: Gantt UI, grid UI, any rendering.

## Stage 3 — Scheduling engine

- Implement `src/calculations/` + `src/domain/scheduling/` per
  SCHEDULING_ENGINE_SPEC.md.
- Tests written first per TEST_STRATEGY.md §2 fixture list; do not
  proceed to Stage 4 until this focused suite passes.
- Property-based invariant tests per ADR-0004.

## Stage 4 — Task grid & Gantt UI

- `src/features/wbs/`, `src/features/gantt/`, shared sync hook.
- Built against the tested engine from Stage 3 — no scheduling logic
  duplicated in UI code.
- Virtualization, accessibility (ARIA treegrid, focus management),
  keyboard operations, drag/resize/dependency-creation interactions.
- Excluded: product-management and AI lifecycle modules.

## Stage 5 — Product & AI lifecycle modules

- `src/features/product-roadmap/`, plus AI entities from DATA_MODEL.md
  §4 wired into `src/features/evaluations/`, `src/features/governance/`.
- Linkage enforcement: `Feature.committed` gate, evaluation contract →
  gate → deployment gate chain.
- Unit + integration tests for linkage rules.

## Stage 6 — Resources, cost, AI FinOps

- `src/features/resources/`, `src/features/budgets/`.
- Assignment/cost-rate calculations, over-allocation detection, resource
  histogram.
- AI FinOps: token/cost tracking, cost-per-accepted-outcome, budget
  thresholds, quality-vs-cost views — must not let cost optimizations
  weaken validation (Section 16, Prompt 6).

## Stage 7 — Import/export & reports

- `src/import-export/`: versioned JSON, validated CSV (row-level
  errors), locally bundled XLSX export.
- Formula-injection guarding on export (SECURITY_AND_PRIVACY.md §3).
- `src/features/reporting/`: report templates listed in Section 14,
  print-friendly styling.
- Backup/restore flow.

## Stage 8 — Sample data

- `sample-data/enterprise-rag-program.json` (9-month program, 120+
  tasks, 20+ milestones, 15+ resources, all four dependency types,
  positive/negative lag, baseline vs current, over-allocation examples,
  risks/issues/assumptions/decisions, evaluation scorecards, governance
  gates, FinOps data, rollout stages) per Section 15.
- `sample-data/ai-product-roadmap.json`, `sample-data/resource-calendar.json`.
- Automated sample-data integrity test validating WBS hierarchy,
  dependency graph, calendars, resources, costs, baselines, critical
  path, risks, gates, evaluation data.

## Stage 9 — End-to-end production-readiness review

Run and report on: type checks, lint, unit tests, integration tests,
e2e tests, build, offline operation, reload persistence, import/export
round trip, scheduling correctness, accessibility, 2 000-task
performance, security/privacy review, dependency license/vulnerability
review, no external runtime network dependency, no secrets, no
fabricated completion claims. Produce an evidence-based completion
report with residual risks — fix root causes rather than suppressing
failing checks.

## What is deliberately excluded from v1

See PRD.md §3 / source instructions Section 19: real-time multi-user
collaboration, cloud sync, native `.mpp` import/export, enterprise SSO,
external ticketing integrations, silent auto-leveling, live
model-provider billing ingestion, production deployment actions,
autonomous governance approvals.

## Migration & rollback considerations

- Every schema change ships with a forward migration and a test fixture
  at the prior version; no in-place breaking changes without a
  migration path.
- Local backup (JSON export) is the rollback mechanism — restoring an
  older export is always supported since JSON is the canonical format
  and migrations are additive/forward-only within a given exported
  version.

## Performance budgets (carried from source Section 18)

- First meaningful screen ≤ 2 s after local build, normal laptop.
- Smooth scroll at 2 000 tasks.
- Schedule recalculation < 250 ms (500 tasks) / < 1 s (2 000 tasks).
- Local save feedback < 300 ms.
- No undocumented quadratic algorithm on common task-edit paths.
- Lazy-load non-critical reports; virtualize long lists.
- All budgets measured (Playwright/perf harness), not assumed, before
  Stage 9 sign-off.

## Accessibility requirements

WCAG 2.1 AA contrast; full keyboard operability for add/edit/delete
task, dependency creation, baseline set, grid/Gantt navigation; ARIA
treegrid semantics; non-color-only status/critical/risk indication;
`prefers-reduced-motion` respected. Verified via axe-core in Playwright
(TEST_STRATEGY.md §4).

## Browser support

Latest two versions of Chrome, Edge, Firefox, desktop only, per
PRD.md §9. No IE/legacy support; no mobile layout in v1.

## Offline packaging approach

Vite production build outputs fully static assets (HTML/JS/CSS) with all
dependencies (including XLSX library) bundled at build time — no runtime
CDN fetch. The build output can be served from any static file host or
opened via a local server with no backend process required. Verified by
an e2e test run with network access disabled.

## Definition of done

See TEST_STRATEGY.md §7 (reproduced from source Section 20).

---

# Requirements Traceability Matrix (representative — extended per stage)

| Source requirement (§) | Doc reference | Test/acceptance criterion |
|---|---|---|
| §7 Task/Dependency/Assignment types | DATA_MODEL.md §2.1 | Stage 2 unit tests: entity shape + validation |
| §8.1 Calendar logic | SCHEDULING_ENGINE_SPEC.md §2 | Stage 3 fixtures: weekends, holidays, split shifts, DST |
| §8.2 Dependency logic | SCHEDULING_ENGINE_SPEC.md §3 | Stage 3 fixtures: FS/SS/FF/SF, lag/lead, cycles |
| §8.3 CPM | SCHEDULING_ENGINE_SPEC.md §4 | Stage 3 fixtures: float, multiple critical paths, rollup |
| §8.4 Constraints | SCHEDULING_ENGINE_SPEC.md §5 | Stage 3 fixtures: all 8 constraint types + infeasible case |
| §8.5 Progress/forecasting | SCHEDULING_ENGINE_SPEC.md §6 | Stage 3 fixtures: status date reschedule, variance |
| §8.6 Resource scheduling | SCHEDULING_ENGINE_SPEC.md §7 | Stage 6 tests: over-allocation, histogram, no silent leveling |
| §9 Gantt UX | UX_SPEC.md §2–3 | Stage 4 Playwright: sync, drag/resize, dependency creation, zoom |
| §9.3 Accessibility | UX_SPEC.md §5 | Stage 4/9 axe-core scan, keyboard-only e2e |
| §10 AI lifecycle phases | IMPLEMENTATION_PLAN.md Stage 5; PRD.md §6.3 | Stage 8 sample data covers all 10 phases |
| §11 Dual-track product model | PRD.md §6.2, DATA_MODEL.md §3 | Stage 5 test: Feature.committed gate blocks incomplete features |
| §12 AI FinOps | PRD.md §6.4, DATA_MODEL.md §4 | Stage 6 tests: cost-per-outcome, budget threshold, quality-vs-cost |
| §13 RAID + gates | DATA_MODEL.md §5 | Stage 5/8 tests: 9 mandatory gates present with evidence/approvers |
| §14 Reports | PRD.md §6.6 | Stage 7: each report states data date, no fabricated values |
| §15 Sample project | IMPLEMENTATION_PLAN.md Stage 8 | Stage 8 automated integrity test |
| §17 Test requirements | TEST_STRATEGY.md | All stages: tests exist before/with implementation |
| §18 Performance budgets | IMPLEMENTATION_PLAN.md (this doc) | Stage 9: measured perf harness results |
| §19 V1 boundaries | PRD.md §3 | Stage 9: README documents exclusions explicitly |
| §20 Definition of done | TEST_STRATEGY.md §7 | Stage 9 sign-off checklist |

---

# Risk Register

| ID | Risk | Category | Likelihood | Impact | Mitigation |
|---|---|---|---|---|---|
| R1 | Scheduling engine produces incorrect dates under complex dependency/constraint combinations | Schedule-calculation | Medium | High | Test-first development (Stage 3), fixture + property-based tests before any UI is built (ADR-0001, ADR-0004) |
| R2 | IndexedDB corruption or browser storage eviction causes data loss | Data-loss | Low-Medium | High | Per-record validation on load, transactional writes, JSON export/backup as documented recovery path (ADR-0002) |
| R3 | Gantt rendering degrades below performance budget at 2 000 tasks | Performance | Medium | Medium | Virtualization from the start (ADR-0003), measured perf tests before Stage 9 sign-off, canvas fallback documented |
| R4 | Bundled XLSX library has license terms incompatible with offline redistribution, or ships known vulnerabilities | Licensing/Security | Low | Medium | License + vulnerability check before adoption (SECURITY_AND_PRIVACY.md §4/§6), recorded in an ADR at Stage 7 |
| R5 | Imported CSV/XLSX/JSON content triggers XSS or formula injection when re-opened in a spreadsheet tool | Security | Low | High | Strict schema validation, text-only rendering, export-time formula neutralization (SECURITY_AND_PRIVACY.md §3) |
| R6 | UI features (drag/resize/dependency creation) are inaccessible to keyboard/screen-reader users | Usability/Accessibility | Medium | Medium | Accessibility requirements baked into UX_SPEC.md from Stage 4, axe-core gate before sign-off |
| R7 | Scope creep collapses multiple stages into one agent run, producing shallow/unreviewed code (the failure mode the source doc explicitly warns against) | Process | Medium | High | Enforce stage-by-stage review gates per this plan; fresh context per stage (Section 21) |
| R8 | Sample data (120+ tasks) is internally inconsistent (broken references, invalid schedule) and undermines confidence in the engine | Data quality | Medium | Medium | Automated sample-data integrity test required before Stage 8 sign-off (TEST_STRATEGY.md §3) |
| R9 | Claims of "Microsoft Project compatibility" or "production ready" get made without evidence | Credibility/Compliance | Low | Medium | Explicit rule in PRD.md §3 and Definition of Done; Stage 9 report must be evidence-based |
