import { describe, expect, it } from "vitest";
import type { Task } from "@/domain";
import { buildTaskTreeOrder, visibleTasks } from "@/features/wbs/visibleTasks";

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

const tasks: Task[] = [
  makeTask({ id: "root", isSummary: true, parentId: null, sequence: 1 }),
  makeTask({ id: "child-a", parentId: "root", sequence: 1 }),
  makeTask({ id: "child-b", isSummary: true, parentId: "root", sequence: 2 }),
  makeTask({ id: "grandchild", parentId: "child-b", sequence: 1 }),
  makeTask({ id: "sibling", parentId: null, sequence: 2 }),
];

describe("buildTaskTreeOrder", () => {
  it("produces a depth-first order with depth annotations", () => {
    const nodes = buildTaskTreeOrder(tasks);
    expect(nodes.map((n) => n.task.id)).toEqual(["root", "child-a", "child-b", "grandchild", "sibling"]);
    expect(nodes.find((n) => n.task.id === "grandchild")!.depth).toBe(2);
    expect(nodes.find((n) => n.task.id === "sibling")!.depth).toBe(0);
  });
});

describe("visibleTasks", () => {
  it("shows everything when nothing is collapsed", () => {
    const visible = visibleTasks(tasks, new Set());
    expect(visible.map((n) => n.task.id)).toEqual(["root", "child-a", "child-b", "grandchild", "sibling"]);
  });

  it("hides descendants of a collapsed summary task", () => {
    const collapsed = new Set(["child-b"]);
    const visible = visibleTasks(tasks, collapsed);
    expect(visible.map((n) => n.task.id)).toEqual(["root", "child-a", "child-b", "sibling"]);
  });

  it("hides an entire subtree when an ancestor higher up is collapsed", () => {
    const collapsed = new Set(["root"]);
    const visible = visibleTasks(tasks, collapsed);
    expect(visible.map((n) => n.task.id)).toEqual(["root", "sibling"]);
  });
});
