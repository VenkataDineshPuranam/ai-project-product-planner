import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import { describe, expect, it } from "vitest";
import { importProjectBundle } from "@/import-export/jsonBundle";
import { computeSchedule } from "@/calculations/schedule";
import { detectOverAllocations } from "@/calculations/resources";
import { featureSchema, riskSchema, evaluationContractSchema, evaluationRunSchema, evaluationMetricSchema, deploymentGateSchema, approvalSchema } from "@/validation/lifecycleSchemas";
import { calendarSchema, resourceSchema } from "@/validation/schemas";
import { canPassDeploymentGate, missingMetricWarnings, resolveEvaluationRunVersions } from "@/domain/rules";
import type { DependencyType } from "@/domain";
import type { Approval, DeploymentGate, EvaluationMetric, EvaluationRun, Feature, Risk } from "@/domain";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sampleDataDir = resolve(__dirname, "..", "..", "..", "sample-data");

function loadJson(fileName: string): unknown {
  return JSON.parse(readFileSync(resolve(sampleDataDir, fileName), "utf-8"));
}

describe("Enterprise RAG program sample: schedule bundle", () => {
  const bundle = importProjectBundle(readFileSync(resolve(sampleDataDir, "enterprise-rag-program.json"), "utf-8"));

  it("passes schema and referential-integrity validation on import (importProjectBundle would otherwise throw)", () => {
    expect(bundle.project.id).toBe("proj-rag");
  });

  it("has at least 120 tasks and at least 20 milestones", () => {
    expect(bundle.tasks.length).toBeGreaterThanOrEqual(120);
    expect(bundle.tasks.filter((t) => t.isMilestone)).toHaveLength(20);
  });

  it("has at least 15 resources spanning the required categories", () => {
    expect(bundle.resources.length).toBeGreaterThanOrEqual(15);
    const names = bundle.resources.map((r) => r.name).join(" ");
    expect(names).toMatch(/Data Engineer/);
    expect(names).toMatch(/ML Engineer/);
    expect(names).toMatch(/Security Engineer/);
    expect(names).toMatch(/Compliance Lead/);
    expect(names).toMatch(/Change Manager/);
    expect(names).toMatch(/Site Reliability Engineer/);
  });

  it("uses all four dependency types", () => {
    const types = new Set(bundle.dependencies.map((d) => d.type));
    const expected: DependencyType[] = ["FS", "SS", "FF", "SF"];
    for (const t of expected) expect(types.has(t)).toBe(true);
  });

  it("includes both positive and negative lag", () => {
    expect(bundle.dependencies.some((d) => d.lagMinutes > 0)).toBe(true);
    expect(bundle.dependencies.some((d) => d.lagMinutes < 0)).toBe(true);
  });

  it("includes at least one project calendar and one distinct resource calendar", () => {
    expect(bundle.calendars.length).toBeGreaterThanOrEqual(2);
  });

  it("has a captured baseline, and at least one task's current schedule has slipped past its baseline", () => {
    expect(bundle.baselines).toHaveLength(1);
    const slipped = bundle.tasks.some((t) => t.baselineFinish && t.baselineFinish !== t.finish);
    expect(slipped).toBe(true);
  });

  it("marks exactly one task 'blocked' as the intentionally-delayed, behind-schedule example", () => {
    const blocked = bundle.tasks.filter((t) => t.status === "blocked");
    expect(blocked).toHaveLength(1);
    expect(blocked[0].tags).toContain("at-risk");
  });

  it("includes completed, in-progress/blocked, and not-started tasks", () => {
    const statuses = new Set(bundle.tasks.map((t) => t.status));
    expect(statuses.has("complete")).toBe(true);
    expect(statuses.has("blocked")).toBe(true);
    expect(statuses.has("not-started")).toBe(true);
  });

  it("recomputes to the same schedule with zero errors (internally consistent)", () => {
    const result = computeSchedule({ tasks: bundle.tasks, dependencies: bundle.dependencies, calendars: bundle.calendars });
    expect(result.errors).toHaveLength(0);
  });

  it("has both critical and non-critical tasks (a real critical path, not everything critical)", () => {
    const result = computeSchedule({ tasks: bundle.tasks, dependencies: bundle.dependencies, calendars: bundle.calendars });
    const leaf = result.tasks.filter((t) => !t.isSummary);
    expect(leaf.some((t) => t.isCritical === true)).toBe(true);
    expect(leaf.some((t) => t.isCritical === false)).toBe(true);
  });

  it("demonstrates at least one resource over-allocation", () => {
    const warnings = detectOverAllocations({ tasks: bundle.tasks, assignments: bundle.assignments, resources: bundle.resources, calendars: bundle.calendars });
    expect(warnings.length).toBeGreaterThan(0);
  });
});

