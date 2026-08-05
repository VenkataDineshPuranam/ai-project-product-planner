import { useMemo } from "react";
import type { Dependency, Task } from "@/domain";
import { visibleTasks } from "@/features/wbs/visibleTasks";
import { computeTimelineBounds, dateToX, ZOOM_PX_PER_DAY, type ZoomLevel } from "./ganttLayout";

export interface GanttChartProps {
  tasks: Task[];
  dependencies: Dependency[];
  collapsedIds: Set<string>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  zoom: ZoomLevel;
}

const ROW_HEIGHT = 28;
const BAR_HEIGHT = 16;
const MILESTONE_SIZE = 9;

function formatDate(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

export function GanttChart({ tasks, dependencies, collapsedIds, selectedId, onSelect, zoom }: GanttChartProps) {
  const nodes = useMemo(() => visibleTasks(tasks, collapsedIds), [tasks, collapsedIds]);
  const bounds = useMemo(() => computeTimelineBounds(tasks), [tasks]);
  const pxPerDay = ZOOM_PX_PER_DAY[zoom];
  const rowIndexById = useMemo(() => new Map(nodes.map((n, i) => [n.task.id, i])), [nodes]);

  const width = Math.max(400, dateToX(bounds.end, bounds.start, pxPerDay) + 80);
  const height = nodes.length * ROW_HEIGHT + 20;

  return (
    <svg
      role="img"
      aria-label="Gantt timeline"
      width={width}
      height={height}
      className="gantt-chart"
    >
      {dependencies.map((dep) => {
        const predRow = rowIndexById.get(dep.predecessorTaskId);
        const succRow = rowIndexById.get(dep.successorTaskId);
        const pred = tasks.find((t) => t.id === dep.predecessorTaskId);
        const succ = tasks.find((t) => t.id === dep.successorTaskId);
        if (predRow === undefined || succRow === undefined || !pred || !succ) return null;
        const x1 = dateToX(new Date(pred.finish), bounds.start, pxPerDay) + 10;
        const y1 = predRow * ROW_HEIGHT + 10 + BAR_HEIGHT / 2;
        const x2 = dateToX(new Date(succ.start), bounds.start, pxPerDay) + 10;
        const y2 = succRow * ROW_HEIGHT + 10 + BAR_HEIGHT / 2;
        return (
          <line
            key={dep.id}
            data-testid={`gantt-dep-${dep.id}`}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="#6b7280"
            strokeWidth={1.5}
            markerEnd="url(#gantt-arrow)"
          />
        );
      })}

      {nodes.map(({ task }, i) => {
        const y = i * ROW_HEIGHT + 10;
        const isSelected = task.id === selectedId;
        const label = `${task.name}, ${formatDate(task.start)} to ${formatDate(task.finish)}, ${task.percentComplete}% complete, ${task.status}${task.isCritical ? ", critical" : ""}`;

        if (task.isMilestone) {
          const x = dateToX(new Date(task.start), bounds.start, pxPerDay) + 10;
          const cy = y + BAR_HEIGHT / 2;
          const half = MILESTONE_SIZE;
          return (
            <g
              key={task.id}
              data-testid={`gantt-bar-${task.id}`}
              data-shape="milestone"
              data-critical={task.isCritical ? "true" : "false"}
              data-selected={isSelected ? "true" : "false"}
              role="img"
              aria-label={label}
              tabIndex={0}
              onClick={() => onSelect(task.id)}
              style={{ cursor: "pointer" }}
            >
              <polygon
                points={`${x},${cy - half} ${x + half},${cy} ${x},${cy + half} ${x - half},${cy}`}
                fill={task.isCritical ? "#b91c1c" : "#1d4ed8"}
                stroke={isSelected ? "#111827" : "none"}
                strokeWidth={2}
              />
            </g>
          );
        }

        const x1 = dateToX(new Date(task.start), bounds.start, pxPerDay) + 10;
        const x2 = dateToX(new Date(task.finish), bounds.start, pxPerDay) + 10;
        const barWidth = Math.max(2, x2 - x1);
        const fillWidth = (barWidth * task.percentComplete) / 100;

        return (
          <g
            key={task.id}
            data-testid={`gantt-bar-${task.id}`}
            data-shape="bar"
            data-critical={task.isCritical ? "true" : "false"}
            data-selected={isSelected ? "true" : "false"}
            role="img"
            aria-label={label}
            tabIndex={0}
            onClick={() => onSelect(task.id)}
            style={{ cursor: "pointer" }}
          >
            <rect
              x={x1}
              y={y}
              width={barWidth}
              height={BAR_HEIGHT}
              rx={task.isSummary ? 0 : 3}
              fill={task.isSummary ? "#374151" : task.isCritical ? "#fecaca" : "#bfdbfe"}
              stroke={isSelected ? "#111827" : task.isCritical ? "#b91c1c" : "#1d4ed8"}
              strokeWidth={isSelected ? 2 : 1}
            />
            {!task.isSummary && (
              <rect x={x1} y={y} width={fillWidth} height={BAR_HEIGHT} fill={task.isCritical ? "#b91c1c" : "#1d4ed8"} opacity={0.5} />
            )}
          </g>
        );
      })}

      <defs>
        <marker id="gantt-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="#6b7280" />
        </marker>
      </defs>
    </svg>
  );
}
