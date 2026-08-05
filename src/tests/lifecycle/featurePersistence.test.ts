import { beforeEach, describe, expect, it } from "vitest";
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { closeDb, openPlannerDb } from "@/persistence/db";
import { createRepository } from "@/persistence/repository";
import { featureSchema } from "@/validation/lifecycleSchemas";
import { makeEntityBase } from "@/validation/factories";

function resetDb() {
  globalThis.indexedDB = new IDBFactory();
}

describe("feature repository enforces the commit gate at write time", () => {
  beforeEach(async () => {
    resetDb();
    await closeDb();
  });

  it("persists a fully-linked committed feature", async () => {
    const db = await openPlannerDb();
    const repo = createRepository(db, "features", featureSchema);
    const feature = {
      ...makeEntityBase({ id: "feat-1", name: "Semantic search" }),
      epicId: "epic-1",
      outcomeId: "outcome-1",
      acceptanceCriteria: ["Returns relevant results within 2s"],
      dataDependencies: [],
      modelDependencies: [],
      evaluationCriteria: ["Groundedness >= 0.9"],
      ownerId: "user-1",
      releaseId: "release-1",
      committed: true,
    };
    await repo.put(feature);
    expect(await repo.getById("feat-1")).toEqual(feature);
  });

  it("rejects writing a committed feature that is missing required linkage", async () => {
    const db = await openPlannerDb();
    const repo = createRepository(db, "features", featureSchema);
    const incomplete = {
      ...makeEntityBase({ id: "feat-2", name: "Half-planned feature" }),
      epicId: "epic-1",
      outcomeId: "outcome-1",
      acceptanceCriteria: [],
      dataDependencies: [],
      modelDependencies: [],
      evaluationCriteria: [],
      ownerId: "user-1",
      committed: true,
    };
    await expect(repo.put(incomplete)).rejects.toThrow();
    expect(await repo.getAll()).toHaveLength(0);
  });

  it("allows persisting the same feature as a draft (not committed) despite missing linkage", async () => {
    const db = await openPlannerDb();
    const repo = createRepository(db, "features", featureSchema);
    const draft = {
      ...makeEntityBase({ id: "feat-3", name: "Draft feature" }),
      epicId: "epic-1",
      outcomeId: "outcome-1",
      acceptanceCriteria: [],
      dataDependencies: [],
      modelDependencies: [],
      evaluationCriteria: [],
      ownerId: "user-1",
      committed: false,
    };
    await repo.put(draft);
    expect(await repo.getById("feat-3")).toEqual(draft);
  });
});
