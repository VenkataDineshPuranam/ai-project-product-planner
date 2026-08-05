import { useMemo, useState } from "react";
import type { Calendar, Dependency, Task } from "@/domain";
import { computeSchedule } from "@/calculations/schedule";
import { TaskGrid } from "@/features/wbs/TaskGrid";
import { GanttChart } from "@/features/gantt/GanttChart";
import type { ZoomLevel } from "@/features/gantt/ganttLayout";
import "./PlannerWorkspace.css";

export interface PlannerWorkspaceProps {
  tasks: Task[];
  dependencies: Dependency[];
  calendars: Calendar[];
}

const ZOOM_LEVELS: ZoomLevel[] = ["day", "week", "month", "quarter", "year"];

export function PlannerWorkspace({ tasks, dependencies, calendars }: PlannerWorkspaceProps) {
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoom, setZoom] = useState<ZoomLevel>("week");

  const schedule = useMemo(
    () => computeSchedule({ tasks, dependencies, calendars }),
    [tasks, dependencies, calendars],
  );

  function toggleCollapse(id: string) {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="planner-workspace">
      <div className="planner-workspace__toolbar">
        <label>
          Zoom:{" "}
          <select value={zoom} onChange={(e) => setZoom(e.target.value as ZoomLevel)}>
            {ZOOM_LEVELS.map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>
        </label>
        {schedule.errors.length > 0 && (
          <span className="planner-workspace__errors" role="alert">
            {schedule.errors.length} scheduling error(s)
          </span>
        )}
      </div>
      <div className="planner-workspace__split">
        <div className="planner-workspace__grid-pane">
          <TaskGrid
            tasks={schedule.tasks}
            collapsedIds={collapsedIds}
            onToggleCollapse={toggleCollapse}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </div>
        <div className="planner-workspace__gantt-pane">
          <GanttChart
            tasks={schedule.tasks}
            dependencies={dependencies}
            collapsedIds={collapsedIds}
            selectedId={selectedId}
            onSelect={setSelectedId}
            zoom={zoom}
          />
        </div>
      </div>
    </div>
  );
}
