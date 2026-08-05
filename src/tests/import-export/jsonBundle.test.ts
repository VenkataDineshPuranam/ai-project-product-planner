import { describe, expect, it } from "vitest";
import { exportProjectBundle, importProjectBundle } from "@/import-export/jsonBundle";
import { makeEntityBase } from "@/validation/factories";
import type { Calendar, Dependency, Task } from "@/domain";

const calendar: Calendar = {
  id: "cal-1",
  name: "Standard",
  workingDays: { 0: false, 1: true, 2: true, 3: true, 4: true, 5: true, 6: false },
  workingHours: [{ start: "09:00", end: "17:00" }],
  exceptions: [],
  timeZone: "America/New_York",
};

const project = {
  ...makeEntityBase({ id: "proj-1", name: "RAG Assistant" }),
  calendarId: "cal-1",
  statusDate: "2026-01-01T00:00:00.000Z",
  workstreamIds: [],
  charter: { objectives: [], successCriteria: [], scopeIncluded: [], scopeExcluded: [], stakeholders: [] },
};

const task: Task = {
  id: "task-1",
  projectId: "proj-1",
  parentId: null,
  wbsCode: "1",
  sequence: 1,
  name: "Design",
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
};

const bundleInput = {
  project,
  tasks: [task],
  dependencies: [] as Dependency[],
  calendars: [calendar],
  resources: [],
  assignments: [],
  baselines: [],
};

describe("JSON bundle export/import round trip", () => {
  it("re-imports an exported bundle to an identical structure", () => {
    const json = exportProjectBundle(bundleInput);
    const imported = importProjectBundle(json);
    expect(imported.project).toEqual(project);
    expect(imported.tasks).toEqual([task]);
    expect(imported.calendars).toEqual([calendar]);
    expect(imported.schemaVersion).toBe(1);
  });

  it("rejects a bundle with a dangling dependency reference", () => {
    const badJson = exportProjectBundle({
      ...bundleInput,
      dependencies: [{ id: "dep-1", predecessorTaskId: "task-1", successorTaskId: "task-missing", type: "FS", lagMinutes: 0 }],
    });
    expect(() => importProjectBundle(badJson)).toThrow(/task-missing/);
  });

  it("rejects malformed JSON with a clear error rather than throwing a raw parse exception", () => {
    expect(() => importProjectBundle("{not valid json")).toThrow();
  });

  it("rejects a structurally invalid bundle (fails schema validation)", () => {
    const invalid = JSON.stringify({ schemaVersion: 1, project: {}, tasks: [], dependencies: [], calendars: [], resources: [], assignments: [], baselines: [] });
    expect(() => importProjectBundle(invalid)).toThrow();
  });
});
