import { describe, expect, it } from "vitest";
import type { Assignment, Calendar, Resource, Task } from "@/domain";
import { computeResourceHistogram, detectOverAllocations } from "@/calculations/resources";
import { zonedWallTimeToUtc } from "@/calculations/calendar";

const calendar: Calendar = {
  id: "cal-1",
  name: "Standard M-F 9-17",
  workingDays: { 0: false, 1: true, 2: true, 3: true, 4: true, 5: true, 6: false },
  workingHours: [{ start: "09:00", end: "17:00" }],
  exceptions: [],
  timeZone: "America/New_York",
};

const resource: Resource = {
  id: "res-1",
  name: "Jane Doe",
  calendarId: "cal-1",
  maxUnits: 1,
  costRates: [],
  status: "active",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  version: 1,
  tags: [],
};

function iso(dateStr: string, timeStr: string): string {
  return zonedWallTimeToUtc(dateStr, timeStr, "America/New_York").toISOString();
}

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
    start: iso("2026-01-19", "09:00"),
    finish: iso("2026-01-21", "17:00"),
    durationMinutes: 1920,
    workMinutes: 1920,
    remainingWorkMinutes: 1920,
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

describe("computeResourceHistogram", () => {
  it("sums assignment units per working day the resource is allocated", () => {
    const taskA = makeTask({ id: "a", start: iso("2026-01-19", "09:00"), finish: iso("2026-01-20", "17:00") });
    const taskB = makeTask({ id: "b", start: iso("2026-01-20", "09:00"), finish: iso("2026-01-21", "17:00") });
    const assignments: Assignment[] = [
      { id: "asg-1", taskId: "a", resourceId: "res-1", units: 0.6, plannedWorkMinutes: 960, actualWorkMinutes: 0, remainingWorkMinutes: 960 },
      { id: "asg-2", taskId: "b", resourceId: "res-1", units: 0.6, plannedWorkMinutes: 960, actualWorkMinutes: 0, remainingWorkMinutes: 960 },
    ];
    const histogram = computeResourceHistogram({ tasks: [taskA, taskB], assignments, resources: [resource], calendars: [calendar] });
    const days = histogram["res-1"];
    const day19 = days.find((d) => d.date === "2026-01-19")!;
    const day20 = days.find((d) => d.date === "2026-01-20")!;
    const day21 = days.find((d) => d.date === "2026-01-21")!;
    expect(day19.allocatedUnits).toBeCloseTo(0.6, 5);
    expect(day20.allocatedUnits).toBeCloseTo(1.2, 5); // both tasks overlap on the 20th
    expect(day21.allocatedUnits).toBeCloseTo(0.6, 5);
  });
});

describe("detectOverAllocations", () => {
  it("flags days where summed units exceed the resource's maxUnits", () => {
    const taskA = makeTask({ id: "a", start: iso("2026-01-19", "09:00"), finish: iso("2026-01-20", "17:00") });
    const taskB = makeTask({ id: "b", start: iso("2026-01-20", "09:00"), finish: iso("2026-01-21", "17:00") });
    const assignments: Assignment[] = [
      { id: "asg-1", taskId: "a", resourceId: "res-1", units: 0.6, plannedWorkMinutes: 960, actualWorkMinutes: 0, remainingWorkMinutes: 960 },
      { id: "asg-2", taskId: "b", resourceId: "res-1", units: 0.6, plannedWorkMinutes: 960, actualWorkMinutes: 0, remainingWorkMinutes: 960 },
    ];
    const warnings = detectOverAllocations({ tasks: [taskA, taskB], assignments, resources: [resource], calendars: [calendar] });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({ code: "OVER_ALLOCATION", resourceId: "res-1", date: "2026-01-20" });
  });

  it("reports no warnings when allocations stay within capacity", () => {
    const taskA = makeTask({ id: "a", start: iso("2026-01-19", "09:00"), finish: iso("2026-01-19", "17:00") });
    const assignments: Assignment[] = [
      { id: "asg-1", taskId: "a", resourceId: "res-1", units: 0.5, plannedWorkMinutes: 480, actualWorkMinutes: 0, remainingWorkMinutes: 480 },
    ];
    const warnings = detectOverAllocations({ tasks: [taskA], assignments, resources: [resource], calendars: [calendar] });
    expect(warnings).toHaveLength(0);
  });
});
