// @vitest-environment jsdom
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import type { Task } from "@/domain";
import { TaskGrid } from "@/features/wbs/TaskGrid";

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
  makeTask({ id: "root", name: "Root", isSummary: true, sequence: 1 }),
  makeTask({ id: "child-a", name: "Child A", parentId: "root", sequence: 1 }),
  makeTask({ id: "child-b", name: "Child B", parentId: "root", sequence: 2, isCritical: true }),
];

function Harness() {
  const [collapsed, setCollapsed] = useState(new Set<string>());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  return (
    <TaskGrid
      tasks={tasks}
      collapsedIds={collapsed}
      onToggleCollapse={(id: string) =>
        setCollapsed((prev: Set<string>) => {
          const next = new Set(prev);
          next.has(id) ? next.delete(id) : next.add(id);
          return next;
        })
      }
      selectedId={selectedId}
      onSelect={setSelectedId}
    />
  );
}

describe("TaskGrid", () => {
  it("renders a treegrid with one row per visible task", () => {
    render(<TaskGrid tasks={tasks} collapsedIds={new Set()} onToggleCollapse={vi.fn()} selectedId={null} onSelect={vi.fn()} />);
    expect(screen.getByRole("treegrid")).toBeInTheDocument();
    // 1 header row + 3 task rows
    expect(screen.getAllByRole("row")).toHaveLength(4);
    expect(screen.getByText("Root")).toBeInTheDocument();
    expect(screen.getByText("Child A")).toBeInTheDocument();
    expect(screen.getByText("Child B")).toBeInTheDocument();
  });

  it("marks critical tasks without relying on color alone", () => {
    render(<TaskGrid tasks={tasks} collapsedIds={new Set()} onToggleCollapse={vi.fn()} selectedId={null} onSelect={vi.fn()} />);
    const criticalRow = screen.getByTestId("task-row-child-b");
    expect(criticalRow).toHaveAttribute("data-critical", "true");
    expect(criticalRow.textContent).toMatch(/critical/i);
  });

  it("calls onSelect when a row is clicked", async () => {
    const onSelect = vi.fn();
    render(<TaskGrid tasks={tasks} collapsedIds={new Set()} onToggleCollapse={vi.fn()} selectedId={null} onSelect={onSelect} />);
    await userEvent.click(screen.getByText("Child A"));
    expect(onSelect).toHaveBeenCalledWith("child-a");
  });

  it("calls onToggleCollapse when the expand/collapse control on a summary row is clicked", async () => {
    const onToggleCollapse = vi.fn();
    render(<TaskGrid tasks={tasks} collapsedIds={new Set()} onToggleCollapse={onToggleCollapse} selectedId={null} onSelect={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /collapse root/i }));
    expect(onToggleCollapse).toHaveBeenCalledWith("root");
  });

  it("hides children of a collapsed summary task", () => {
    render(
      <TaskGrid tasks={tasks} collapsedIds={new Set(["root"])} onToggleCollapse={vi.fn()} selectedId={null} onSelect={vi.fn()} />,
    );
    expect(screen.queryByText("Child A")).not.toBeInTheDocument();
    expect(screen.getByText("Root")).toBeInTheDocument();
  });

  it("supports ArrowDown/ArrowUp keyboard navigation between visible rows", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const grid = screen.getByRole("treegrid");
    grid.focus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByTestId("task-row-root")).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{ArrowDown}");
    expect(screen.getByTestId("task-row-child-a")).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{ArrowUp}");
    expect(screen.getByTestId("task-row-root")).toHaveAttribute("aria-selected", "true");
  });
});
