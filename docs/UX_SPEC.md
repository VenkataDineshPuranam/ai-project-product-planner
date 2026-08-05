# UX Specification

## 1. Layout

Primary workspace is a split view: **task grid (left)** + **Gantt timeline
(right)**, sharing a single vertical scroll position and row selection
state (`useGridGanttSync` hook backed by a shared virtualized row index).
Top-level navigation switches between the five information-architecture
areas (Portfolio Dashboard, Project Workspace, Product Workspace, AI
Engineering Workspace, Executive Reporting); Project Workspace hosts the
grid/Gantt split.

## 2. Task grid (left pane)

- Configurable columns (Section 9.1 of source instructions): ID,
  indicators, WBS, name, duration, start, finish, predecessors,
  successors, resource names, work, % complete, baseline start/finish,
  variance, total float, critical, cost, AI inference cost, owner,
  status, risk indicator.
- Hierarchical indentation with expand/collapse (persisted per project in
  IndexedDB, not just session state).
- Inline editing with immediate validation feedback (red cell outline +
  message, not a blocking modal, for recoverable errors).
- Multi-select (shift/ctrl-click), add/delete/duplicate/move (indent,
  outdent, move up/down update `wbsCode`/`sequence`/`parentId`
  atomically).
- Full keyboard navigation: arrow keys move cell focus, Enter commits and
  moves down, Tab moves right, Escape cancels edit, Ctrl+Z/Ctrl+Y
  undo/redo.
- Column resize/reorder/persisted; identifying columns (ID, WBS, name)
  can be frozen during horizontal scroll.
- Filtering, sorting, grouping (by workstream, owner, status) without
  mutating underlying task order/WBS.

## 3. Gantt timeline (right pane)

- Zoom levels: day, week, month, quarter, year — changes column width,
  not data.
- Current-date line and (distinct style) status-date/progress line.
- Non-working time shaded per the active calendar.
- Summary bars (bracket style), task bars, milestone diamonds, baseline
  bars (thin bar beneath/behind current bar), percent-complete fill
  overlay on the bar itself.
- Critical-path highlighting (color + non-color pattern, see §5).
- Dependency arrows drawn between bar edges appropriate to FS/SS/FF/SF.
- Drag to move a bar (requires confirm on drop if it would change a
  dependency-driven successor's date); resize handles to change duration.
- Create a dependency by dragging from one bar's connector point to
  another; type defaults to FS, editable after creation.
- Tooltip on hover: name, dates, % complete, owner, cost, status.
- Horizontal virtualization (windowed rendering) for large date ranges;
  vertical virtualization shared with the grid for large task counts.
- Dedicated print/export view: flattens to a static, paginated SVG/canvas
  snapshot with legend.

## 4. Editing safety

- Any edit that would move a manually-set date, delete a task with
  dependents, or change a committed feature's linkage triggers a
  confirmation affordance (inline, not a modal wall) describing the
  consequence before applying.
- Undo/redo covers all grid and Gantt mutations via a single command
  stack (see ADR-0002 candidates during implementation).

## 5. Accessibility

- All critical functions (add/edit/delete task, create dependency, set
  baseline, navigate grid/Gantt) operable via keyboard alone.
- Visible focus ring on grid cells and Gantt bars/handles.
- Semantic labelling: grid uses ARIA `treegrid`; Gantt bars expose
  `aria-label` with name/dates/status; dependency arrows have an
  accessible text alternative (e.g., a hidden dependency list per task).
- Contrast meets WCAG 2.1 AA for text and critical-path indication.
- Critical path, risk, and governance markers are distinguished by shape
  or pattern in addition to color (never color-only).
- `prefers-reduced-motion` disables bar-drag animation easing and
  auto-scroll momentum.

## 6. Executive / print views

- One-page project status, outcome scorecard, Gantt snapshot, milestone
  trend, critical path, budget/forecast, AI quality/cost scorecard, top
  risks, 30/60/90-day view (Section 5.5).
- Each report header states the data/status date; any field with no data
  renders as "No data" rather than 0 or blank (Section 14).

## 7. Out of scope for v1 UX

Real-time multi-user cursors/presence, mobile/touch-optimized layout,
in-app collaborative comments/mentions — none are in the v1 boundary
(Section 19) and must not be implied by the UI.
