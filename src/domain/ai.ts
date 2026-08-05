import type { EntityBase } from "./common";

export interface AIUseCase extends EntityBase {
  isAISuitable: boolean;
  buildBuyPartner: "build" | "buy" | "partner";
  riskClassification: "low" | "medium" | "high" | "unacceptable";
}

export interface Dataset extends EntityBase {
  source: string;
  classification: string;
}

export interface DataQualityGate extends EntityBase {
  datasetId: string;
  passed: boolean;
  criteria: string[];
}

export interface ModelCandidate extends EntityBase {
  provider: string;
  family: string;
}

export interface ModelVersion extends EntityBase {
  modelCandidateId: string;
  versionTag: string;
}

export interface PromptVersion extends EntityBase {
  versionTag: string;
  templateHash: string;
}

export interface RetrievalConfiguration extends EntityBase {
  indexType: string;
  chunkStrategy: string;
}

export interface AgentDefinition extends EntityBase {
  toolIds: string[];
  maxSteps: number;
}

export interface ToolDefinition extends EntityBase {
  schema: string;
}

export type EvaluationMetricKind =
  | "accuracy"
  | "groundedness"
  | "relevance"
  | "safety"
  | "latency"
  | "cost";

export interface EvaluationContract extends EntityBase {
  metricIds: string[];
  gateId?: string;
  goldenSetRef: string;
}

export interface EvaluationMetric extends EntityBase {
  kind: EvaluationMetricKind;
  threshold?: number;
}

export interface EvaluationRun extends EntityBase {
  evaluationContractId: string;
  modelVersionId?: string;
  promptVersionId?: string;
  results: Record<string, number>;
  passed: boolean;
}

export interface SafetyControl extends EntityBase {
  controlType: string;
}

export interface HumanReviewGate extends EntityBase {
  requiredForStatuses: string[];
}

export interface DeploymentGate extends EntityBase {
  gateName: string;
  passed: boolean;
  evidenceIds: string[];
  approvalIds: string[];
}

export interface InferenceCostProfile extends EntityBase {
  modelVersionId: string;
  costPerMillionInputTokens: number;
  costPerMillionOutputTokens: number;
}

export interface TokenBudget extends EntityBase {
  periodStart: string;
  periodEnd: string;
  limitTokens: number;
  consumedTokens: number;
}

export interface MonitoringMetric extends EntityBase {
  metricName: string;
  value: number;
  capturedAt: string;
}

export interface Incident extends EntityBase {
  severity: "low" | "medium" | "high" | "critical";
  resolvedAt?: string;
}

export interface RetirementPlan extends EntityBase {
  exitCriteria: string[];
  dataRetentionPolicy: string;
}
