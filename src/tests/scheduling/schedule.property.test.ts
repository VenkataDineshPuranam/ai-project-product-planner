import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { Calendar, Dependency, Task } from "@/domain";
import { computeSchedule } from "@/calculations/schedule";
import { zonedWallTimeToUtc } from "@/calculations/calendar";

const calendar: Calendar = {
  id: "cal-1",
  name: "Standard M-F 9-17",
  workingDays: { 0: false, 1: true, 2: true, 3: true, 4: true, 5: true, 6: false },
  workingHours: [{ start: "09:00", end: "17:00" }],
  exceptions: [],
  timeZone: "America/New_York",
};

const projectStart = zonedWallTimeToUtc("2026-01-19", "09:00", "America/New_York").toISOString();

function buildTask(id: string, durationMinutes: number): Task {
  return {
    id,
    projectId: "proj-1",
    parentId: null,
    wbsCode: id,
    sequence: 0,
    name: id,
    schedulingMode: "auto",
    isSummary: false,
    isMilestone: false,
    start: projectStart,
    finish: projectStart,
    durationMinutes,
    workMinutes: durationMinutes,
    remainingWorkMinutes: durationMinutes,
    percentComplete: 0,
    constraintType: "ASAP",
    calendarId: "cal-1",
    priority: 500,
    fixedCost: 0,
    costAccrual: "prorated",
    status: "not-started",
    tags: [],
  };
}

// Generates a random DAG: N tasks with random durations, and random FS/SS
// edges that only ever point from a lower-indexed task to a higher-indexed
// one (guaranteeing acyclicity by construction) with non-negative lag.
const dagArbitrary = fc
  .integer({ min: 2, max: 8 })
  .chain((n) =>
    fc.record({
      durations: fc.array(fc.integer({ min: 60, max: 960 }).map((m) => Math.round(m / 60) * 60), {
        minLength: n,
        maxLength: n,
      }),
      edges: fc.array(
        fc.record({
          from: fc.integer({ min: 0, max: n - 1 }),
          to: fc.integer({ min: 0, max: n - 1 }),
          type: fc.constantFrom<"FS" | "SS">("FS", "SS"),
          lag: fc.integer({ min: 0, max: 240 }),
        }),
        { maxLength: n * 2 },
      ),
    }),
  );

describe("scheduling engine invariants (property-based)", () => {
  it("EF >= ES, LS <= LF, and float ordering hold for any acyclic FS/SS graph", () => {
    fc.assert(
      fc.property(dagArbitrary, ({ durations, edges }) => {
        const tasks = durations.map((d, i) => buildTask(`t${i}`, d));
        const validEdges: Dependency[] = edges
          .filter((e) => e.from < e.to) // enforce lower -> higher index only, guaranteeing a DAG
          .map((e, i) => ({
            id: `e${i}`,
            predecessorTaskId: `t${e.from}`,
            successorTaskId: `t${e.to}`,
            type: e.type,
            lagMinutes: e.lag,
          }));

        const out = computeSchedule({ tasks, dependencies: validEdges, calendars: [calendar] });

        expect(out.errors.filter((e) => e.code === "CYCLE")).toHaveLength(0);

        for (const task of out.tasks) {
          expect(new Date(task.finish).getTime()).toBeGreaterThanOrEqual(new Date(task.start).getTime());
          expect(task.totalFloatMinutes).toBeDefined();
          expect(task.freeFloatMinutes).toBeDefined();
          expect(task.totalFloatMinutes!).toBeGreaterThanOrEqual(0);
          expect(task.freeFloatMinutes!).toBeGreaterThanOrEqual(0);
          expect(task.freeFloatMinutes!).toBeLessThanOrEqual(task.totalFloatMinutes!);
          if (task.isCritical) {
            expect(task.totalFloatMinutes!).toBeLessThanOrEqual(0);
          }
        }
      }),
      { numRuns: 200 },
    );
  });

  it("never leaves a genuine cycle undetected", () => {
    fc.assert(
      fc.property(fc.integer({ min: 2, max: 6 }), (n) => {
        const tasks = Array.from({ length: n }, (_, i) => buildTask(`t${i}`, 480));
        // Build a single ring: t0 -> t1 -> ... -> t(n-1) -> t0
        const edges: Dependency[] = tasks.map((t, i) => ({
          id: `e${i}`,
          predecessorTaskId: t.id,
          successorTaskId: tasks[(i + 1) % n].id,
          type: "FS" as const,
          lagMinutes: 0,
        }));
        const out = computeSchedule({ tasks, dependencies: edges, calendars: [calendar] });
        expect(out.errors.some((e) => e.code === "CYCLE")).toBe(true);
      }),
      { numRuns: 50 },
    );
  });
});
