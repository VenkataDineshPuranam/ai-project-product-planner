import type { EntityBase } from "./common";

export interface Risk extends EntityBase {
  category: string;
  aiRiskCategory?: string;
  cause: string;
  event: string;
  consequence: string;
  likelihood: 1 | 2 | 3 | 4 | 5;
  impact: 1 | 2 | 3 | 4 | 5;
  exposure: number;
  proximity: string;
  velocity: string;
  treatment: string;
  residualRisk?: number;
  trigger?: string;
  contingency?: string;
  linkedTaskIds: string[];
  reviewDate: string;
}

export interface Issue extends EntityBase {
  linkedRiskId?: string;
}

export interface Assumption extends EntityBase {
  validated?: boolean;
}

export interface DependencyItem extends EntityBase {
  blockedTaskId?: string;
}

export interface Decision extends EntityBase {
  decidedBy: string;
  decidedAt: string;
}

export interface ChangeRequest extends EntityBase {
  impact: string;
  approved?: boolean;
}

export interface Control extends EntityBase {
  policyMappingId?: string;
}

export interface Evidence extends EntityBase {
  uri?: string;
}

export interface Approval extends EntityBase {
  approverId: string;
  decision: "approved" | "rejected" | "conditional";
}

export interface PolicyMapping extends EntityBase {
  policyName: string;
}
