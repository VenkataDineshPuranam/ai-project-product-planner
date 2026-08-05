import type { EntityBase } from "./common";

export interface Portfolio extends EntityBase {
  programIds: string[];
}

export interface Program extends EntityBase {
  portfolioId: string;
  projectIds: string[];
}

export interface Stakeholder {
  name: string;
  role: string;
  raciRole: "R" | "A" | "C" | "I";
}

export interface ProjectCharter {
  objectives: string[];
  successCriteria: string[];
  scopeIncluded: string[];
  scopeExcluded: string[];
  stakeholders: Stakeholder[];
}

export interface Project extends EntityBase {
  programId?: string;
  charter: ProjectCharter;
  calendarId: string;
  statusDate: string;
  workstreamIds: string[];
}

export interface Product extends EntityBase {
  visionId?: string;
  productIncrementIds: string[];
}

export interface ProductIncrement extends EntityBase {
  releaseIds: string[];
  startDate: string;
  endDate: string;
}

export interface Release extends EntityBase {
  sprintIds: string[];
  targetDate: string;
}

export interface Sprint extends EntityBase {
  startDate: string;
  endDate: string;
}

export interface Workstream extends EntityBase {
  projectId: string;
}
