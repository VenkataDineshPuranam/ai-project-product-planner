# Data Model

Canonical TypeScript interfaces for the domain. This is the source of
truth for `src/domain/`; implementation must not diverge without updating
this document first.

## 1. Common fields

Every entity extends:

```ts
interface EntityBase {
  id: string;               // stable, generated (ULID recommended)
  name: string;              // or "title" where noted
  description?: string;
  ownerId?: string;
  status: string;            // entity-specific union, see below
  createdAt: string;         // ISO 8601 UTC
  updatedAt: string;         // ISO 8601 UTC
  version: number;           // optimistic-concurrency / migration marker
  tags: string[];
  auditTrail: AuditEvent[];  // append-only, see Governance
  externalRef?: string;      // optional pointer into an external system
}
```

## 2. Portfolio & planning entities

```ts
interface Portfolio extends EntityBase { programIds: string[]; }

interface Program extends EntityBase {
  portfolioId: string;
  projectIds: string[];
}

interface Project extends EntityBase {
  programId?: string;
  charter: ProjectCharter;
  calendarId: string;
  statusDate: string;
  workstreamIds: string[];
}

interface ProjectCharter {
  objectives: string[];
  successCriteria: string[];
  scopeIncluded: string[];
  scopeExcluded: string[];
  stakeholders: Stakeholder[];
}

interface Stakeholder { name: string; role: string; raciRole: "R"|"A"|"C"|"I"; }

interface Product extends EntityBase {
  visionId?: string;
  productIncrementIds: string[];
}

interface ProductIncrement extends EntityBase { releaseIds: string[]; startDate: string; endDate: string; }
interface Release extends EntityBase { sprintIds: string[]; targetDate: string; }
interface Sprint extends EntityBase { startDate: string; endDate: string; }
interface Workstream extends EntityBase { projectId: string; }

interface WBSNode extends EntityBase {
  projectId: string;
  parentId: string | null;
  wbsCode: string;
  sequence: number;
}
```

### 2.1 Task (see also SCHEDULING_ENGINE_SPEC.md)

```ts
type DependencyType = "FS" | "SS" | "FF" | "SF";
type SchedulingMode = "auto" | "manual";
type ConstraintType =
  | "ASAP" | "ALAP" | "SNET" | "SNLT" | "FNET" | "FNLT" | "MSO" | "MFO";

interface Task {
  id: string;
  projectId: string;
  parentId: string | null;
  wbsCode: string;
  sequence: number;

  name: string;
  description?: string;
  workstreamId?: string;
  ownerId?: string;

  schedulingMode: SchedulingMode;
  isSummary: boolean;
  isMilestone: boolean;

  start: string;              // ISO date-time, calendar-resolved
  finish: string;
  durationMinutes: number;
  workMinutes: number;
  remainingWorkMinutes: number;

  percentComplete: number;         // 0-100, work-based
  physicalPercentComplete?: number; // 0-100, deliverable-based

  constraintType: ConstraintType;
  constraintDate?: string;
  deadline?: string;

  calendarId: string;
  priority: number;                // 0-1000, MSP convention

  fixedCost: number;
  costAccrual: "start" | "prorated" | "end";

  baselineStart?: string;
  baselineFinish?: string;
  baselineDurationMinutes?: number;
  baselineWorkMinutes?: number;
  baselineCost?: number;

  actualStart?: string;
  actualFinish?: string;
  actualWorkMinutes?: number;
  actualCost?: number;

  totalFloatMinutes?: number;
  freeFloatMinutes?: number;
  isCritical?: boolean;

  status: "not-started" | "in-progress" | "blocked" | "complete" | "cancelled";
  tags: string[];
}

interface Milestone extends Task { isMilestone: true; durationMinutes: 0; }

interface Dependency {
  id: string;
  predecessorTaskId: string;
  successorTaskId: string;
  type: DependencyType;
  lagMinutes: number;   // negative = lead
}

interface Calendar {
  id: string;
  name: string;
  baseCalendarId?: string;        // inheritance
  workingDays: Record<0|1|2|3|4|5|6, boolean>; // 0 = Sunday
  workingHours: { start: string; end: string }[]; // e.g. two shifts
  exceptions: CalendarException[]; // holidays, one-off overrides
  timeZone: string;                 // IANA zone, e.g. "America/New_York"
}

interface CalendarException {
  date: string;                // ISO date
  isWorking: boolean;
  workingHours?: { start: string; end: string }[];
  label?: string;
}

interface Resource extends EntityBase {
  resourceGroupId?: string;
  calendarId: string;
  maxUnits: number;            // e.g. 1.0 = 100%
  costRates: CostRate[];
}

interface ResourceGroup extends EntityBase { resourceIds: string[]; }

interface Assignment {
  id: string;
  taskId: string;
  resourceId: string;
  units: number;                    // 0-1+ (>1 = overtime/multiple)
  plannedWorkMinutes: number;
  actualWorkMinutes: number;
  remainingWorkMinutes: number;
  costRateId?: string;
}

interface CostRate {
  id: string;
  resourceId: string;
  standardRatePerHour: number;
  overtimeRatePerHour?: number;
  effectiveFrom: string;
}

interface Baseline extends EntityBase {
  projectId: string;
  capturedAt: string;
  taskSnapshots: Record<string, Pick<Task,
    "start"|"finish"|"durationMinutes"|"workMinutes"|"fixedCost">>;
}

interface StatusSnapshot extends EntityBase {
  projectId: string;
  statusDate: string;
  taskPercentComplete: Record<string, number>;
}

interface Deliverable extends EntityBase { taskId: string; }
```

## 3. Product-management entities

