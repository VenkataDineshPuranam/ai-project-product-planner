import type { Approval, DeploymentGate, EvaluationMetric, EvaluationRun, Risk } from ".";

export interface GateDecision {
  ok: boolean;
  reasons: string[];
}

/**
 * A DeploymentGate may only be marked passed once it has linked evidence
 * and at least one linked, approved Approval. This is deliberately a pure
 * advisory check, not an enforced write-time block — autonomous governance
 * approvals are out of scope for v1 (docs/PRD.md §3); the UI/caller decides
 * what to do with a non-ok decision.
 */
export function canPassDeploymentGate(gate: DeploymentGate, approvals: Approval[]): GateDecision {
  const reasons: string[] = [];
  if (gate.evidenceIds.length === 0) {
    reasons.push("no evidence linked");
  }
  const linkedApprovals = approvals.filter((a) => gate.approvalIds.includes(a.id));
  const hasApproved = linkedApprovals.some((a) => a.decision === "approved");
  if (!hasApproved) {
    reasons.push("no approved approval");
  }
  return { ok: reasons.length === 0, reasons };
}

/**
 * A risk with unset treatment and high exposure (likelihood * impact >= 12,
 * i.e. at least "4 and 3" or higher on a 1-5 scale) should surface as a
 * blocker on any milestone it's linked to. This is a soft warning the UI
 * surfaces, not a hard block — autonomous governance blocking is out of
 * scope for v1 (docs/PRD.md §3; docs/TEST_STRATEGY.md §5).
 */
export function riskBlocksMilestoneCompletion(risk: Risk): boolean {
  const exposure = risk.likelihood * risk.impact;
  return exposure >= 12 && risk.treatment.trim().length === 0;
}

export interface EvaluationRunVersionResolution {
  modelVersionResolved: boolean;
  promptVersionResolved: boolean;
}

export interface VersionIdSets {
  modelVersionIds: Set<string>;
  promptVersionIds: Set<string>;
}

/**
 * Confirms an EvaluationRun's model/prompt version references still exist
 * in the store, even if they have since been superseded by a newer
 * version (traceability must survive supersession, not just deletion).
 */
export function resolveEvaluationRunVersions(run: EvaluationRun, ids: VersionIdSets): EvaluationRunVersionResolution {
  return {
    modelVersionResolved: run.modelVersionId ? ids.modelVersionIds.has(run.modelVersionId) : true,
    promptVersionResolved: run.promptVersionId ? ids.promptVersionIds.has(run.promptVersionId) : true,
  };
}

export interface MissingMetricWarning {
  metricId: string;
  metricName: string;
}

/** Contracted metrics with no corresponding result are reported, never silently defaulted to 0/pass. */
export function missingMetricWarnings(run: EvaluationRun, contractedMetrics: EvaluationMetric[]): MissingMetricWarning[] {
  return contractedMetrics
    .filter((metric) => !(metric.id in run.results))
    .map((metric) => ({ metricId: metric.id, metricName: metric.name }));
}
