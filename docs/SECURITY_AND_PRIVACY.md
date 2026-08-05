# Security & Privacy Specification

## 1. Operating model

Single-user, local-first, offline application. No backend server, no
account system, no telemetry beacon. The primary "attacker" surfaces in
v1 are: malicious/malformed imported files, and XSS via rendered
user-authored content (task names, descriptions, notes).

## 2. Data handling

- All project data lives in the browser's IndexedDB for the origin the
  app is served from. No data leaves the device at runtime.
- Export files (JSON/CSV/XLSX) are written to the user's chosen location
  via the browser's file-save mechanism; the app does not upload them
  anywhere.
- No secrets, API keys, or credentials are stored, requested, or
  required — the app has no external API dependency to authenticate to.

## 3. Import validation (JSON/CSV)

- Imports are parsed with a strict schema validator (see DATA_MODEL.md);
  unknown/extra fields are dropped or flagged, never executed.
- CSV/JSON content is **never** evaluated as code or rendered as raw
  HTML/markup. All user-authored text fields are rendered as text nodes
  (React's default escaping) — no `dangerouslySetInnerHTML` on imported
  or user-entered content anywhere in the app.
- CSV formula-injection guard: any cell value beginning with `=`, `+`,
  `-`, `@`, tab, or CR that could be interpreted as a spreadsheet formula
  is neutralized (prefixed) on **export** so opening the file in Excel/
  Sheets cannot trigger formula execution.
- Row-level import errors are collected and reported with row number and
  reason; a single bad row does not silently drop or corrupt the rest of
  the import — the import is all-or-nothing per validated batch, with a
  clear diff of what would change before commit.
- Import size/row-count sanity limits are enforced before parsing to
  avoid pathological memory use from a malformed file.

## 4. XLSX handling

- XLSX **export only** in v1 (see PRD open questions). If XLSX import is
  added later, it must go through the same strict schema validation as
  JSON/CSV and must not execute embedded macros/formulas — the bundled
  library must be evaluated for macro-stripping behavior before import
  is enabled.
- The XLSX library is bundled locally (no CDN fetch) and pinned to an
  exact version; license compatibility (must permit local/offline
  commercial use) is verified before adoption and recorded in an ADR.

## 5. Persistence integrity

- Writes to IndexedDB are wrapped in transactions; partial writes cannot
  leave a project in a half-updated state.
- On load, each record's `schemaVersion` and required-field shape is
  validated before use; a corrupted record is isolated (not silently
  coerced) and surfaced to the user with recovery options (export
  readable portion, or reset the affected project) — never a silent
  data loss or crash of the whole app.
- Backup/restore (manual JSON export/import of the full local database)
  is the v1 disaster-recovery mechanism; documented in the README.

## 5a. XLSX library known-vulnerability decision (Stage 7)

The bundled `xlsx` (SheetJS community edition 0.18.5, Apache-2.0) package
has two known, currently unfixed advisories: a prototype-pollution issue
and a ReDoS issue, both in its **parsing** (`XLSX.read`/`readFile`) path.
Per §4, this application only ever calls the **write** path
(`XLSX.utils.json_to_sheet`, `XLSX.write`) to export data the application
already holds — application code never calls `XLSX.read` on a file
selected by the user or from any external source. `src/import-export/xlsxTasks.ts`
carries an explicit comment recording this constraint. Both advisories are
therefore assessed as not exploitable through this application's own code
paths; the risk would only materialize if a future change added XLSX
*import*, which would require re-evaluating this decision (and per
`docs/PRD.md` §9/§19, XLSX import is not planned for v1). Recorded here
rather than silently accepting `npm audit` output.

## 6. Dependency & build security

- All runtime dependencies are vetted for license (must permit bundling
  into an offline distributable) and known vulnerabilities before
  adoption; `npm audit`-equivalent check is part of Stage 9 sign-off.
- No CDN-loaded scripts, fonts, or stylesheets at runtime — everything is
  bundled by Vite into the local build output.
- Content-Security-Policy suitable for a fully offline app (no
  `connect-src` beyond `'self'`) is documented for anyone hosting the
  built static files, even though the app requires no server.

## 7. Responsible-AI / governance data note

This app tracks *records about* AI systems (evaluation scores, gate
approvals, risk register entries) — it does not itself call any model
provider or process the AI systems' live data. "Responsible AI" features
here are planning/governance bookkeeping, not runtime AI safety
enforcement; the UX and reports must not imply otherwise (Section 12:
never claim quality/safety success that isn't independently evidenced).

## 8. Threat summary (v1)

| Threat | Mitigation |
|---|---|
| XSS via task/description/notes fields | React text rendering, no raw HTML injection, CSP |
| CSV/XLSX formula injection | Export-time neutralization of formula-leading characters |
| Malformed import causing crash or corruption | Strict schema validation, row-level errors, all-or-nothing commit |
| Corrupted IndexedDB record | Per-record validation on load, isolated recovery path |
| Supply-chain risk from bundled libraries | Pinned versions, license + vulnerability review, no runtime CDN |
| Data exfiltration | No network calls at runtime (verified by e2e test); no telemetry |

## 9. Out of scope (v1)

Multi-user authz/authn, encryption at rest (relies on OS/browser-level
disk protections), remote backup, SSO — all excluded per PRD §3/§Version 1
Boundaries.
