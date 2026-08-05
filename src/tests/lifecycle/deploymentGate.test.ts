import { describe, expect, it } from "vitest";
import type { Approval, DeploymentGate } from "@/domain";
import { canPassDeploymentGate } from "@/domain/rules";

function makeGate(overrides: Partial<DeploymentGate> = {}): DeploymentGate {
  return {
    id: "gate-1",
    name: "Production readiness",
    status: "active",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    version: 1,
    tags: [],
    auditTrail: [],
    gateName: "Production readiness",
    passed: false,
    evidenceIds: [],
    approvalIds: [],
    ...overrides,
  };
}

function makeApproval(overrides: Partial<Approval> = {}): Approval {
  return {
    id: "appr-1",
    name: "Sponsor approval",
    status: "active",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    version: 1,
    tags: [],
    auditTrail: [],
    approverId: "user-1",
    decision: "approved",
    ...overrides,
  };
}

describe("canPassDeploymentGate", () => {
  it("blocks a gate with no evidence", () => {
    const gate = makeGate({ approvalIds: ["appr-1"] });
    const result = canPassDeploymentGate(gate, [makeApproval()]);
    expect(result.ok).toBe(false);
    expect(result.reasons).toContain("no evidence linked");
  });

  it("blocks a gate with no approved approval", () => {
    const gate = makeGate({ evidenceIds: ["ev-1"], approvalIds: ["appr-1"] });
    const result = canPassDeploymentGate(gate, [makeApproval({ decision: "rejected" })]);
    expect(result.ok).toBe(false);
    expect(result.reasons).toContain("no approved approval");
  });

  it("allows a gate with both evidence and an approved approval", () => {
    const gate = makeGate({ evidenceIds: ["ev-1"], approvalIds: ["appr-1"] });
    const result = canPassDeploymentGate(gate, [makeApproval({ decision: "approved" })]);
    expect(result.ok).toBe(true);
    expect(result.reasons).toHaveLength(0);
  });

  it("ignores approvals not linked to this gate", () => {
    const gate = makeGate({ evidenceIds: ["ev-1"], approvalIds: [] });
    const result = canPassDeploymentGate(gate, [makeApproval({ id: "unrelated" })]);
    expect(result.ok).toBe(false);
    expect(result.reasons).toContain("no approved approval");
  });
});
