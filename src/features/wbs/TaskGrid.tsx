import { useMemo, type KeyboardEvent } from "react";
import type { Task } from "@/domain";
import { visibleTasks } from "./visibleTasks";
import "./TaskGrid.css";

export interface TaskGridProps {
  tasks: Task[];
  collapsedIds: Set<string>;
  onToggleCollapse: (id: string) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function formatDate(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

export function TaskGrid({ tasks, collapsedIds, onToggleCollapse, selectedId, onSelect }: TaskGridProps) {
  const nodes = useMemo(() => visibleTasks(tasks, collapsedIds), [tasks, collapsedIds]);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const ids = nodes.map((n) => n.task.id);
    if (ids.length === 0) return;
    const currentIndex = selectedId ? ids.indexOf(selectedId) : -1;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      const next = ids[Math.min(currentIndex + 1, ids.length - 1)] ?? ids[0];
      onSelect(next);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      const prev = ids[Math.max(currentIndex - 1, 0)] ?? ids[0];
      onSelect(prev);
    } else if (event.key === "Enter") {
      const current = nodes[currentIndex];
      if (current?.task.isSummary) {
        event.preventDefault();
        onToggleCollapse(current.task.id);
      }
    }
  }

  return (
    <div
      className="task-grid"
      role="treegrid"
      aria-label="Task list"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <div role="row" className="task-grid__header">
        <span role="columnheader">WBS</span>
        <span role="columnheader">Name</span>
        <span role="columnheader">Duration (h)</span>
        <span role="columnheader">Start</span>
        <span role="columnheader">Finish</span>
        <span role="columnheader">% Complete</span>
        <span role="columnheader">Critical</span>
      </div>
      {nodes.map(({ task, depth }) => {
        const isCollapsed = collapsedIds.has(task.id);
        const isSelected = task.id === selectedId;
        return (
          <div
            key={task.id}
            role="row"
            data-testid={`task-row-${task.id}`}
            data-critical={task.isCritical ? "true" : "false"}
            aria-level={depth + 1}
            aria-selected={isSelected}
            aria-expanded={task.isSummary ? !isCollapsed : undefined}
            className={`task-grid__row${isSelected ? " task-grid__row--selected" : ""}${task.isCritical ? " task-grid__row--critical" : ""}`}
            onClick={() => onSelect(task.id)}
          >
            <span role="gridcell">{task.wbsCode}</span>
            <span role="gridcell" style={{ paddingLeft: depth * 16 }}>
              {task.isSummary && (
                <button
                  type="button"
                  aria-label={`${isCollapsed ? "expand" : "collapse"} ${task.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleCollapse(task.id);
                  }}
                  className="task-grid__toggle"
                >
                  {isCollapsed ? "▸" : "▾"}
                </button>
              )}
              {task.name}
            </span>
            <span role="gridcell">{(task.durationMinutes / 60).toFixed(1)}</span>
            <span role="gridcell">{formatDate(task.start)}</span>
            <span role="gridcell">{formatDate(task.finish)}</span>
            <span role="gridcell">{task.percentComplete}%</span>
            <span role="gridcell">{task.isCritical ? "Critical" : ""}</span>
          </div>
        );
      })}
    </div>
  );
}
