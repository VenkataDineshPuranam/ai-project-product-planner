import { describe, expect, it } from "vitest";
import type { Calendar, Dependency, Task } from "@/domain";
import { computeSchedule } from "@/calculations/schedule";
import { zonedWallTimeToUtc } from "@/calculations/calendar";

const TZ = "America/New_York";

const calendar: Calendar = {
  id: "cal-1",
  name: "Standard M-F 9-17",
  workingDays: { 0: false, 1: true, 2: true, 3: true, 4: true, 5: true, 6: false },
  workingHours: [{ start: "09:00", end: "17:00" }],
  exceptions: [],
  timeZone: TZ,
};

function iso(dateStr: string, timeStr: string): string {
  return zonedWallTimeToUtc(dateStr, timeStr, TZ).toISOString();
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
    start: iso("2026-01-19", "09:00"), // Monday
    finish: iso("2026-01-19", "17:00"),
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

function dep(overrides: Partial<Dependency> & { id: string; predecessorTaskId: string; successorTaskId: string }): Dependency {
  return { type: "FS", lagMinutes: 0, ...overrides };
}

describe("dependency types (zero lag)", () => {
  it("FS: successor starts after predecessor finishes", () => {
    const a = makeTask({ id: "a" });
    const b = makeTask({ id: "b" });
    const d = dep({ id: "d1", predecessorTaskId: "a", successorTaskId: "b", type: "FS" });
    const out = computeSchedule({ tasks: [a, b], dependencies: [d], calendars: [calendar] });
    const bOut = out.tasks.find((t) => t.id === "b")!;
    expect(bOut.start).toBe(iso("2026-01-20", "09:00"));
  });

  it("SS: successor starts after predecessor starts", () => {
    const a = makeTask({ id: "a" });
    const b = makeTask({ id: "b" });
    const d = dep({ id: "d1", predecessorTaskId: "a", successorTaskId: "b", type: "SS" });
    const out = computeSchedule({ tasks: [a, b], dependencies: [d], calendars: [calendar] });
    const bOut = out.tasks.find((t) => t.id === "b")!;
    expect(bOut.start).toBe(iso("2026-01-19", "09:00"));
  });

  it("FF: successor finishes after predecessor finishes", () => {
    const a = makeTask({ id: "a", durationMinutes: 480 });
    const b = makeTask({ id: "b", durationMinutes: 120 });
    const d = dep({ id: "d1", predecessorTaskId: "a", successorTaskId: "b", type: "FF" });
    const out = computeSchedule({ tasks: [a, b], dependencies: [d], calendars: [calendar] });
    const bOut = out.tasks.find((t) => t.id === "b")!;
    expect(bOut.finish).toBe(iso("2026-01-19", "17:00"));
    expect(bOut.start).toBe(iso("2026-01-19", "15:00"));
  });

  it("SF: successor finishes after predecessor starts (binding case)", () => {
    // b's own unconstrained anchor is long before a starts, so the SF
    // constraint (b.finish >= a.start) is the binding driver of b's schedule.
    const a = makeTask({ id: "a", start: iso("2026-01-19", "09:00") });
    const b = makeTask({ id: "b", durationMinutes: 120, start: iso("2026-01-01", "09:00") });
    const d = dep({ id: "d1", predecessorTaskId: "a", successorTaskId: "b", type: "SF" });
    const out = computeSchedule({ tasks: [a, b], dependencies: [d], calendars: [calendar] });
    const bOut = out.tasks.find((t) => t.id === "b")!;
    // EF is forced to exactly Monday 09:00 (the working-day boundary), so
    // subtracting 120 working minutes rolls back across the weekend to
    // Friday 15:00 rather than "Monday 07:00" (which isn't working time).
    expect(bOut.finish).toBe(iso("2026-01-19", "09:00"));
    expect(bOut.start).toBe(iso("2026-01-16", "15:00"));
  });

  it("SF: successor's own natural schedule already satisfies the constraint", () => {
    const a = makeTask({ id: "a", start: iso("2026-01-19", "09:00") });
    const b = makeTask({ id: "b", durationMinutes: 120, start: iso("2026-01-19", "09:00") });
    const d = dep({ id: "d1", predecessorTaskId: "a", successorTaskId: "b", type: "SF" });
    const out = computeSchedule({ tasks: [a, b], dependencies: [d], calendars: [calendar] });
    const bOut = out.tasks.find((t) => t.id === "b")!;
    expect(bOut.start).toBe(iso("2026-01-19", "09:00"));
    expect(bOut.finish).toBe(iso("2026-01-19", "11:00"));
  });
});

describe("lag and lead", () => {
  it("positive lag delays an FS successor", () => {
    const a = makeTask({ id: "a" });
    const b = makeTask({ id: "b" });
    const d = dep({ id: "d1", predecessorTaskId: "a", successorTaskId: "b", type: "FS", lagMinutes: 120 });
    const out = computeSchedule({ tasks: [a, b], dependencies: [d], calendars: [calendar] });
    const bOut = out.tasks.find((t) => t.id === "b")!;
    expect(bOut.start).toBe(iso("2026-01-20", "11:00"));
  });

  it("negative lag (lead) pulls an FS successor earlier", () => {
    const a = makeTask({ id: "a" });
    const b = makeTask({ id: "b" });
    const d = dep({ id: "d1", predecessorTaskId: "a", successorTaskId: "b", type: "FS", lagMinutes: -120 });
    const out = computeSchedule({ tasks: [a, b], dependencies: [d], calendars: [calendar] });
    const bOut = out.tasks.find((t) => t.id === "b")!;
    expect(bOut.start).toBe(iso("2026-01-19", "15:00"));
  });
});

describe("multiple predecessors and successors", () => {
  it("successor starts after the latest of multiple FS predecessors", () => {
    const a = makeTask({ id: "a", durationMinutes: 480 }); // finishes Mon 17:00
    const b = makeTask({ id: "b", durationMinutes: 960 }); // finishes Tue 17:00
    const c = makeTask({ id: "c" });
    const deps = [
      dep({ id: "d1", predecessorTaskId: "a", successorTaskId: "c", type: "FS" }),
      dep({ id: "d2", predecessorTaskId: "b", successorTaskId: "c", type: "FS" }),
    ];
    const out = computeSchedule({ tasks: [a, b, c], dependencies: deps, calendars: [calendar] });
    const cOut = out.tasks.find((t) => t.id === "c")!;
    expect(cOut.start).toBe(iso("2026-01-21", "09:00"));
  });

  it("both successors of one predecessor start after it finishes", () => {
    const a = makeTask({ id: "a" });
    const b = makeTask({ id: "b" });
    const c = makeTask({ id: "c" });
    const deps = [
      dep({ id: "d1", predecessorTaskId: "a", successorTaskId: "b", type: "FS" }),
      dep({ id: "d2", predecessorTaskId: "a", successorTaskId: "c", type: "FS" }),
    ];
    const out = computeSchedule({ tasks: [a, b, c], dependencies: deps, calendars: [calendar] });
    expect(out.tasks.find((t) => t.id === "b")!.start).toBe(iso("2026-01-20", "09:00"));
    expect(out.tasks.find((t) => t.id === "c")!.start).toBe(iso("2026-01-20", "09:00"));
  });
});

describe("cycle detection", () => {
  it("reports a CYCLE error and does not silently produce a schedule for the cyclic tasks", () => {
    const a = makeTask({ id: "a" });
    const b = makeTask({ id: "b" });
    const deps = [
      dep({ id: "d1", predecessorTaskId: "a", successorTaskId: "b", type: "FS" }),
      dep({ id: "d2", predecessorTaskId: "b", successorTaskId: "a", type: "FS" }),
    ];
    const out = computeSchedule({ tasks: [a, b], dependencies: deps, calendars: [calendar] });
    expect(out.errors).toContainEqual(expect.objectContaining({ code: "CYCLE" }));
  });

  it("still schedules tasks outside the cyclic component", () => {
    const a = makeTask({ id: "a" });
    const b = makeTask({ id: "b" });
    const c = makeTask({ id: "c" });
    const deps = [
      dep({ id: "d1", predecessorTaskId: "a", successorTaskId: "b", type: "FS" }),
      dep({ id: "d2", predecessorTaskId: "b", successorTaskId: "a", type: "FS" }),
    ];
    const out = computeSchedule({ tasks: [a, b, c], dependencies: deps, calendars: [calendar] });
    const cOut = out.tasks.find((t) => t.id === "c")!;
    expect(cOut.start).toBe(c.start);
  });
});

describe("constraints", () => {
  it("MSO forces the start date regardless of dependencies", () => {
    const a = makeTask({ id: "a" });
    const b = makeTask({ id: "b", constraintType: "MSO", constraintDate: iso("2026-01-22", "09:00") });
    const d = dep({ id: "d1", predecessorTaskId: "a", successorTaskId: "b", type: "FS" });
    const out = computeSchedule({ tasks: [a, b], dependencies: [d], calendars: [calendar] });
    const bOut = out.tasks.find((t) => t.id === "b")!;
    expect(bOut.start).toBe(iso("2026-01-22", "09:00"));
  });

  it("SNET pushes start later than the natural dependency date", () => {
    const a = makeTask({ id: "a" });
    const b = makeTask({ id: "b", constraintType: "SNET", constraintDate: iso("2026-01-23", "09:00") });
    const d = dep({ id: "d1", predecessorTaskId: "a", successorTaskId: "b", type: "FS" });
    const out = computeSchedule({ tasks: [a, b], dependencies: [d], calendars: [calendar] });
    const bOut = out.tasks.find((t) => t.id === "b")!;
    expect(bOut.start).toBe(iso("2026-01-23", "09:00"));
  });

  it("SNLT produces a warning, not a clamp, when infeasible", () => {
    const a = makeTask({ id: "a" });
    const b = makeTask({ id: "b", constraintType: "SNLT", constraintDate: iso("2026-01-19", "09:00") });
    const d = dep({ id: "d1", predecessorTaskId: "a", successorTaskId: "b", type: "FS" });
    const out = computeSchedule({ tasks: [a, b], dependencies: [d], calendars: [calendar] });
    const bOut = out.tasks.find((t) => t.id === "b")!;
    expect(bOut.start).toBe(iso("2026-01-20", "09:00"));
    expect(out.warnings).toContainEqual(expect.objectContaining({ code: "CONSTRAINT_INFEASIBLE", taskId: "b" }));
  });

  it("a deadline produces a warning without constraining the computed schedule", () => {
    const a = makeTask({ id: "a", deadline: iso("2026-01-19", "12:00") });
    const out = computeSchedule({ tasks: [a], dependencies: [], calendars: [calendar] });
    const aOut = out.tasks.find((t) => t.id === "a")!;
    expect(aOut.finish).toBe(iso("2026-01-19", "17:00"));
    expect(out.warnings).toContainEqual(expect.objectContaining({ code: "DEADLINE_MISSED", taskId: "a" }));
  });
});

describe("manual scheduling mode", () => {
  it("a manual task keeps its own dates but still drives successors", () => {
    const a = makeTask({ id: "a", schedulingMode: "manual", start: iso("2026-01-19", "09:00"), finish: iso("2026-01-21", "17:00") });
    const b = makeTask({ id: "b" });
    const d = dep({ id: "d1", predecessorTaskId: "a", successorTaskId: "b", type: "FS" });
    const out = computeSchedule({ tasks: [a, b], dependencies: [d], calendars: [calendar] });
    const aOut = out.tasks.find((t) => t.id === "a")!;
    const bOut = out.tasks.find((t) => t.id === "b")!;
    expect(aOut.start).toBe(a.start);
    expect(aOut.finish).toBe(a.finish);
    expect(bOut.start).toBe(iso("2026-01-22", "09:00"));
  });
});

describe("milestones", () => {
  it("a milestone has zero duration and start === finish", () => {
    const m = makeTask({ id: "m", isMilestone: true, durationMinutes: 0, finish: iso("2026-01-19", "09:00") });
    const out = computeSchedule({ tasks: [m], dependencies: [], calendars: [calendar] });
    const mOut = out.tasks.find((t) => t.id === "m")!;
    expect(mOut.start).toBe(mOut.finish);
  });
});

describe("summary task rollup", () => {
  it("rolls up start/finish from children across two levels of nesting", () => {
    const grandparent = makeTask({ id: "gp", isSummary: true, parentId: null });
    const parent = makeTask({ id: "p", isSummary: true, parentId: "gp" });
    const childA = makeTask({ id: "ca", parentId: "p", start: iso("2026-01-19", "09:00"), finish: iso("2026-01-19", "17:00") });
    const childB = makeTask({ id: "cb", parentId: "p", start: iso("2026-01-20", "09:00"), finish: iso("2026-01-21", "17:00"), durationMinutes: 960 });
    const out = computeSchedule({ tasks: [grandparent, parent, childA, childB], dependencies: [], calendars: [calendar] });
    const parentOut = out.tasks.find((t) => t.id === "p")!;
    const gpOut = out.tasks.find((t) => t.id === "gp")!;
    expect(parentOut.start).toBe(iso("2026-01-19", "09:00"));
    expect(parentOut.finish).toBe(iso("2026-01-21", "17:00"));
    expect(gpOut.start).toBe(parentOut.start);
    expect(gpOut.finish).toBe(parentOut.finish);
  });
});

describe("critical path and float", () => {
  it("a linear chain with no slack is entirely critical", () => {
    const a = makeTask({ id: "a" });
    const b = makeTask({ id: "b" });
    const c = makeTask({ id: "c" });
    const deps = [
      dep({ id: "d1", predecessorTaskId: "a", successorTaskId: "b", type: "FS" }),
      dep({ id: "d2", predecessorTaskId: "b", successorTaskId: "c", type: "FS" }),
    ];
    const out = computeSchedule({ tasks: [a, b, c], dependencies: deps, calendars: [calendar] });
    for (const t of out.tasks) {
      expect(t.isCritical).toBe(true);
      expect(t.totalFloatMinutes).toBe(0);
    }
  });

  it("a parallel shorter task has positive float and is not critical", () => {
    const a = makeTask({ id: "a" });
    const longPath = makeTask({ id: "long", durationMinutes: 960 }); // 2 days
    const shortPath = makeTask({ id: "short", durationMinutes: 480 }); // 1 day
    const join = makeTask({ id: "join" });
    const deps = [
      dep({ id: "d1", predecessorTaskId: "a", successorTaskId: "long", type: "FS" }),
      dep({ id: "d2", predecessorTaskId: "a", successorTaskId: "short", type: "FS" }),
      dep({ id: "d3", predecessorTaskId: "long", successorTaskId: "join", type: "FS" }),
      dep({ id: "d4", predecessorTaskId: "short", successorTaskId: "join", type: "FS" }),
    ];
    const out = computeSchedule({ tasks: [a, longPath, shortPath, join], dependencies: deps, calendars: [calendar] });
    const shortOut = out.tasks.find((t) => t.id === "short")!;
    const longOut = out.tasks.find((t) => t.id === "long")!;
    expect(longOut.isCritical).toBe(true);
    expect(shortOut.isCritical).toBe(false);
    expect(shortOut.totalFloatMinutes).toBeGreaterThan(0);
  });

  it("supports multiple disjoint critical paths of equal length", () => {
    const start = makeTask({ id: "start", durationMinutes: 0, isMilestone: true, finish: iso("2026-01-19", "09:00") });
    const pathA = makeTask({ id: "pathA", durationMinutes: 480 });
    const pathB = makeTask({ id: "pathB", durationMinutes: 480 });
    const end = makeTask({ id: "end", durationMinutes: 0, isMilestone: true, finish: iso("2026-01-19", "09:00") });
    const deps = [
      dep({ id: "d1", predecessorTaskId: "start", successorTaskId: "pathA", type: "FS" }),
      dep({ id: "d2", predecessorTaskId: "start", successorTaskId: "pathB", type: "FS" }),
      dep({ id: "d3", predecessorTaskId: "pathA", successorTaskId: "end", type: "FS" }),
      dep({ id: "d4", predecessorTaskId: "pathB", successorTaskId: "end", type: "FS" }),
    ];
    const out = computeSchedule({ tasks: [start, pathA, pathB, end], dependencies: deps, calendars: [calendar] });
    expect(out.tasks.find((t) => t.id === "pathA")!.isCritical).toBe(true);
    expect(out.tasks.find((t) => t.id === "pathB")!.isCritical).toBe(true);
  });
});

describe("progress and forecasting", () => {
  it("forecasts finish from remaining work as of the status date", () => {
    const a = makeTask({
      id: "a",
      percentComplete: 50,
      remainingWorkMinutes: 240,
      actualStart: iso("2026-01-19", "09:00"),
      status: "in-progress",
    });
    const statusDate = iso("2026-01-20", "09:00");
    const out = computeSchedule({ tasks: [a], dependencies: [], calendars: [calendar], statusDate });
    const forecast = out.forecasts["a"];
    expect(forecast.forecastFinish).toBe(iso("2026-01-20", "13:00"));
  });
});
