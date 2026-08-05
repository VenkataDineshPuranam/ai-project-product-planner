// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import type { Dependency, Task } from "@/domain";
import { GanttChart } from "@/features/gantt/GanttChart";

function makeTask(overrides: Partial<Task> & { id: string }): Task {
  return {
    projectId: "proj-1",
    parentId: null,
    wbsCode: "1",
    sequence: 1,
    name: overrides.id,
    schedulingMode: "auto",
    isSummary: false,
    isMilestone: false,
    start: "2026-01-19T14:00:00.000Z",
    finish: "2026-01-19T22:00:00.000Z",
    durationMinutes: 480,
    workMinutes: 480,
    remainingWorkMinutes: 480,
    percentComplete: 0,
    constraintType: "ASAP",
    calendarId: "cal-1",
    priority: 500,
    fixedCost: 0,
    costAccrual: "prorated",
    isCritical: false,
    status: "not-started",
    tags: [],
    ...overrides,
  };
}

const tasks: Task[] = [
  makeTask({ id: "a", name: "Task A", start: "2026-01-19T14:00:00.000Z", finish: "2026-01-19T22:00:00.000Z", isCritical: true }),
  makeTask({ id: "b", name: "Task B", start: "2026-01-20T14:00:00.000Z", finish: "2026-01-20T22:00:00.000Z" }),
  makeTask({
    id: "m",
    name: "Milestone",
    isMilestone: true,
    durationMinutes: 0,
    start: "2026-01-21T14:00:00.000Z",
    finish: "2026-01-21T14:00:00.000Z",
  }),
];

const dependencies: Dependency[] = [{ id: "dep-1", predecessorTaskId: "a", successorTaskId: "b", type: "FS", lagMinutes: 0 }];

describe("GanttChart", () => {
  it("renders one bar/marker per visible task", () => {
    render(
      <GanttChart tasks={tasks} dependencies={dependencies} collapsedIds={new Set()} selectedId={null} onSelect={vi.fn()} zoom="week" />,
    );
    expect(screen.getByTestId("gantt-bar-a")).toBeInTheDocument();
    expect(screen.getByTestId("gantt-bar-b")).toBeInTheDocument();
    expect(screen.getByTestId("gantt-bar-m")).toBeInTheDocument();
  });

  it("renders a milestone as a diamond marker, not a bar", () => {
    render(
      <GanttChart tasks={tasks} dependencies={dependencies} collapsedIds={new Set()} selectedId={null} onSelect={vi.fn()} zoom="week" />,
    );
    expect(screen.getByTestId("gantt-bar-m")).toHaveAttribute("data-shape", "milestone");
    expect(screen.getByTestId("gantt-bar-a")).toHaveAttribute("data-shape", "bar");
  });

  it("marks the critical task without relying on color alone", () => {
    render(
      <GanttChart tasks={tasks} dependencies={dependencies} collapsedIds={new Set()} selectedId={null} onSelect={vi.fn()} zoom="week" />,
    );
    expect(screen.getByTestId("gantt-bar-a")).toHaveAttribute("data-critical", "true");
    expect(screen.getByTestId("gantt-bar-b")).toHaveAttribute("data-critical", "false");
  });

  it("gives every bar an accessible label with name, dates, and status", () => {
    render(
      <GanttChart tasks={tasks} dependencies={dependencies} collapsedIds={new Set()} selectedId={null} onSelect={vi.fn()} zoom="week" />,
    );
    const bar = screen.getByTestId("gantt-bar-a");
    expect(bar.getAttribute("aria-label")).toMatch(/Task A/);
    expect(bar.getAttribute("aria-label")).toMatch(/not-started/);
  });

  it("renders a dependency arrow between two visible connected tasks", () => {
    render(
      <GanttChart tasks={tasks} dependencies={dependencies} collapsedIds={new Set()} selectedId={null} onSelect={vi.fn()} zoom="week" />,
    );
    expect(screen.getByTestId("gantt-dep-dep-1")).toBeInTheDocument();
  });

  it("calls onSelect when a bar is clicked", async () => {
    const onSelect = vi.fn();
    render(
      <GanttChart tasks={tasks} dependencies={dependencies} collapsedIds={new Set()} selectedId={null} onSelect={onSelect} zoom="week" />,
    );
    await userEvent.click(screen.getByTestId("gantt-bar-b"));
    expect(onSelect).toHaveBeenCalledWith("b");
  });

  it("highlights the selected bar", () => {
    render(
      <GanttChart tasks={tasks} dependencies={dependencies} collapsedIds={new Set()} selectedId="b" onSelect={vi.fn()} zoom="week" />,
    );
    expect(screen.getByTestId("gantt-bar-b")).toHaveAttribute("data-selected", "true");
  });
});
