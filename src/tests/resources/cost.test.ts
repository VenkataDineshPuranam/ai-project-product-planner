import { describe, expect, it } from "vitest";
import type { Assignment, CostRate, Task } from "@/domain";
import { computeProjectCost, computeTaskCost } from "@/calculations/cost";

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

const rate: CostRate = {
  id: "rate-1",
  resourceId: "res-1",
  standardRatePerHour: 100,
  effectiveFrom: "2026-01-01T00:00:00.000Z",
};

describe("computeTaskCost", () => {
  it("sums resource cost from planned work minutes at the standard rate", () => {
    const task = makeTask({ id: "a", fixedCost: 0 });
    const assignments: Assignment[] = [
      { id: "asg-1", taskId: "a", resourceId: "res-1", units: 1, plannedWorkMinutes: 480, actualWorkMinutes: 0, remainingWorkMinutes: 480, costRateId: "rate-1" },
    ];
    const cost = computeTaskCost(task, assignments, [rate]);
    expect(cost.plannedCost).toBeCloseTo(800, 5); // 8h * $100
    expect(cost.actualCost).toBeCloseTo(0, 5);
  });

  it("includes actual cost from actualWorkMinutes for in-progress work", () => {
    const task = makeTask({ id: "a", percentComplete: 50 });
    const assignments: Assignment[] = [
      { id: "asg-1", taskId: "a", resourceId: "res-1", units: 1, plannedWorkMinutes: 480, actualWorkMinutes: 240, remainingWorkMinutes: 240, costRateId: "rate-1" },
    ];
    const cost = computeTaskCost(task, assignments, [rate]);
    expect(cost.actualCost).toBeCloseTo(400, 5); // 4h * $100
  });

  it("adds fixed cost at start accrual once any progress has been made", () => {
    const task = makeTask({ id: "a", fixedCost: 500, costAccrual: "start", percentComplete: 10 });
    const cost = computeTaskCost(task, [], []);
    expect(cost.plannedCost).toBeCloseTo(500, 5);
    expect(cost.actualCost).toBeCloseTo(500, 5);
  });

  it("does not accrue end-accrual fixed cost until the task is complete", () => {
    const task = makeTask({ id: "a", fixedCost: 500, costAccrual: "end", percentComplete: 90 });
    const cost = computeTaskCost(task, [], []);
    expect(cost.actualCost).toBeCloseTo(0, 5);
  });

  it("prorates fixed cost by percent complete", () => {
    const task = makeTask({ id: "a", fixedCost: 1000, costAccrual: "prorated", percentComplete: 30 });
    const cost = computeTaskCost(task, [], []);
    expect(cost.actualCost).toBeCloseTo(300, 5);
  });
});

describe("computeProjectCost", () => {
  it("sums leaf task costs, excluding summary tasks to avoid double-counting", () => {
    const summary = makeTask({ id: "s", isSummary: true, fixedCost: 999 });
    const a = makeTask({ id: "a", fixedCost: 100, costAccrual: "start", percentComplete: 100 });
    const b = makeTask({ id: "b", fixedCost: 200, costAccrual: "start", percentComplete: 100 });
    const total = computeProjectCost([summary, a, b], [], []);
    expect(total.plannedCost).toBeCloseTo(300, 5);
    expect(total.actualCost).toBeCloseTo(300, 5);
  });
});