describe("Enterprise RAG program sample: product & AI roadmap bundle", () => {
  const roadmap = loadJson("ai-product-roadmap.json") as {
    product: { features: Feature[] };
    ai: { evaluationMetrics: EvaluationMetric[]; evaluationContracts: unknown[]; evaluationRuns: EvaluationRun[]; deploymentGates: DeploymentGate[]; modelVersions: { id: string }[]; promptVersions: { id: string }[] };
    governance: { risks: Risk[]; approvals: Approval[] };
  };

  it("validates every feature against the schema, including the commit gate", () => {
    for (const feature of roadmap.product.features) {
      expect(() => featureSchema.parse(feature)).not.toThrow();
    }
    const draft = roadmap.product.features.find((f) => f.id === "feat-multilang")!;
    expect(draft.committed).toBe(false);
    const committedCount = roadmap.product.features.filter((f) => f.committed).length;
    expect(committedCount).toBeGreaterThanOrEqual(4);
  });

  it("validates evaluation metrics, contracts, and runs against their schemas", () => {
    for (const metric of roadmap.ai.evaluationMetrics) expect(() => evaluationMetricSchema.parse(metric)).not.toThrow();
    for (const contract of roadmap.ai.evaluationContracts) expect(() => evaluationContractSchema.parse(contract)).not.toThrow();
    for (const run of roadmap.ai.evaluationRuns) expect(() => evaluationRunSchema.parse(run)).not.toThrow();
  });

  it("flags the deliberately-omitted cost metric on the release-candidate run instead of fabricating it", () => {
    const run = roadmap.ai.evaluationRuns.find((r) => r.id === "evalrun-2")!;
    const warnings = missingMetricWarnings(run, roadmap.ai.evaluationMetrics);
    expect(warnings.map((w) => w.metricId)).toContain("metric-cost");
  });

  it("resolves the evaluation run referencing a retired model version (traceability survives supersession)", () => {
    const run = roadmap.ai.evaluationRuns.find((r) => r.id === "evalrun-1")!;
    const resolved = resolveEvaluationRunVersions(run, {
      modelVersionIds: new Set(roadmap.ai.modelVersions.map((m) => m.id)),
      promptVersionIds: new Set(roadmap.ai.promptVersions.map((p) => p.id)),
    });
    expect(resolved.modelVersionResolved).toBe(true);
  });

  it("validates every deployment gate and approval against their schemas", () => {
    for (const gate of roadmap.ai.deploymentGates) expect(() => deploymentGateSchema.parse(gate)).not.toThrow();
    for (const approval of roadmap.governance.approvals) expect(() => approvalSchema.parse(approval)).not.toThrow();
  });

  it("shows a deployment gate that can pass and one that legitimately cannot yet", () => {
    const releaseGate = roadmap.ai.deploymentGates.find((g) => g.id === "gate-release")!;
    const productionGate = roadmap.ai.deploymentGates.find((g) => g.id === "gate-production")!;
    expect(canPassDeploymentGate(releaseGate, roadmap.governance.approvals).ok).toBe(true);
    expect(canPassDeploymentGate(productionGate, roadmap.governance.approvals).ok).toBe(false);
  });

  it("validates every risk and includes AI-specific risk categories", () => {
    for (const risk of roadmap.governance.risks) expect(() => riskSchema.parse(risk)).not.toThrow();
    const aiCategories = roadmap.governance.risks.map((r) => r.aiRiskCategory).filter(Boolean);
    expect(aiCategories).toEqual(expect.arrayContaining(["Hallucination or unsupported output", "Prompt injection", "Data leakage"]));
  });

  it("includes a risk with no treatment that would block milestone completion (exercises the governance gate)", () => {
    const untreated = roadmap.governance.risks.find((r) => r.id === "risk-drift")!;
    expect(untreated.treatment).toBe("");
  });
});

describe("Enterprise RAG program sample: resource-calendar bundle", () => {
  const file = loadJson("resource-calendar.json") as { calendars: unknown[]; resources: unknown[] };

  it("validates calendars and resources against their schemas", () => {
    for (const cal of file.calendars) expect(() => calendarSchema.parse(cal)).not.toThrow();
    for (const res of file.resources) expect(() => resourceSchema.parse(res)).not.toThrow();
  });
});
