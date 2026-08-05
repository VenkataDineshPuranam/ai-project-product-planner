# ADR-0003: SVG-based internal Gantt renderer with row virtualization

## Status
Proposed

## Context
The Gantt timeline needs summary/task bars, milestone diamonds, baseline
bars, percent-complete overlays, critical-path highlighting, dependency
arrows, drag/resize interaction, multiple zoom levels, and must stay
smooth at 2 000 tasks while remaining keyboard-accessible. Third-party
Gantt libraries were considered; per Section 2 of the source
instructions, adoption requires checking license, offline compatibility,
accessibility, maintenance status, and support for dependency arrows,
baselines, critical path, and editable bars — most candidates fail one or
more (weak accessibility, restrictive/unclear licensing for bundling, or
missing baseline/critical-path primitives), and coupling the scheduling
engine's output to a third-party bar model risks distorting the domain
model to fit the library rather than the reverse.

## Decision
Build an internal Gantt renderer using SVG for bars/arrows/markers
(crisp at any zoom, straightforward to make individual elements
focusable/labelled for accessibility) with row virtualization shared with
the task grid (`useGridGanttSync`). Canvas is not used because SVG gives
per-element DOM nodes needed for ARIA labelling and hit-testing of
individual bars/handles without hand-rolled picking logic.

## Consequences
- Full control over accessibility semantics (ARIA labels per bar,
  focusable connector handles) and over exactly which schedule fields
  (baseline, critical, float) are visualized and how.
- More implementation effort than dropping in a pre-built Gantt
  component; budgeted as its own implementation phase (Prompt 4) after
  the scheduling engine is independently tested, so rendering bugs are
  never confused with scheduling bugs.
- If profiling under the 2 000-task/virtualized-scroll performance
  budget shows SVG element count is the bottleneck, the fallback is
  canvas rendering for bars with an SVG (or DOM) accessibility overlay —
  not a third-party library swap.
