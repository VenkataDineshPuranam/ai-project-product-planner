import { beforeEach, describe, expect, it } from "vitest";
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { closeDb, openPlannerDb } from "@/persistence/db";
import { createRepository } from "@/persistence/repository";
import { taskSchema, projectSchema } from "@/validation/schemas";
import { makeEntityBase } from "@/validation/factories";
import type { Task } from "@/domain";

function resetDb() {
  // fake-indexeddb keeps a global in-memory registry; give each test a clean one.
  globalThis.indexedDB = new IDBFactory();
}

const sampleTask: Task = {
  id: "task-1",
  projectId: "proj-1",
  parentId: null,
  wbsCode: "1.1",
  sequence: 1,
  name: "Design API",
  schedulingMode: "auto",
  isSummary: false,
  isMilestone: false,
  start: "2026-01-05T09:00:00.000Z",
  finish: "2026-01-06T17:00:00.000Z",
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

describe("task repository", () => {
  beforeEach(async () => {
    resetDb();
    await closeDb();
  });

  it("round-trips a valid task through put/getById", async () => {
    const db = await openPlannerDb();
    const repo = createRepository(db, "tasks", taskSchema);
    await repo.put(sampleTask);
    const fetched = await repo.getById(sampleTask.id);
    expect(fetched).toEqual(sampleTask);
  });

  it("rejects an invalid task on put without touching the store", async () => {
    const db = await openPlannerDb();
    const repo = createRepository(db, "tasks", taskSchema);
    const invalid = { ...sampleTask, percentComplete: 999 };
    await expect(repo.put(invalid)).rejects.toThrow();
    const all = await repo.getAll();
    expect(all).toHaveLength(0);
  });

  it("putMany is transactional: one invalid record aborts the whole batch", async () => {
    const db = await openPlannerDb();
    const repo = createRepository(db, "tasks", taskSchema);
    const valid2 = { ...sampleTask, id: "task-2" };
    const invalid = { ...sampleTask, id: "task-3", finish: "2020-01-01T00:00:00.000Z" };
    await expect(repo.putMany([sampleTask, valid2, invalid])).rejects.toThrow();
    const all = await repo.getAll();
    expect(all).toHaveLength(0);
  });

  it("deletes a record", async () => {
    const db = await openPlannerDb();
    const repo = createRepository(db, "tasks", taskSchema);
    await repo.put(sampleTask);
    await repo.delete(sampleTask.id);
    expect(await repo.getById(sampleTask.id)).toBeUndefined();
  });

  it("isolates a corrupted record on read instead of throwing for the whole store", async () => {
    const db = await openPlannerDb();
    const repo = createRepository(db, "tasks", taskSchema);
    await repo.put(sampleTask);
    // Simulate corruption by writing a malformed record directly, bypassing validation.
    const tx = db.transaction("tasks", "readwrite");
    await tx.store.put({ id: "corrupt-1", garbage: true });
    await tx.done;

    const result = await repo.getAllWithQuarantine();
    expect(result.valid).toHaveLength(1);
    expect(result.valid[0].id).toBe(sampleTask.id);
    expect(result.quarantined).toHaveLength(1);
    expect(result.quarantined[0].id).toBe("corrupt-1");
  });

  it("persists data across a simulated reload (db close + reopen)", async () => {
    const db = await openPlannerDb();
    const repo = createRepository(db, "tasks", taskSchema);
    await repo.put(sampleTask);
    await closeDb();

    const reopened = await openPlannerDb();
    const repoAfterReload = createRepository(reopened, "tasks", taskSchema);
    const fetched = await repoAfterReload.getById(sampleTask.id);
    expect(fetched).toEqual(sampleTask);
  });
});

describe("project repository", () => {
  beforeEach(async () => {
    resetDb();
    await closeDb();
  });

  it("round-trips a valid project", async () => {
    const db = await openPlannerDb();
    const repo = createRepository(db, "projects", projectSchema);
    const project = {
      ...makeEntityBase({ id: "proj-1", name: "RAG Assistant" }),
      calendarId: "cal-1",
      statusDate: "2026-01-01T00:00:00.000Z",
      workstreamIds: [],
      charter: {
        objectives: ["Ship v1"],
        successCriteria: [],
        scopeIncluded: [],
        scopeExcluded: [],
        stakeholders: [],
      },
    };
    await repo.put(project);
    expect(await repo.getById("proj-1")).toEqual(project);
  });
});
