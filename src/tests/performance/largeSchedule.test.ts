import { describe, expect, it } from "vitest";
import type { Calendar, Dependency, Task } from "@/domain";
import { computeSchedule } from "@/calculations/schedule";

const calendar: Calendar = {
  id: "cal-1",
  name: "Standard M-F 9-17",
  workingDays: { 0: false, 1: true, 2: true, 3: true, 4: true, 5: true, 6: false },
  workingHours: [{ start: "09:00", end: "17:00" }],
  exceptions: [],
  timeZone: "America/New_York",
};

function buildLargeProject(taskCount: number): { tasks: Task[]; dependencies: Dependency[] } {
  const tasks: Task[] = [];
  const dependencies: Dependency[] = [];
  for (let i = 0; i < taskCount; i++) {
    tasks.push({
      id: `t${i}`,
      projectId: "proj-perf",
      parentId: null,
      wbsCode: String(i + 1),
      sequence: i + 1,
      name: `Task ${i + 1}`,
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
    });
    // A branching structure (each task depends on one of the prior 5 tasks,
    // round-robin) rather than one long chain, closer to a realistic large
    // program's dependency density than a worst-case pathological graph.
    if (i > 0) {
      const predecessorIndex = Math.max(0, i - 1 - (i % 5));
      dependencies.push({
        id: `d${i}`,
        predecessorTaskId: `t${predecessorIndex}`,
        successorTaskId: `t${i}`,
        type: "FS",
        lagMinutes: 0,
      });
    }
  }
  return { tasks, dependencies };
}

describe("scheduling engine performance", () => {
  it("recalculates a 500-task project within the 250ms budget (docs/PRD.md §18)", () => {
    const { tasks, dependencies } = buildLargeProject(500);
    const start = performance.now();
    const result = computeSchedule({ tasks, dependencies, calendars: [calendar] });
    const elapsedMs = performance.now() - start;
    expect(result.errors).toHaveLength(0);
    // eslint-disable-next-line no-console
    console.log(`[perf] 500-task computeSchedule: ${elapsedMs.toFixed(1)}ms`);
    expect(elapsedMs).toBeLessThan(250);
  });

  it("recalculates a 2000-task project and reports the measured time against the 1s budget (docs/PRD.md §18)", () => {
    const { tasks, dependencies } = buildLargeProject(2000);
    const start = performance.now();
    const result = computeSchedule({ tasks, dependencies, calendars: [calendar] });
    const elapsedMs = performance.now() - start;
    expect(result.errors).toHaveLength(0);
    expect(result.tasks).toHaveLength(2000);
    // eslint-disable-next-line no-console
    console.log(`[perf] 2000-task computeSchedule: ${elapsedMs.toFixed(1)}ms`);
    expect(elapsedMs).toBeLessThan(1000);
  });
});
