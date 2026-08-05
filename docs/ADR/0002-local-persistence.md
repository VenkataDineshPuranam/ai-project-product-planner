# ADR-0002: IndexedDB for local persistence, JSON as canonical interchange

## Status
Proposed

## Context
The app must persist all data locally with no backend, survive browser
reload, support backup/restore, and remain performant with 2 000+ tasks
and their related entities.

## Decision
- Use IndexedDB (via a thin repository layer in `src/persistence/`,
  likely wrapping `idb` for ergonomics — evaluate at implementation time
  against hand-rolled IDB, decision recorded here once chosen) as the
  runtime store, keyed by entity type and id, with an object store per
  top-level entity collection.
- JSON is the canonical interchange format for full-project export,
  backup, and restore. Every persisted record carries `schemaVersion`;
  forward-only migrations are pure functions covered by tests
  (DATA_MODEL.md §7).
- All multi-record writes (e.g., cascading a WBS re-sequence) go through
  an IndexedDB transaction so partial writes cannot corrupt state.

## Consequences
- No server or account needed; works fully offline, satisfies Section 2
  and Section 19 constraints.
- IndexedDB has async, somewhat verbose APIs and per-browser quota
  limits — mitigated by keeping the schema normalized (avoid duplicating
  large blobs) and by the backup/export path being the recommended
  disaster-recovery mechanism rather than relying solely on browser
  storage durability.
- Corrupted-record recovery (SECURITY_AND_PRIVACY.md §5) requires
  per-record validation on read, adding a small perf cost that is
  acceptable against the persistence performance budget (300 ms save
  feedback, Section 18).
