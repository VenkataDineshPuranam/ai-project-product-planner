import { describe, expect, it } from "vitest";
import type { EvaluationMetric, EvaluationRun } from "@/domain";
import { missingMetricWarnings, resolveEvaluationRunVersions } from "@/domain/rules";

function makeMetric(overrides: Partial<EvaluationMetric> = {}): EvaluationMetric {
  return {
    id: "metric-groundedness",
    name: "Groundedness",
    status: "active",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    version: 1,
    tags: [],
    auditTrail: [],
    kind: "groundedness",
    threshold: 0.9,
    ...overrides,
  };
}

function makeRun(overrides: Partial<EvaluationRun> = {}): EvaluationRun {
  return {
    id: "run-1",
    name: "Nightly eval run",
    status: "active",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    version: 1,
    tags: [],
    auditTrail: [],
    evaluationContractId: "contract-1",
    modelVersionId: "model-v1",
    promptVersionId: "prompt-v1",
    results: { "metric-groundedness": 0.95 },
    passed: true,
    ...overrides,
  };
}

describe("resolveEvaluationRunVersions", () => {
  it("resolves model/prompt versions when they still exist", () => {
    const run = makeRun();
    const resolved = resolveEvaluationRunVersions(run, {
      modelVersionIds: new Set(["model-v1"]),
      promptVersionIds: new Set(["prompt-v1"]),
    });
    expect(resolved.modelVersionResolved).toBe(true);
    expect(resolved.promptVersionResolved).toBe(true);
  });

  it("still resolves (without dangling/throwing) when the referenced version has since been superseded", () => {
    // A retired/superseded ModelVersion is not necessarily deleted from the
    // store, but this proves resolution doesn't assume it's the *current* one.
    const run = makeRun({ modelVersionId: "model-v1-retired" });
    const resolved = resolveEvaluationRunVersions(run, {
      modelVersionIds: new Set(["model-v1-retired", "model-v2-current"]),
      promptVersionIds: new Set(["prompt-v1"]),
    });
    expect(resolved.modelVersionResolved).toBe(true);
  });

  it("flags a genuinely dangling reference instead of silently ignoring it", () => {
    const run = makeRun({ modelVersionId: "model-deleted" });
    const resolved = resolveEvaluationRunVersions(run, {
      modelVersionIds: new Set(["model-v2-current"]),
      promptVersionIds: new Set(["prompt-v1"]),
    });
    expect(resolved.modelVersionResolved).toBe(false);
  });
});

describe("missingMetricWarnings", () => {
  it("produces no warnings when every contracted metric has a result", () => {
    const run = makeRun();
    const warnings = missingMetricWarnings(run, [makeMetric()]);
    expect(warnings).toHaveLength(0);
  });

  it("warns (does not fabricate a value) when a contracted metric is missing from results", () => {
    const run = makeRun({ results: {} });
    const warnings = missingMetricWarnings(run, [makeMetric()]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({ metricId: "metric-groundedness" });
  });
});
