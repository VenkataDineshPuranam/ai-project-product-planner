import { describe, expect, it } from "vitest";
import type { Risk } from "@/domain";
import { riskBlocksMilestoneCompletion } from "@/domain/rules";

function makeRisk(overrides: Partial<Risk> = {}): Risk {
  return {
    id: "risk-1",
    name: "Hallucinated citations",
    status: "active",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    version: 1,
    tags: [],
    auditTrail: [],
    category: "AI quality",
    cause: "insufficient grounding",
    event: "model cites nonexistent source",
    consequence: "user distrust",
    likelihood: 4,
    impact: 4,
    exposure: 16,
    proximity: "near-term",
    velocity: "fast",
    treatment: "",
    linkedTaskIds: [],
    reviewDate: "2026-02-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("riskBlocksMilestoneCompletion", () => {
  it("blocks (soft warning) when likelihood*impact is high and no treatment is defined", () => {
    const risk = makeRisk({ likelihood: 4, impact: 4, treatment: "" });
    expect(riskBlocksMilestoneCompletion(risk)).toBe(true);
  });

  it("does not block when a treatment is defined, even for a high-exposure risk", () => {
    const risk = makeRisk({ likelihood: 5, impact: 5, treatment: "Add citation verification step" });
    expect(riskBlocksMilestoneCompletion(risk)).toBe(false);
  });

  it("does not block a low-exposure risk even without a treatment", () => {
    const risk = makeRisk({ likelihood: 1, impact: 1, treatment: "" });
    expect(riskBlocksMilestoneCompletion(risk)).toBe(false);
  });
});
