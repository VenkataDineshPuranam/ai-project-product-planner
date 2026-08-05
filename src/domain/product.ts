import type { EntityBase } from "./common";

export interface ProductVision extends EntityBase {
  northStarMetric: string;
}

export interface Persona extends EntityBase {
  segment: string;
}

export interface JobToBeDone extends EntityBase {
  personaId: string;
}

export interface ProblemStatement extends EntityBase {
  personaId?: string;
}

export interface Opportunity extends EntityBase {
  problemStatementId?: string;
  evidenceLinks: string[];
}

export interface Outcome extends EntityBase {
  metricName: string;
  baseline: number;
  target: number;
}

export interface OKRKeyResult {
  text: string;
  target: number;
  current: number;
}

export interface OKR extends EntityBase {
  objective: string;
  keyResults: OKRKeyResult[];
}

export interface KPI extends EntityBase {
  formula: string;
  currentValue?: number;
}

export interface Hypothesis extends EntityBase {
  statement: string;
  validated?: boolean;
  evidenceLinks: string[];
}

export interface Epic extends EntityBase {
  outcomeId?: string;
  taskId?: string;
}

export interface Feature extends EntityBase {
  epicId: string;
  outcomeId: string;
  acceptanceCriteria: string[];
  dataDependencies: string[];
  modelDependencies: string[];
  evaluationCriteria: string[];
  securityImpact?: string;
  governanceImpact?: string;
  costExpectation?: number;
  ownerId: string;
  releaseId?: string;
  committed: boolean;
}

export interface Story extends EntityBase {
  featureId: string;
}

export interface Experiment extends EntityBase {
  hypothesisId: string;
  result?: string;
}

export interface AcceptanceCriterion extends EntityBase {
  featureId: string;
  met: boolean;
}

export interface Benefit extends EntityBase {
  outcomeId: string;
  realizedValue?: number;
}

export interface AdoptionMetric extends EntityBase {
  metricName: string;
  value: number;
  capturedAt: string;
}