```ts
interface ProductVision extends EntityBase { northStarMetric: string; }
interface Persona extends EntityBase { segment: string; }
interface JobToBeDone extends EntityBase { personaId: string; }
interface ProblemStatement extends EntityBase { personaId?: string; }
interface Opportunity extends EntityBase { problemStatementId?: string; evidenceLinks: string[]; }
interface Outcome extends EntityBase { metricName: string; baseline: number; target: number; }
interface OKR extends EntityBase { objective: string; keyResults: { text: string; target: number; current: number }[]; }
interface KPI extends EntityBase { formula: string; currentValue?: number; }
interface Hypothesis extends EntityBase { statement: string; validated?: boolean; evidenceLinks: string[]; }
interface Epic extends EntityBase { outcomeId?: string; taskId?: string; }
interface Feature extends EntityBase {
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
  committed: boolean; // may only be true if all required fields above are set
}
interface Story extends EntityBase { featureId: string; }
interface Experiment extends EntityBase { hypothesisId: string; result?: string; }
interface AcceptanceCriterion extends EntityBase { featureId: string; met: boolean; }
interface Benefit extends EntityBase { outcomeId: string; realizedValue?: number; }
interface AdoptionMetric extends EntityBase { metricName: string; value: number; capturedAt: string; }
```

## 4. AI-specific entities

```ts
interface AIUseCase extends EntityBase {
  isAISuitable: boolean;
  buildBuyPartner: "build" | "buy" | "partner";
  riskClassification: "low" | "medium" | "high" | "unacceptable";
}
interface Dataset extends EntityBase { source: string; classification: string; }
interface DataQualityGate extends EntityBase { datasetId: string; passed: boolean; criteria: string[]; }
interface ModelCandidate extends EntityBase { provider: string; family: string; }
interface ModelVersion extends EntityBase { modelCandidateId: string; versionTag: string; }
interface PromptVersion extends EntityBase { versionTag: string; templateHash: string; }
interface RetrievalConfiguration extends EntityBase { indexType: string; chunkStrategy: string; }
interface AgentDefinition extends EntityBase { toolIds: string[]; maxSteps: number; }
interface ToolDefinition extends EntityBase { schema: string; }
interface EvaluationContract extends EntityBase {
  metricIds: string[];
  gateId?: string;
  goldenSetRef: string;
}
interface EvaluationMetric extends EntityBase {
  kind: "accuracy"|"groundedness"|"relevance"|"safety"|"latency"|"cost";
  threshold?: number;
}
interface EvaluationRun extends EntityBase {
  evaluationContractId: string;
  modelVersionId?: string;
  promptVersionId?: string;
  results: Record<string, number>; // metricId -> value
  passed: boolean;
}
interface SafetyControl extends EntityBase { controlType: string; }
interface HumanReviewGate extends EntityBase { requiredForStatuses: string[]; }
interface DeploymentGate extends EntityBase {
  gateName: string;
  passed: boolean;
  evidenceIds: string[]; // must be non-empty before passed may be true
  approvalIds: string[]; // must include >=1 Approval with decision "approved" before passed may be true
}
interface InferenceCostProfile extends EntityBase { modelVersionId: string; costPerMillionInputTokens: number; costPerMillionOutputTokens: number; }
interface TokenBudget extends EntityBase { periodStart: string; periodEnd: string; limitTokens: number; consumedTokens: number; }
interface MonitoringMetric extends EntityBase { metricName: string; value: number; capturedAt: string; }
interface Incident extends EntityBase { severity: "low"|"medium"|"high"|"critical"; resolvedAt?: string; }
interface RetirementPlan extends EntityBase { exitCriteria: string[]; dataRetentionPolicy: string; }
```

## 5. Governance entities

```ts
interface Risk extends EntityBase {
  category: string;
  aiRiskCategory?: string; // see SECURITY_AND_PRIVACY.md
  cause: string; event: string; consequence: string;
  likelihood: 1|2|3|4|5; impact: 1|2|3|4|5;
  exposure: number; proximity: string; velocity: string;
  treatment: string; residualRisk?: number;
  trigger?: string; contingency?: string;
  linkedTaskIds: string[];
  reviewDate: string;
}
interface Issue extends EntityBase { linkedRiskId?: string; }
interface Assumption extends EntityBase { validated?: boolean; }
interface DependencyItem extends EntityBase { blockedTaskId?: string; } // cross-team/external dependency, distinct from schedule Dependency
interface Decision extends EntityBase { decidedBy: string; decidedAt: string; }
interface ChangeRequest extends EntityBase { impact: string; approved?: boolean; }
interface Control extends EntityBase { policyMappingId?: string; }
interface Evidence extends EntityBase { uri?: string; }
interface Approval extends EntityBase { approverId: string; decision: "approved"|"rejected"|"conditional"; }
interface PolicyMapping extends EntityBase { policyName: string; }
interface AuditEvent { at: string; actor: string; action: string; details?: string; }
```

## 6. Referential integrity rules

- All `*Id` fields must reference an existing entity of the correct type;
  validated on write (see `src/validation/`).
- `WBSNode`/`Task.parentId` must not create a cycle; enforced by the
  scheduling engine and the persistence layer's write path.
- Deleting an entity referenced elsewhere is blocked unless the caller
  passes an explicit cascade/detach flag; the UI must surface referencing
  entities before allowing deletion.
- `Feature.committed = true` requires: `outcomeId`, non-empty
  `acceptanceCriteria`, non-empty `evaluationCriteria`, `ownerId`, and
  `releaseId` to all be present (Section 11 of source instructions).

## 7. Schema versioning

Every persisted document (project export, IndexedDB record) carries a
`schemaVersion: number`. Migrations are pure functions
`(doc: unknown, fromVersion: number) => unknown` chained forward one
version at a time and covered by migration unit tests (see
TEST_STRATEGY.md).
