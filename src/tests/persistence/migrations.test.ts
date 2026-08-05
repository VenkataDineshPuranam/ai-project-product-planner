import { describe, expect, it } from "vitest";
import { migrateDocument, type Migration } from "@/persistence/migrations";

interface V1Doc {
  schemaVersion: 1;
  id: string;
  fullName: string;
}

interface V2Doc {
  schemaVersion: 2;
  id: string;
  firstName: string;
  lastName: string;
}

const v1ToV2: Migration = {
  from: 1,
  to: 2,
  migrate: (doc: Record<string, unknown>) => {
    const { fullName, ...rest } = doc as unknown as V1Doc;
    const [firstName, ...lastParts] = fullName.split(" ");
    return { ...rest, schemaVersion: 2, firstName, lastName: lastParts.join(" ") };
  },
};

describe("migrateDocument", () => {
  it("applies a single migration step", () => {
    const v1: V1Doc = { schemaVersion: 1, id: "a", fullName: "Ada Lovelace" };
    const result = migrateDocument(v1 as unknown as Record<string, unknown>, [v1ToV2], 2) as unknown as V2Doc;
    expect(result).toEqual({ schemaVersion: 2, id: "a", firstName: "Ada", lastName: "Lovelace" });
  });

  it("is a no-op when the document is already at the target version", () => {
    const v2: V2Doc = { schemaVersion: 2, id: "a", firstName: "Ada", lastName: "Lovelace" };
    const result = migrateDocument(v2 as unknown as Record<string, unknown>, [v1ToV2], 2);
    expect(result).toEqual(v2);
  });

  it("throws when no migration path exists to the target version", () => {
    const v1: V1Doc = { schemaVersion: 1, id: "a", fullName: "Ada Lovelace" };
    expect(() => migrateDocument(v1 as unknown as Record<string, unknown>, [], 2)).toThrow();
  });

  it("chains multiple migrations in order", () => {
    const v2ToV3: Migration = {
      from: 2,
      to: 3,
      migrate: (doc) => ({ ...doc, schemaVersion: 3, greeting: `Hello, ${(doc as unknown as V2Doc).firstName}` }),
    };
    const v1: V1Doc = { schemaVersion: 1, id: "a", fullName: "Ada Lovelace" };
    const result = migrateDocument(v1 as unknown as Record<string, unknown>, [v1ToV2, v2ToV3], 3);
    expect(result).toEqual({
      schemaVersion: 3,
      id: "a",
      firstName: "Ada",
      lastName: "Lovelace",
      greeting: "Hello, Ada",
    });
  });
});
