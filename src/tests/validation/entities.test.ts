import { describe, expect, it } from "vitest";
import {
  taskSchema,
  dependencySchema,
  calendarSchema,
  projectSchema,
  resourceSchema,
  assignmentSchema,
  wbsNodeSchema,
} from "@/validation/schemas";
import { makeEntityBase } from "@/validation/factories";

const baseCalendar = {
  id: "cal-1",
  name: "Standard",
  workingDays: { 0: false, 1: true, 2: true, 3: true, 4: true, 5: true, 6: false },
  workingHours: [{ start: "09:00", end: "17:00" }],
  exceptions: [],
  timeZone: "America/New_York",
};

const baseTask = {
  id: "task-1",
  projectId: "proj-1",
  parentId: null,
  wbsCode: "1.1",
  sequence: 1,
  name: "Design API",
  schedulingMode: "auto" as const,
  isSummary: false,
  isMilestone: false,
  start: "2026-01-05T09:00:00.000Z",
  finish: "2026-01-06T17:00:00.000Z",
  durationMinutes: 480,
  workMinutes: 480,
  remainingWorkMinutes: 480,
  percentComplete: 0,
  constraintType: "ASAP" as const,
  calendarId: "cal-1",
  priority: 500,
  fixedCost: 0,
  costAccrual: "prorated" as const,
  status: "not-started" as const,
  tags: [],
};

describe("calendarSchema", () => {
  it("accepts a valid calendar", () => {
    expect(calendarSchema.parse(baseCalendar)).toBeTruthy();
  });

  it("rejects a working-hours interval with end before start", () => {
    const invalid = { ...baseCalendar, workingHours: [{ start: "17:00", end: "09:00" }] };
    expect(() => calendarSchema.parse(invalid)).toThrow();
  });

  it("rejects an unknown IANA-looking time zone string that is empty", () => {
    expect(() => calendarSchema.parse({ ...baseCalendar, timeZone: "" })).toThrow();
  });
});

describe("taskSchema", () => {
  it("accepts a valid auto-scheduled task", () => {
    expect(taskSchema.parse(baseTask)).toBeTruthy();
  });

  it("rejects finish before start", () => {
    const invalid = { ...baseTask, start: "2026-01-06T17:00:00.000Z", finish: "2026-01-05T09:00:00.000Z" };
    expect(() => taskSchema.parse(invalid)).toThrow();
  });

  it("rejects percentComplete outside 0-100", () => {
    expect(() => taskSchema.parse({ ...baseTask, percentComplete: 150 })).toThrow();
    expect(() => taskSchema.parse({ ...baseTask, percentComplete: -1 })).toThrow();
  });

  it("rejects a milestone with nonzero duration", () => {
    const invalid = { ...baseTask, isMilestone: true, durationMinutes: 60 };
    expect(() => taskSchema.parse(invalid)).toThrow();
  });

  it("accepts a milestone with zero duration", () => {
    const valid = { ...baseTask, isMilestone: true, durationMinutes: 0, finish: baseTask.start };
    expect(taskSchema.parse(valid)).toBeTruthy();
  });

  it("rejects an invalid ISO date string", () => {
    expect(() => taskSchema.parse({ ...baseTask, start: "not-a-date" })).toThrow();
  });

  it("rejects a constraint date required for MSO but missing", () => {
    const invalid = { ...baseTask, constraintType: "MSO" as const, constraintDate: undefined };
    expect(() => taskSchema.parse(invalid)).toThrow();
  });
});

describe("dependencySchema", () => {
  it("accepts a valid FS dependency", () => {
    const dep = { id: "dep-1", predecessorTaskId: "task-1", successorTaskId: "task-2", type: "FS" as const, lagMinutes: 0 };
    expect(dependencySchema.parse(dep)).toBeTruthy();
  });

  it("rejects a self-referential dependency", () => {
    const dep = { id: "dep-1", predecessorTaskId: "task-1", successorTaskId: "task-1", type: "FS" as const, lagMinutes: 0 };
    expect(() => dependencySchema.parse(dep)).toThrow();
  });

  it("accepts negative lag (lead)", () => {
    const dep = { id: "dep-1", predecessorTaskId: "task-1", successorTaskId: "task-2", type: "SS" as const, lagMinutes: -120 };
    expect(dependencySchema.parse(dep)).toBeTruthy();
  });
});

describe("wbsNodeSchema", () => {
  it("rejects a node that is its own parent", () => {
    const invalid = {
      id: "wbs-1",
      name: "Root",
      projectId: "proj-1",
      parentId: "wbs-1",
      wbsCode: "1",
      sequence: 1,
      status: "active",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      version: 1,
      tags: [],
    };
    expect(() => wbsNodeSchema.parse(invalid)).toThrow();
  });
});

describe("resourceSchema and assignmentSchema", () => {
  it("accepts a valid resource with maxUnits between 0 and reasonable bound", () => {
    const resource = {
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
    expect(resourceSchema.parse(resource)).toBeTruthy();
  });

  it("rejects negative maxUnits", () => {
    const resource = {
      id: "res-1",
      name: "Jane Doe",
      calendarId: "cal-1",
      maxUnits: -1,
      costRates: [],
      status: "active",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      version: 1,
      tags: [],
    };
    expect(() => resourceSchema.parse(resource)).toThrow();
  });

  it("rejects an assignment with units <= 0", () => {
    const assignment = {
      id: "asg-1",
      taskId: "task-1",
      resourceId: "res-1",
      units: 0,
      plannedWorkMinutes: 480,
      actualWorkMinutes: 0,
      remainingWorkMinutes: 480,
    };
    expect(() => assignmentSchema.parse(assignment)).toThrow();
  });
});

describe("projectSchema", () => {
  it("accepts a minimal valid project", () => {
    const project = {
      ...makeEntityBase({ id: "proj-1", name: "RAG Assistant" }),
      calendarId: "cal-1",
      statusDate: "2026-01-01T00:00:00.000Z",
      workstreamIds: [],
      charter: {
        objectives: ["Ship v1"],
        successCriteria: ["Adoption > 50%"],
        scopeIncluded: ["RAG assistant"],
        scopeExcluded: ["Mobile app"],
        stakeholders: [],
      },
    };
    expect(projectSchema.parse(project)).toBeTruthy();
  });
});
