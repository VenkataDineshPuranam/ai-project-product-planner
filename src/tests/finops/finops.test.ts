import { describe, expect, it } from "vitest";
import type { InferenceCostProfile, TokenBudget } from "@/domain";
import { computeInferenceCost, costPerAcceptedOutcome, evaluateCostChange, tokenBudgetAlert } from "@/calculations/finops";

const profile: InferenceCostProfile = {
  id: "profile-1",
  name: "gpt-model-x",
  status: "active",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  version: 1,
  tags: [],
  auditTrail: [],
  modelVersionId: "model-v1",
  costPerMillionInputTokens: 3,
  costPerMillionOutputTokens: 15,
};

describe("computeInferenceCost", () => {
  it("computes cost from input and output token volumes", () => {
    const cost = computeInferenceCost(profile, 1_000_000, 500_000);
    expect(cost).toBeCloseTo(3 + 7.5, 5);
  });

  it("returns zero for zero token volumes", () => {
    expect(computeInferenceCost(profile, 0, 0)).toBe(0);
  });
});

function makeBudget(overrides: Partial<TokenBudget> = {}): TokenBudget {
  return {
    id: "budget-1",
    name: "Monthly RAG budget",
    status: "active",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    version: 1,
    tags: [],
    auditTrail: [],
    periodStart: "2026-01-01T00:00:00.000Z",
    periodEnd: "2026-01-31T00:00:00.000Z",
    limitTokens: 1_000_000,
    consumedTokens: 0,
    ...overrides,
  };
}

describe("tokenBudgetAlert", () => {
  it("does not fire below the threshold", () => {
    const budget = makeBudget({ consumedTokens: 700_000 });
    expect(tokenBudgetAlert(budget, 0.8)).toBe(false);
  });

  it("fires once consumption crosses the threshold", () => {
    const budget = makeBudget({ consumedTokens: 850_000 });
    expect(tokenBudgetAlert(budget, 0.8)).toBe(true);
  });

  it("fires exactly at the threshold boundary", () => {
    const budget = makeBudget({ consumedTokens: 800_000 });
    expect(tokenBudgetAlert(budget, 0.8)).toBe(true);
  });
});

describe("costPerAcceptedOutcome", () => {
  it("divides total cost by accepted outcome count", () => {
    expect(costPerAcceptedOutcome(500, 100)).toBeCloseTo(5, 5);
  });

  it("returns undefined rather than a fabricated value when there are zero accepted outcomes", () => {
    expect(costPerAcceptedOutcome(500, 0)).toBeUndefined();
  });
});

describe("evaluateCostChange", () => {
  it("is a genuine improvement when cost drops and quality does not regress", () => {
    const result = evaluateCostChange({ cost: 10, quality: 0.9 }, { cost: 7, quality: 0.91 });
    expect(result.costImproved).toBe(true);
    expect(result.qualityRegressed).toBe(false);
    expect(result.isGenuineImprovement).toBe(true);
  });

  it("is not a genuine improvement when cost drops but quality regresses", () => {
    const result = evaluateCostChange({ cost: 10, quality: 0.9 }, { cost: 7, quality: 0.75 });
    expect(result.costImproved).toBe(true);
    expect(result.qualityRegressed).toBe(true);
    expect(result.isGenuineImprovement).toBe(false);
  });
});
