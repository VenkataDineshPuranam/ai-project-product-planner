import { describe, expect, it } from "vitest";
import { featureSchema } from "@/validation/lifecycleSchemas";
import { makeEntityBase } from "@/validation/factories";

function baseFeature(overrides: Record<string, unknown> = {}) {
  return {
    ...makeEntityBase({ id: "feat-1", name: "Semantic search" }),
    epicId: "epic-1",
    outcomeId: "outcome-1",
    acceptanceCriteria: ["Search returns relevant results within 2s"],
    dataDependencies: [],
    modelDependencies: [],
    evaluationCriteria: ["Groundedness >= 0.9"],
    ownerId: "user-1",
    releaseId: "release-1",
    committed: true,
    ...overrides,
  };
}

describe("featureSchema commit gate", () => {
  it("accepts a committed feature with all required linkage present", () => {
    expect(featureSchema.parse(baseFeature())).toBeTruthy();
  });

  it("accepts an uncommitted feature even with missing linkage", () => {
    const feature = baseFeature({ committed: false, acceptanceCriteria: [], evaluationCriteria: [], releaseId: undefined });
    expect(featureSchema.parse(feature)).toBeTruthy();
  });

  it("rejects a committed feature with no acceptance criteria", () => {
    expect(() => featureSchema.parse(baseFeature({ acceptanceCriteria: [] }))).toThrow();
  });

  it("rejects a committed feature with no evaluation criteria", () => {
    expect(() => featureSchema.parse(baseFeature({ evaluationCriteria: [] }))).toThrow();
  });

  it("rejects a committed feature with no release target", () => {
    expect(() => featureSchema.parse(baseFeature({ releaseId: undefined }))).toThrow();
  });

  it("rejects a committed feature with no owner", () => {
    expect(() => featureSchema.parse(baseFeature({ ownerId: "" }))).toThrow();
  });

  it("rejects a committed feature with no outcome linkage", () => {
    expect(() => featureSchema.parse(baseFeature({ outcomeId: "" }))).toThrow();
  });
});
