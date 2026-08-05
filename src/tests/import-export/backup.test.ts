import { beforeEach, describe, expect, it } from "vitest";
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { closeDb, openPlannerDb } from "@/persistence/db";
import { createRepository } from "@/persistence/repository";
import { taskSchema } from "@/validation/schemas";
import { backupDatabase, restoreDatabase } from "@/import-export/backup";

function resetDb() {
  globalThis.indexedDB = new IDBFactory();
}

const task = {
  id: "task-1",
  projectId: "proj-1",
  parentId: null,
  wbsCode: "1",
  sequence: 1,
  name: "Design",
  schedulingMode: "auto" as const,
  isSummary: false,
  isMilestone: false,
  start: "2026-01-19T14:00:00.000Z",
  finish: "2026-01-19T22:00:00.000Z",
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

describe("backup/restore", () => {
  beforeEach(async () => {
    resetDb();
    await closeDb();
  });

  it("restores a backup taken from one database instance into a fresh, empty one", async () => {
    const db1 = await openPlannerDb();
    const repo1 = createRepository(db1, "tasks", taskSchema);
    await repo1.put(task);
    const backupJson = await backupDatabase(db1);
    await closeDb();

    resetDb();
    const db2 = await openPlannerDb();
    await restoreDatabase(db2, backupJson);
    const repo2 = createRepository(db2, "tasks", taskSchema);
    expect(await repo2.getById("task-1")).toEqual(task);
  });

  it("rejects a corrupted backup file without partially applying it", async () => {
    const db = await openPlannerDb();
    const repo = createRepository(db, "tasks", taskSchema);
    await repo.put(task);

    const corrupted = JSON.stringify({
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      stores: { tasks: [{ id: "bad-task", percentComplete: 999 }] },
    });
    await expect(restoreDatabase(db, corrupted)).rejects.toThrow();
    // Original data must be untouched after a rejected restore.
    expect(await repo.getById("task-1")).toEqual(task);
    expect(await repo.getById("bad-task")).toBeUndefined();
  });
});
