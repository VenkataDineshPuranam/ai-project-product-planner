import type { EntityBase } from "@/domain";

/** Fills in EntityBase defaults for tests and repository create paths. */
export function makeEntityBase(overrides: Partial<EntityBase> & { id: string; name: string }): EntityBase {
  const now = new Date().toISOString();
  return {
    status: "active",
    createdAt: now,
    updatedAt: now,
    version: 1,
    tags: [],
    auditTrail: [],
    ...overrides,
  };
}
