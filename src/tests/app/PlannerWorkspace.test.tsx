// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import type { Calendar, Dependency, Task } from "@/domain";
import { PlannerWorkspace } from "@/app/PlannerWorkspace";

const calendar: Calendar = {
  id: "cal-1",
  name: "Standard",
  workingDays: { 0: false, 1: true, 2: true, 3: true, 4: true, 5: true, 6: false },
  workingHours: [{ start: "09:00", end: "17:00" }],
  exceptions: [],
  timeZone: "America/New_York",
};

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
    status: "not-started",
    tags: [],
    ...overrides,
  };
}

const tasks: Task[] = [makeTask({ id: "a", name: "Task A", sequence: 1 }), makeTask({ id: "b", name: "Task B", sequence: 2 })];
const dependencies: Dependency[] = [{ id: "dep-1", predecessorTaskId: "a", successorTaskId: "b", type: "FS", lagMinutes: 0 }];

describe("PlannerWorkspace", () => {
  it("runs the scheduling engine and reflects computed critical status in both panes", () => {
    render(<PlannerWorkspace tasks={tasks} dependencies={dependencies} calendars={[calendar]} />);
    // A linear two-task FS chain is entirely critical.
    expect(screen.getByTestId("task-row-a")).toHaveAttribute("data-critical", "true");
    expect(screen.getByTestId("gantt-bar-a")).toHaveAttribute("data-critical", "true");
  });

  it("selecting a row in the grid selects the matching bar in the Gantt chart", async () => {
    render(<PlannerWorkspace tasks={tasks} dependencies={dependencies} calendars={[calendar]} />);
    await userEvent.click(screen.getByText("Task B"));
    expect(screen.getByTestId("task-row-b")).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("gantt-bar-b")).toHaveAttribute("data-selected", "true");
  });

  it("selecting a bar in the Gantt chart selects the matching row in the grid", async () => {
    render(<PlannerWorkspace tasks={tasks} dependencies={dependencies} calendars={[calendar]} />);
    await userEvent.click(screen.getByTestId("gantt-bar-b"));
    expect(screen.getByTestId("task-row-b")).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("gantt-bar-b")).toHaveAttribute("data-selected", "true");
  });
});
