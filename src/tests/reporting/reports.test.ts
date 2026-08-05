import { describe, expect, it } from "vitest";
import type { Task } from "@/domain";
import { generateCriticalPathReport, generateMilestoneReport } from "@/features/reporting/reports";

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

describe("generateMilestoneReport", () => {
  it("states the data date on the report", () => {
    const report = generateMilestoneReport([], "2026-02-01T00:00:00.000Z");
    expect(report.dataDate).toBe("2026-02-01T00:00:00.000Z");
  });

  it("reports slippage as null (not zero) when no baseline exists, rather than fabricating a value", () => {
    const milestone = makeTask({ id: "m1", isMilestone: true, durationMinutes: 0, finish: "2026-02-10T00:00:00.000Z" });
    const report = generateMilestoneReport([milestone], "2026-02-01T00:00:00.000Z");
    expect(report.milestones[0].slippageMinutes).toBeNull();
  });

  it("computes positive slippage in minutes when the current finish is later than the baseline", () => {
    const milestone = makeTask({
      id: "m1",
      isMilestone: true,
      durationMinutes: 0,
      finish: "2026-02-10T12:00:00.000Z",
      baselineFinish: "2026-02-10T00:00:00.000Z",
    });
    const report = generateMilestoneReport([milestone], "2026-02-01T00:00:00.000Z");
    expect(report.milestones[0].slippageMinutes).toBe(12 * 60);
  });

  it("excludes non-milestone tasks", () => {
    const task = makeTask({ id: "t1", isMilestone: false });
    const report = generateMilestoneReport([task], "2026-02-01T00:00:00.000Z");
    expect(report.milestones).toHaveLength(0);
  });
});

describe("generateCriticalPathReport", () => {
  it("lists only critical tasks and states counts", () => {
    const critical = makeTask({ id: "c1", isCritical: true, totalFloatMinutes: 0 });
    const nonCritical = makeTask({ id: "nc1", isCritical: false, totalFloatMinutes: 480 });
    const report = generateCriticalPathReport([critical, nonCritical], "2026-02-01T00:00:00.000Z");
    expect(report.criticalTasks.map((t) => t.id)).toEqual(["c1"]);
    expect(report.totalTaskCount).toBe(2);
    expect(report.criticalTaskCount).toBe(1);
  });

  it("does not fabricate float for a task where it was never computed", () => {
    const uncomputed = makeTask({ id: "u1", isCritical: undefined, totalFloatMinutes: undefined });
    const report = generateCriticalPathReport([uncomputed], "2026-02-01T00:00:00.000Z");
    expect(report.criticalTasks).toHaveLength(0);
    expect(report.tasksMissingScheduleData).toContain("u1");
  });
});
