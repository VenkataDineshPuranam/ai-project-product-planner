# PRD — AI Project and Product Management Planner

## 1. Summary

A local-first, offline-capable web application that combines traditional
Microsoft-Project-style scheduling (WBS, Gantt, dependencies, calendars,
critical path, baselines, resources, cost) with AI product-management
planning (discovery/delivery dual-track, roadmaps, OKRs) and AI/ML/LLM
engineering lifecycle management (datasets, models, prompts, RAG, agents,
evaluations, responsible-AI governance, FinOps/token economics).

It runs entirely in the browser after build, with no cloud account, API
key, or backend server. All data is persisted locally via IndexedDB, with
JSON as the canonical interchange format and CSV/XLSX for spreadsheet
interop.

## 2. Goals

- Provide a professional split-view planner: hierarchical WBS/task grid on
  the left, synchronized interactive Gantt chart on the right.
- Implement a deterministic, independently testable scheduling engine
  supporting four dependency types, calendars, constraints, critical path,
  baselines, and progress tracking — matching the rigor (not the file
  format) of Microsoft Project.
- Extend classic PM with AI-native planning: product discovery/delivery,
  AI lifecycle gates, evaluation scorecards, responsible-AI and security
  controls, and AI FinOps/token economics.
- Ship a realistic sample program (Enterprise RAG Assistant, 120+ tasks)
  that demonstrates every major feature and passes automated validation.
- Operate fully offline; no runtime network dependency.

## 3. Non-Goals (v1)

See `docs/PRD.md#version-1-boundaries` below — real-time multi-user
collaboration, cloud sync, native `.mpp` import/export, SSO, external
ticketing integration, silent auto-leveling, live provider billing
ingestion, production deployment actions, and autonomous governance
approvals are explicitly excluded from v1.

## 4. Primary Users

- **Program/Project Managers** — schedule, resource, and cost management
  across a portfolio of AI initiatives.
- **AI Product Managers** — discovery-track opportunity mapping, roadmap,
  OKRs, and feature delivery linkage.
- **AI/ML Engineers & Tech Leads** — dataset, model, prompt, RAG, and
  agent workstream tracking, evaluation contracts.
- **Risk, Security & Governance stakeholders** — RAID log, responsible-AI
  gates, evidence, and approvals.
- **Executives/Sponsors** — portfolio dashboards and executive reports.

## 5. Information Architecture

See Section 5 of the source instructions
(`instructions-for-project-planner.txt`) for the full breakdown of the five
primary areas: Portfolio Dashboard, Project Workspace, Product Workspace,
AI Engineering Workspace, Executive Reporting. This PRD adopts that
structure unchanged as the product's top-level navigation.

## 6. Functional Requirements (high level)

### 6.1 Scheduling & Gantt
- WBS hierarchy with summary tasks, milestones, indentation, expand/collapse.
- FS/SS/FF/SF dependencies with positive/negative lag.
- Manual and automatic scheduling modes.
- Constraints (ASAP, ALAP, SNET, SNLT, FNET, FNLT, MSO, MFO) and deadlines.
- Forward/backward pass CPM: early/late start/finish, total/free float,
  critical path (including multiple critical paths).
- Baselines vs. current schedule; variance.
- Resource assignments, calendars (project/resource/task), over-allocation
  detection, utilization histogram.
- Fixed cost, resource cost, AI inference cost, contingency.
- Status date and progress line; percent complete and physical percent
  complete.

### 6.2 Product Management
- Vision, personas, JTBD, problem statements, opportunity solution tree.
- Outcomes, OKRs, KPIs, benefit hypotheses.
- Epics/features/stories/experiments, acceptance criteria.
- Dual-track linkage: discovery evidence → delivery commitment gate.

### 6.3 AI Engineering Lifecycle
- Use-case qualification, AI-vs-non-AI decision, dataset readiness gates.
- Model/prompt/RAG/agent/tool workstreams with versioning.
- Evaluation contracts, metrics (accuracy, groundedness, relevance, safety,
  latency, cost), evaluation runs.
- Responsible-AI/security controls, human-review gates, deployment gates.
- Pilot/shadow/canary/production rollout tracking.

### 6.4 AI FinOps
- Planned/actual/forecast cost by category (training, inference,
  embeddings, reranking, storage, data processing, evaluation,
  observability, human review, tooling, infra, third-party APIs, support).
- Token/request/cache/tool-call/agent-step metrics; cost per accepted
  outcome; budget thresholds and variance.
- Quality-vs-cost views; never present lower token use as success when
  quality/safety/outcome degrades.

### 6.5 Governance
- RAID log with AI-specific risk categories.
- Nine mandatory gates (use-case approval → retirement) with entry
  criteria, evidence, approvers, decision, conditions, expiry.

### 6.6 Import/Export & Reporting
- Versioned JSON import/export (canonical), validated CSV, locally
  bundled XLSX export, backup/restore.
- Print-friendly and executive reports; reports must state their data
  date and never fabricate missing values.

## 7. Acceptance Criteria (representative — full matrix in traceability doc)

| Area | Acceptance Criterion |
|---|---|
| Scheduling | Given a project with FS/SS/FF/SF dependencies and mixed lag, CPM output matches hand-computed expected early/late dates and float within engine unit tests. |
| Calendars | Duration arithmetic across a non-working weekend and a holiday produces the correct finish date, verified by test fixtures. |
| Baselines | Setting a baseline then editing dates produces correct start/finish/duration/cost variance. |
| Gantt/Grid sync | Scrolling or selecting a row in the grid scrolls/highlights the corresponding Gantt row, and vice versa. |
| Governance | A feature cannot be marked "committed" without linked outcome, acceptance criteria, evaluation criteria, and owner (validation error otherwise). |
| FinOps | Cost-per-accepted-outcome recalculates correctly when token volume or unit price changes. |
| Persistence | Data survives a full browser reload with no data loss (IndexedDB round trip). |
| Import/Export | A JSON export re-imported into an empty instance reproduces an identical project (deep-equal on canonical fields). |
| Offline | Application loads and functions with network disabled after build. |

## 8. Definition of Done

See Section 20 of the source instructions — reproduced in
`docs/TEST_STRATEGY.md#definition-of-done`.

## 9. Open Questions / Assumptions

- Target browsers: latest two versions of Chrome, Edge, Firefox (desktop).
  No mobile support in v1.
- Single-user, single-device operation; no conflict resolution needed
  since there is no sync.
- XLSX export only (no XLSX import) in v1 unless a later stage approves
  import — reduces the risk of executing untrusted spreadsheet formulas.
- "Property-based tests for schedule invariants" (Section 16, Prompt 3)
  will use `fast-check` if bundle/dev-dependency size is acceptable;
  otherwise a generated-fixture approach is used instead. Decision
  recorded in ADR-0004.
