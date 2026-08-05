/**
 * Generates the Enterprise RAG Assistant sample program (docs/PRD.md §15).
 * Run with: npx vite-node scripts/generateSampleData.ts
 *
 * Deterministic: no wall-clock randomness. The "today" status date is the
 * only external input, passed explicitly below, so re-running produces
 * identical output byte-for-byte given the same STATUS_DATE.
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type {
  Assignment,
  Baseline,
  Calendar,
  ConstraintType,
  Dependency,
  DependencyType,
  Project,
  Resource,
  Task,
} from "../src/domain";
import { computeSchedule } from "../src/calculations/schedule";
import { CalendarEngine, zonedWallTimeToUtc } from "../src/calculations/calendar";
import { exportProjectBundle } from "../src/import-export/jsonBundle";
import type {
  AgentDefinition,
  AIUseCase,
  DataQualityGate,
  Dataset,
  DeploymentGate,
  EvaluationContract,
  EvaluationMetric,
  EvaluationRun,
  HumanReviewGate,
  InferenceCostProfile,
  ModelCandidate,
  ModelVersion,
  MonitoringMetric,
  Incident,
  PromptVersion,
  RetirementPlan,
  RetrievalConfiguration,
  SafetyControl,
  ToolDefinition,
  TokenBudget,
} from "../src/domain/ai";
import type {
  AcceptanceCriterion,
  AdoptionMetric,
  Benefit,
  Epic,
  Experiment,
  Feature,
  Hypothesis,
  JobToBeDone,
  KPI,
  OKR,
  Opportunity,
  Outcome,
  Persona,
  ProblemStatement,
  ProductVision,
  Story,
} from "../src/domain/product";
import type {
  Approval,
  Assumption,
  ChangeRequest,
  Control,
  Decision,
  Evidence,
  Issue,
  PolicyMapping,
  Risk,
} from "../src/domain/governance";

const TZ = "America/New_York";
const STATUS_DATE = zonedWallTimeToUtc("2026-08-05", "09:00", TZ).toISOString();

function iso(dateStr: string, timeStr = "09:00"): string {
  return zonedWallTimeToUtc(dateStr, timeStr, TZ).toISOString();
}

function base(id: string, name: string, extra: Partial<{ status: string; createdAt: string; updatedAt: string }> = {}) {
  return {
    id,
    name,
    description: undefined,
    ownerId: undefined,
    status: extra.status ?? "active",
    createdAt: extra.createdAt ?? iso("2026-01-05"),
    updatedAt: extra.updatedAt ?? iso("2026-01-05"),
    version: 1,
    tags: [] as string[],
    auditTrail: [],
  };
}

// ---------------------------------------------------------------------------
// Calendars
// ---------------------------------------------------------------------------

const standardCalendar: Calendar = {
  id: "cal-standard",
  name: "Standard M-F 9-17 (America/New_York)",
  workingDays: { 0: false, 1: true, 2: true, 3: true, 4: true, 5: true, 6: false },
  workingHours: [{ start: "09:00", end: "17:00" }],
  exceptions: [
    { date: "2026-05-25", isWorking: false, label: "Memorial Day" },
    { date: "2026-07-03", isWorking: false, label: "Independence Day observed" },
  ],
  timeZone: TZ,
};

const partTimeCalendar: Calendar = {
  id: "cal-parttime",
  name: "Part-time Mon/Wed/Fri",
  baseCalendarId: "cal-standard",
  workingDays: { 0: false, 1: true, 2: false, 3: true, 4: false, 5: true, 6: false },
  workingHours: [{ start: "09:00", end: "17:00" }],
  exceptions: [],
  timeZone: TZ,
};

const calendars: Calendar[] = [standardCalendar, partTimeCalendar];

// ---------------------------------------------------------------------------
// Resources (16, across the required categories)
// ---------------------------------------------------------------------------

function makeResource(id: string, name: string, calendarId = "cal-standard", maxUnits = 1): Resource {
  return { ...base(id, name), calendarId, maxUnits, costRates: [] };
}

const resources: Resource[] = [
  makeResource("res-pm", "Priya Nair (Product Manager)"),
  makeResource("res-designer", "Sam Okafor (Product Designer)"),
  makeResource("res-dataeng", "Wei Zhang (Data Engineer)"),
  makeResource("res-datasci", "Lena Petrova (Data Scientist)"),
  makeResource("res-mleng", "Marco Rossi (ML Engineer)"),
  makeResource("res-prompteng", "Aisha Bello (Prompt Engineer)"),
  makeResource("res-aiarch", "David Kim (AI Architect)"),
  makeResource("res-backend1", "Jordan Lee (Backend Engineer)"),
  makeResource("res-backend2", "Fatima Haidari (Backend Engineer)"),
  makeResource("res-frontend", "Noah Fischer (Frontend Engineer)"),
  makeResource("res-secure", "Grace Adeyemi (Security Engineer)"),
  makeResource("res-privacy", "Tom Nguyen (Privacy Officer)"),
  makeResource("res-compliance", "Helena Wojcik (Compliance Lead)"),
  makeResource("res-change", "Carlos Mendes (Change Manager)"),
  makeResource("res-sre", "Yuki Tanaka (Site Reliability Engineer)"),
  makeResource("res-support", "Omar Haddad (Support Lead)", "cal-parttime", 0.5),
];

// ---------------------------------------------------------------------------
// Workstreams / WBS / tasks
// ---------------------------------------------------------------------------

interface WorkstreamSpec {
  code: string;
  name: string;
  taskNames: string[];
  resourcePool: string[];
}

const workstreams: WorkstreamSpec[] = [
  {
    code: "1",
    name: "Mobilization",
    resourcePool: ["res-pm", "res-change"],
    taskNames: [
      "Draft project charter",
      "Identify sponsor and steering committee",
      "Form core delivery team",
      "Procure cloud environment access",
      "Set up source control and CI",
      "Select delivery methodology",
      "Establish RAID log",
      "Run kickoff workshop",
      "Define communication plan",
      "Draft initial budget",
      "Set up collaboration tooling",
      "Onboard core team members",
    ],
  },
  {
    code: "2",
    name: "Strategy and Use-Case Qualification",
    resourcePool: ["res-pm", "res-datasci"],
    taskNames: [
      "Document business problem statement",
      "Conduct stakeholder interviews",
      "Draft value hypothesis",
      "Assess AI suitability",
      "Evaluate build vs buy vs partner",
      "Conduct feasibility study",
      "Classify initial risk level",
      "Define success metrics",
      "Draft use-case brief",
      "Review use-case with steering committee",
      "Approve use-case charter",
      "Publish use-case qualification summary",
    ],
  },
  {
    code: "3",
    name: "Product Discovery",
    resourcePool: ["res-designer", "res-pm"],
    taskNames: [
      "Recruit user research participants",
      "Conduct persona interviews",
      "Synthesize personas",
      "Map jobs-to-be-done",
      "Draft user journey map",
      "Identify opportunity backlog",
      "Build low-fidelity prototype",
      "Run desirability testing",
      "Draft outcome roadmap",
      "Define MVP scope",
      "Review MVP scope with stakeholders",
      "Finalize product backlog for MVP",
    ],
  },
  {
    code: "4",
    name: "Data and Knowledge Readiness",
    resourcePool: ["res-dataeng", "res-datasci"],
    taskNames: [
      "Inventory candidate data sources",
      "Confirm data ownership",
      "Assess data access and consent",
      "Profile source data quality",
      "Classify data sensitivity",
      "Document data lineage",
      "Design semantic model",
      "Design retrieval chunking strategy",
      "Build synthetic data plan",
      "Run data quality gate review",
      "Remediate data quality issues",
      "Sign off data readiness gate",
    ],
  },
  {
    code: "5",
    name: "Architecture, Security and Governance",
    resourcePool: ["res-aiarch", "res-secure", "res-privacy", "res-compliance"],
    taskNames: [
      "Draft solution architecture",
      "Conduct threat modeling workshop",
      "Complete privacy impact assessment",
      "Complete responsible-AI assessment",
      "Complete model risk assessment",
      "Design identity and authorization model",
      "Design data protection controls",
      "Conduct third-party vendor review",
      "Draft architecture decision records",
      "Review architecture with security board",
      "Remediate architecture findings",
      "Sign off architecture and governance gate",
    ],
  },
  {
    code: "6",
    name: "Model and AI Engineering",
    resourcePool: ["res-mleng", "res-prompteng", "res-aiarch"],
    taskNames: [
      "Establish baseline retrieval pipeline",
      "Evaluate candidate embedding models",
      "Select model provider",
      "Design prompt templates",
      "Implement RAG retrieval service",
      "Implement agent tool integrations",
      "Design safety guardrails",
      "Implement human review workflow",
      "Optimize token usage and latency",
      "Set up experiment tracking",
      "Tune retrieval relevance",
      "Freeze model and prompt versions for evaluation",
    ],
  },
  {
    code: "7",
    name: "Application and Integration Engineering",
    resourcePool: ["res-backend1", "res-backend2", "res-frontend"],
    taskNames: [
      "Design conversational UX",
      "Build chat interface",
      "Build API gateway integration",
      "Integrate with knowledge base search",
      "Integrate with ticketing workflow",
      "Implement observability instrumentation",
      "Implement error handling and fallbacks",
      "Conduct accessibility review",
      "Conduct performance tuning",
      "Conduct integration testing",
      "Fix integration defects",
      "Sign off application readiness",
    ],
  },
  {
    code: "8",
    name: "Evaluation and Assurance",
    resourcePool: ["res-datasci", "res-secure", "res-mleng"],
    taskNames: [
      "Draft evaluation contract",
      "Build golden test set",
      "Build boundary test cases",
      "Build adversarial test cases",
      "Run model quality evaluation",
      "Run retrieval evaluation",
      "Run agent trajectory evaluation",
      "Run security penetration test",
      "Run bias and fairness review",
      "Conduct human acceptance review",
      "Remediate evaluation findings",
      "Sign off release gate",
    ],
  },
  {
    code: "9",
    name: "Pilot and Rollout",
    resourcePool: ["res-change", "res-support", "res-pm"],
    taskNames: [
      "Select pilot cohort",
      "Run shadow mode evaluation",
      "Prepare training materials",
      "Train pilot support staff",
      "Launch pilot cohort",
      "Collect pilot feedback",
      "Remediate pilot findings",
      "Prepare canary rollout plan",
      "Launch canary deployment",
      "Monitor canary metrics",
      "Conduct go/no-go review",
      "Launch production rollout",
    ],
  },
  {
    code: "10",
    name: "Production Operations",
    resourcePool: ["res-sre", "res-support"],
    taskNames: [
      "Define SLOs",
      "Set up production monitoring",
      "Set up quality drift detection",
      "Set up data drift detection",
      "Set up model drift detection",
      "Set up token and cost monitoring",
      "Establish incident response runbook",
      "Establish change control process",
      "Run first continual evaluation cycle",
      "Conduct benefit realization review",
      "Conduct post-implementation review",
      "Publish operations handover report",
    ],
  },
];

const PROJECT_ID = "proj-rag";
const projectStartDate = "2026-02-02"; // Monday

const tasks: Task[] = [];
const dependencies: Dependency[] = [];
const assignments: Assignment[] = [];

function makeTaskShell(
  id: string,
  parentId: string | null,
  wbsCode: string,
  sequence: number,
  name: string,
  opts: { isSummary?: boolean; isMilestone?: boolean; durationMinutes?: number; constraintType?: ConstraintType; calendarId?: string } = {},
): Task {
  const durationMinutes = opts.isMilestone ? 0 : opts.durationMinutes ?? 960; // default 2 working days
  return {
    id,
    projectId: PROJECT_ID,
    parentId,
    wbsCode,
    sequence,
    name,
    schedulingMode: "auto",
    isSummary: opts.isSummary ?? false,
    isMilestone: opts.isMilestone ?? false,
    start: iso(projectStartDate),
    finish: iso(projectStartDate),
    durationMinutes,
    workMinutes: durationMinutes,
    remainingWorkMinutes: durationMinutes,
    percentComplete: 0,
    constraintType: opts.constraintType ?? "ASAP",
    calendarId: opts.calendarId ?? "cal-standard",
    priority: 500,
    fixedCost: 0,
    costAccrual: "prorated",
    status: "not-started",
    tags: [],
  };
}

let depSeq = 1;
function addDependency(predecessorTaskId: string, successorTaskId: string, type: DependencyType, lagMinutes = 0) {
  dependencies.push({ id: `dep-${depSeq++}`, predecessorTaskId, successorTaskId, type, lagMinutes });
}

let assignmentSeq = 1;
function addAssignment(taskId: string, resourceId: string, units: number, plannedWorkMinutes: number) {
  assignments.push({
    id: `asg-${assignmentSeq++}`,
    taskId,
    resourceId,
    units,
    plannedWorkMinutes,
    actualWorkMinutes: 0,
    remainingWorkMinutes: plannedWorkMinutes,
  });
}

const gateStartMilestoneIds: string[] = [];
const gateEndMilestoneIds: string[] = [];
const allLeafTaskIdsByWorkstream: string[][] = [];

workstreams.forEach((ws, wsIndex) => {
  const summaryId = `ws-${ws.code}`;
  tasks.push(makeTaskShell(summaryId, null, ws.code, wsIndex + 1, ws.name, { isSummary: true }));

  const startMilestoneId = `ms-${ws.code}-start`;
  tasks.push(
    makeTaskShell(startMilestoneId, summaryId, `${ws.code}.0`, 0, `${ws.name}: phase entry`, { isMilestone: true }),
  );
  gateStartMilestoneIds.push(startMilestoneId);

  const leafIds: string[] = [];
  ws.taskNames.forEach((name, i) => {
    const id = `task-${ws.code}-${i + 1}`;
    const durationMinutes = 480 + (i % 3) * 240; // 1 to 2.5 working days, varied
    tasks.push(makeTaskShell(id, summaryId, `${ws.code}.${i + 1}`, i + 1, name, { durationMinutes }));
    leafIds.push(id);
  });
  allLeafTaskIdsByWorkstream.push(leafIds);

  const endMilestoneId = `ms-${ws.code}-end`;
  tasks.push(
    makeTaskShell(endMilestoneId, summaryId, `${ws.code}.${ws.taskNames.length + 1}`, ws.taskNames.length + 1, `${ws.name}: gate sign-off`, {
      isMilestone: true,
    }),
  );
  gateEndMilestoneIds.push(endMilestoneId);

  // Chain: start milestone -> task 1 -> task 2 -> ... -> end milestone (mostly FS).
  addDependency(startMilestoneId, leafIds[0], "FS");
  for (let i = 0; i < leafIds.length - 1; i++) {
    addDependency(leafIds[i], leafIds[i + 1], "FS");
  }
  addDependency(leafIds[leafIds.length - 1], endMilestoneId, "FS");

  // Assign resources round-robin across the workstream's pool.
  leafIds.forEach((taskId, i) => {
    const resourceId = ws.resourcePool[i % ws.resourcePool.length];
    const task = tasks.find((t) => t.id === taskId)!;
    addAssignment(taskId, resourceId, 0.8, task.durationMinutes);
  });
});

// Introduce genuine parallelism (a fork/join) in WS7 so the schedule has
// both critical and non-critical (positive-float) tasks, not one single
// serial chain end to end: "accessibility review" and "performance tuning"
// both depend on "error handling" and both feed "integration testing",
// instead of running strictly one after the other.
{
  const forkFrom = "task-7-7"; // Implement error handling and fallbacks
  const branchA = "task-7-8"; // Conduct accessibility review
  const branchB = "task-7-9"; // Conduct performance tuning
  const joinTo = "task-7-10"; // Conduct integration testing
  const serialIndex = dependencies.findIndex((d) => d.predecessorTaskId === branchA && d.successorTaskId === branchB);
  if (serialIndex === -1) throw new Error("expected serial edge between WS7 accessibility/performance tasks not found");
  dependencies.splice(serialIndex, 1);
  addDependency(forkFrom, branchB, "FS");
  addDependency(branchA, joinTo, "FS");
}

// Cross-workstream sequencing: each phase's exit gate drives the next phase's entry.
for (let i = 0; i < workstreams.length - 1; i++) {
  addDependency(gateEndMilestoneIds[i], gateStartMilestoneIds[i + 1], "FS");
}

// --- Dependency-type and lag variety (Section 17 fixture coverage) -------

// SS with positive lag: security work (WS5 task6) starts 1 day after data
// protection design work (WS5 task 5's predecessor chain already FS); add an
// explicit SS example instead between two independent WS6 tasks.
addDependency("task-6-5", "task-6-6", "SS", 480); // RAG retrieval service -> agent tool integrations, starts 1 day later

// FF: "Freeze model and prompt versions" finishes together with evaluation
// contract drafting kickoff in the next phase (illustrative FF across a
// short lag).
addDependency("task-6-12", "task-8-1", "FF", 0);

// SF (uncommon but supported): the evaluation sign-off task cannot finish
// before the evaluation contract drafting task has started (forward-ordered,
// so it layers on top of the existing FS chain without creating a cycle).
addDependency("task-8-1", "task-8-9", "SF", 0);

// Negative lag (lead): discovery prototype testing overlaps with the prior
// task by half a day instead of waiting for it to fully finish.
addDependency("task-3-7", "task-3-8", "FS", -240);

// Positive lag: legal/compliance review wait time before architecture sign-off.
addDependency("task-5-10", "task-5-11", "FS", 2880);

// Deliberate resource over-allocation: the AI Architect is double-booked
// across two overlapping Data-Scientist-adjacent tasks in Product Discovery
// (which overlap in time due to the lead above).
addAssignment("task-3-7", "res-aiarch", 0.7, 480);
addAssignment("task-3-8", "res-aiarch", 0.7, 480);

// ---------------------------------------------------------------------------
// Pass 1: compute the original plan, capture it as the baseline.
// ---------------------------------------------------------------------------

const pass1 = computeSchedule({ tasks, dependencies, calendars });
if (pass1.errors.length > 0) {
  throw new Error(`sample data generation failed: scheduling errors in pass 1: ${JSON.stringify(pass1.errors)}`);
}

const baselineSnapshot: Baseline["taskSnapshots"] = {};
for (const t of pass1.tasks) {
  baselineSnapshot[t.id] = { start: t.start, finish: t.finish, durationMinutes: t.durationMinutes, workMinutes: t.workMinutes, fixedCost: t.fixedCost };
}
const baseline: Baseline = {
  id: "baseline-1",
  name: "Original approved plan",
  projectId: PROJECT_ID,
  capturedAt: iso("2026-02-09"),
  taskSnapshots: baselineSnapshot,
  status: "active",
  createdAt: iso("2026-02-09"),
  updatedAt: iso("2026-02-09"),
  version: 1,
  tags: [],
};

// ---------------------------------------------------------------------------
// Pass 2: simulate a real-world slip on "Tune retrieval relevance" (+2 days),
// then recompute — this is the "current" schedule, which will differ from
// the baseline for this task and everything downstream of it.
// ---------------------------------------------------------------------------

// Pick a task whose original-plan span straddles STATUS_DATE, so it reliably
// ends up "in progress" (and, being the delayed one, "blocked") below —
// rather than hardcoding a task id and hoping the computed schedule happens
// to land it near "today".
const statusDateMs = new Date(STATUS_DATE).getTime();
const straddlingTask = pass1.tasks.find(
  (t) => !t.isSummary && !t.isMilestone && new Date(t.start).getTime() <= statusDateMs && statusDateMs < new Date(t.finish).getTime(),
);
if (!straddlingTask) {
  throw new Error("sample data generation failed: no task straddles STATUS_DATE — adjust STATUS_DATE or task durations");
}
const DELAYED_TASK_ID = straddlingTask.id;
const tasksWithSlip = pass1.tasks.map((t) => (t.id === DELAYED_TASK_ID ? { ...t, durationMinutes: t.durationMinutes + 960, workMinutes: t.workMinutes + 960, remainingWorkMinutes: t.remainingWorkMinutes + 960 } : t));

const pass2 = computeSchedule({ tasks: tasksWithSlip, dependencies, calendars, statusDate: STATUS_DATE });
if (pass2.errors.length > 0) {
  throw new Error(`sample data generation failed: scheduling errors in pass 2: ${JSON.stringify(pass2.errors)}`);
}

// ---------------------------------------------------------------------------
// Apply progress (completed / in-progress / delayed / not-started) based on
// where each task's computed span falls relative to STATUS_DATE.
// ---------------------------------------------------------------------------

const engine = new CalendarEngine(calendars);
const statusDateInstant = new Date(STATUS_DATE);

const finalTasks: Task[] = pass2.tasks.map((t) => {
  const start = new Date(t.start);
  const finish = new Date(t.finish);
  const baselineEntry = baselineSnapshot[t.id];
  const withBaseline = baselineEntry
    ? { baselineStart: baselineEntry.start, baselineFinish: baselineEntry.finish, baselineDurationMinutes: baselineEntry.durationMinutes, baselineWorkMinutes: baselineEntry.workMinutes, baselineCost: baselineEntry.fixedCost }
    : {};

  if (t.isSummary) return { ...t, ...withBaseline };

  if (finish.getTime() <= statusDateInstant.getTime()) {
    return {
      ...t,
      ...withBaseline,
      status: "complete",
      percentComplete: 100,
      actualStart: t.start,
      actualFinish: t.finish,
      actualWorkMinutes: t.workMinutes,
      remainingWorkMinutes: 0,
    };
  }

  if (!t.isMilestone && start.getTime() <= statusDateInstant.getTime() && statusDateInstant.getTime() < finish.getTime()) {
    const elapsed = Math.max(0, engine.workingMinutesBetween(start, statusDateInstant, t.calendarId));
    const naivePercent = Math.min(95, Math.round((elapsed / t.workMinutes) * 100));
    const isDelayedExample = t.id === DELAYED_TASK_ID;
    const percentComplete = isDelayedExample ? Math.max(5, naivePercent - 25) : naivePercent;
    const actualWorkMinutes = Math.round((percentComplete / 100) * t.workMinutes);
    return {
      ...t,
      ...withBaseline,
      status: isDelayedExample ? "blocked" : "in-progress",
      percentComplete,
      actualStart: t.start,
      actualWorkMinutes,
      remainingWorkMinutes: t.workMinutes - actualWorkMinutes,
      tags: isDelayedExample ? ["at-risk"] : t.tags,
    };
  }

  return { ...t, ...withBaseline };
});

const finalTasksById = new Map(finalTasks.map((t) => [t.id, t]));
const project: Project = {
  ...base(PROJECT_ID, "Enterprise Retrieval-Augmented Generation Assistant for Engineering Knowledge"),
  charter: {
    objectives: [
      "Reduce time-to-answer for engineering knowledge queries by 50%",
      "Achieve >=90% groundedness on the evaluation golden set before production rollout",
    ],
    successCriteria: ["Pilot cohort adoption >= 70% weekly active", "Cost per accepted answer within FinOps budget"],
    scopeIncluded: ["RAG assistant for internal engineering documentation", "Slack and ticketing integration"],
    scopeExcluded: ["Customer-facing deployment", "Non-English language support"],
    stakeholders: [
      { name: "VP Engineering", role: "Sponsor", raciRole: "A" },
      { name: "Priya Nair", role: "Product Manager", raciRole: "R" },
      { name: "Helena Wojcik", role: "Compliance Lead", raciRole: "C" },
    ],
  },
  calendarId: "cal-standard",
  statusDate: STATUS_DATE,
  workstreamIds: workstreams.map((w) => `ws-${w.code}`),
};

// ---------------------------------------------------------------------------
// Product-management entities
// ---------------------------------------------------------------------------

const productVision: ProductVision = { ...base("vision-1", "AI-native engineering knowledge assistant"), northStarMetric: "Weekly active engineers using assisted answers" };
const personas: Persona[] = [
  { ...base("persona-eng", "Staff Software Engineer"), segment: "Internal engineering" },
  { ...base("persona-sre", "Site Reliability Engineer"), segment: "Internal operations" },
];
const jtbds: JobToBeDone[] = [
  { ...base("jtbd-1", "Find the right internal doc without asking a colleague"), personaId: "persona-eng" },
  { ...base("jtbd-2", "Resolve an incident using verified runbook steps"), personaId: "persona-sre" },
];
const problemStatements: ProblemStatement[] = [
  { ...base("problem-1", "Engineers spend ~4 hours/week searching scattered documentation"), personaId: "persona-eng" },
];
const opportunities: Opportunity[] = [
  { ...base("opp-1", "Surface grounded answers directly in Slack"), problemStatementId: "problem-1", evidenceLinks: ["interview-notes-2026-02"] },
  { ...base("opp-2", "Reduce incident MTTR via runbook retrieval"), problemStatementId: "problem-1", evidenceLinks: ["incident-retro-2026-01"] },
];
const outcomes: Outcome[] = [
  { ...base("outcome-1", "Reduce median time-to-answer"), metricName: "median_time_to_answer_minutes", baseline: 25, target: 10 },
  { ...base("outcome-2", "Increase weekly active assisted users"), metricName: "weekly_active_users", baseline: 0, target: 400 },
];
const okr: OKR = {
  ...base("okr-1", "Ship a trusted engineering knowledge assistant by Q4"),
  objective: "Engineers trust and regularly use the RAG assistant for knowledge retrieval",
  keyResults: [
    { text: "Reach 400 weekly active users", target: 400, current: 0 },
    { text: "Sustain groundedness >= 0.9 in production", target: 0.9, current: 0 },
  ],
};
const kpis: KPI[] = [
  { ...base("kpi-1", "Cost per accepted answer"), formula: "total_inference_cost / accepted_outcomes" },
  { ...base("kpi-2", "Groundedness score"), formula: "avg(evaluation_run.results.groundedness)" },
];
const hypotheses: Hypothesis[] = [
  { ...base("hyp-1", "Grounded RAG answers reduce Slack-question volume by 30%"), statement: "If we surface grounded answers in Slack, question volume to #eng-help drops 30%", evidenceLinks: [] },
];
const epics: Epic[] = [
  { ...base("epic-search", "Grounded knowledge search"), outcomeId: "outcome-1" },
  { ...base("epic-slack", "Slack integration"), outcomeId: "outcome-2" },
  { ...base("epic-ops", "Operational readiness"), outcomeId: "outcome-2" },
];
const features: Feature[] = [
  {
    ...base("feat-retrieval", "Grounded document retrieval"),
    epicId: "epic-search",
    outcomeId: "outcome-1",
    acceptanceCriteria: ["Returns >=3 relevant grounded sources for 90% of golden-set queries"],
    dataDependencies: ["dataset-docs"],
    modelDependencies: ["modelversion-2"],
    evaluationCriteria: ["Groundedness >= 0.9", "Relevance >= 0.85"],
    ownerId: "res-aiarch",
    releaseId: "release-pilot",
    committed: true,
  },
  {
    ...base("feat-slack", "Slack chat interface"),
    epicId: "epic-slack",
    outcomeId: "outcome-2",
    acceptanceCriteria: ["Responds within 3s p95 latency"],
    dataDependencies: [],
    modelDependencies: ["modelversion-2"],
    evaluationCriteria: ["Latency p95 < 3000ms"],
    ownerId: "res-frontend",
    releaseId: "release-pilot",
    committed: true,
  },
  {
    ...base("feat-agent-tools", "Ticketing agent tool integration"),
    epicId: "epic-search",
    outcomeId: "outcome-1",
    acceptanceCriteria: ["Agent can open a ticket with correct fields for 95% of test cases"],
    dataDependencies: [],
    modelDependencies: ["modelversion-2"],
    evaluationCriteria: ["Agent trajectory success >= 0.9"],
    ownerId: "res-mleng",
    releaseId: "release-canary",
    committed: true,
  },
  {
    ...base("feat-monitoring", "Production quality/cost monitoring dashboard"),
    epicId: "epic-ops",
    outcomeId: "outcome-2",
    acceptanceCriteria: ["Dashboard shows groundedness, cost-per-outcome, and drift signals"],
    dataDependencies: [],
    modelDependencies: [],
    evaluationCriteria: ["Dashboard reviewed and accepted by SRE lead"],
    ownerId: "res-sre",
    releaseId: "release-production",
    committed: true,
  },
  {
    ...base("feat-multilang", "Multi-language support"),
    epicId: "epic-search",
    outcomeId: "outcome-1",
    acceptanceCriteria: [],
    dataDependencies: [],
    modelDependencies: [],
    evaluationCriteria: [],
    ownerId: "res-pm",
    committed: false, // deliberately a draft: missing release/evaluation criteria, must stay uncommitted
  },
];
const stories: Story[] = [
  { ...base("story-1", "As an engineer I can ask a question in Slack and get a grounded answer"), featureId: "feat-slack" },
  { ...base("story-2", "As an engineer I can see citations for a retrieved answer"), featureId: "feat-retrieval" },
  { ...base("story-3", "As an SRE I can open a ticket from the assistant"), featureId: "feat-agent-tools" },
];
const experiments: Experiment[] = [
  { ...base("exp-1", "A/B test grounded vs ungrounded answers on Slack question deflection"), hypothesisId: "hyp-1", result: "Grounded answers reduced follow-up questions by 34%" },
];
const acceptanceCriteria: AcceptanceCriterion[] = [
  { ...base("ac-1", "Golden-set groundedness >= 0.9"), featureId: "feat-retrieval", met: false },
  { ...base("ac-2", "Slack p95 latency < 3000ms"), featureId: "feat-slack", met: false },
];
const benefits: Benefit[] = [
  { ...base("benefit-1", "Reduced time-to-answer"), outcomeId: "outcome-1" },
  { ...base("benefit-2", "Reduced Slack question volume"), outcomeId: "outcome-2" },
];
const adoptionMetrics: AdoptionMetric[] = [
  { ...base("adopt-1", "Weekly active users"), metricName: "weekly_active_users", value: 0, capturedAt: STATUS_DATE },
];

// ---------------------------------------------------------------------------
// AI-specific entities
// ---------------------------------------------------------------------------

const aiUseCase: AIUseCase = { ...base("usecase-1", "Engineering knowledge RAG assistant"), isAISuitable: true, buildBuyPartner: "build", riskClassification: "medium" };
const datasets: Dataset[] = [
  { ...base("dataset-docs", "Internal engineering documentation corpus"), source: "Confluence + GitHub wikis", classification: "internal-confidential" },
  { ...base("dataset-tickets", "Historical support ticket corpus"), source: "Ticketing system export", classification: "internal-confidential" },
];
const dataQualityGate: DataQualityGate = { ...base("dqg-1", "Documentation corpus quality gate"), datasetId: "dataset-docs", passed: true, criteria: ["Deduplicated", "PII-scrubbed", "Freshness < 90 days"] };
const modelCandidates: ModelCandidate[] = [
  { ...base("modelcand-1", "Provider A frontier model"), provider: "provider-a", family: "frontier" },
  { ...base("modelcand-2", "Provider A efficient model"), provider: "provider-a", family: "efficient" },
];
const modelVersions: ModelVersion[] = [
  { ...base("modelversion-1", "Provider A frontier v1 (retired)", { status: "retired" }), modelCandidateId: "modelcand-1", versionTag: "v1" },
  { ...base("modelversion-2", "Provider A frontier v2 (current)"), modelCandidateId: "modelcand-1", versionTag: "v2" },
];
const promptVersions: PromptVersion[] = [
  { ...base("promptversion-1", "Retrieval-grounded answer prompt v1", { status: "retired" }), versionTag: "v1", templateHash: "sha256-aaa111" },
  { ...base("promptversion-2", "Retrieval-grounded answer prompt v2"), versionTag: "v2", templateHash: "sha256-bbb222" },
];
const retrievalConfig: RetrievalConfiguration = { ...base("retrieval-1", "Production retrieval configuration"), indexType: "hybrid-dense-sparse", chunkStrategy: "semantic-512-token" };
const agentDefinition: AgentDefinition = { ...base("agent-1", "Ticketing assistant agent"), toolIds: ["tool-1", "tool-2"], maxSteps: 6 };
const toolDefinitions: ToolDefinition[] = [
  { ...base("tool-1", "search_documentation"), schema: "{ query: string }" },
  { ...base("tool-2", "create_ticket"), schema: "{ title: string; description: string; priority: string }" },
];
const evaluationMetrics: EvaluationMetric[] = [
  { ...base("metric-accuracy", "Accuracy"), kind: "accuracy", threshold: 0.85 },
  { ...base("metric-groundedness", "Groundedness"), kind: "groundedness", threshold: 0.9 },
  { ...base("metric-relevance", "Relevance"), kind: "relevance", threshold: 0.85 },
  { ...base("metric-safety", "Safety"), kind: "safety", threshold: 0.98 },
  { ...base("metric-latency", "Latency (ms, lower is better)"), kind: "latency", threshold: 3000 },
  { ...base("metric-cost", "Cost per accepted outcome (USD)"), kind: "cost", threshold: 0.5 },
];
const evaluationContract: EvaluationContract = {
  ...base("evalcontract-1", "Production readiness evaluation contract"),
  metricIds: evaluationMetrics.map((m) => m.id),
  gateId: "gate-release",
  goldenSetRef: "golden-set-v3-2026-07",
};
const evaluationRuns: EvaluationRun[] = [
  {
    ...base("evalrun-1", "Nightly eval — retired v1 model (historical)"),
    evaluationContractId: "evalcontract-1",
    modelVersionId: "modelversion-1",
    promptVersionId: "promptversion-1",
    results: { "metric-accuracy": 0.81, "metric-groundedness": 0.83, "metric-relevance": 0.8, "metric-safety": 0.97, "metric-latency": 3400, "metric-cost": 0.62 },
    passed: false,
  },
  {
    ...base("evalrun-2", "Release-candidate eval — current v2 model"),
    evaluationContractId: "evalcontract-1",
    modelVersionId: "modelversion-2",
    promptVersionId: "promptversion-2",
    results: { "metric-accuracy": 0.91, "metric-groundedness": 0.93, "metric-relevance": 0.88, "metric-safety": 0.99, "metric-latency": 2100 },
    // NOTE: metric-cost deliberately omitted to exercise missingMetricWarnings — never fabricate it.
    passed: true,
  },
];
const safetyControls: SafetyControl[] = [
  { ...base("safety-1", "Prompt-injection guardrail"), controlType: "input-filtering" },
  { ...base("safety-2", "PII redaction on output"), controlType: "output-filtering" },
];
const humanReviewGate: HumanReviewGate = { ...base("humanreview-1", "High-risk ticket action review"), requiredForStatuses: ["blocked", "escalated"] };
const inferenceCostProfile: InferenceCostProfile = { ...base("costprofile-1", "Provider A frontier v2 pricing"), modelVersionId: "modelversion-2", costPerMillionInputTokens: 3, costPerMillionOutputTokens: 15 };
const tokenBudget: TokenBudget = { ...base("tokenbudget-1", "Pilot-phase monthly token budget"), periodStart: iso("2026-08-01"), periodEnd: iso("2026-08-31"), limitTokens: 50_000_000, consumedTokens: 41_500_000 };
const monitoringMetrics: MonitoringMetric[] = [
  { ...base("monitor-1", "Groundedness (rolling 7-day avg)"), metricName: "groundedness_7d_avg", value: 0.92, capturedAt: STATUS_DATE },
  { ...base("monitor-2", "Cost per accepted outcome (rolling 7-day avg)"), metricName: "cost_per_outcome_7d_avg", value: 0.41, capturedAt: STATUS_DATE },
];
const incidents: Incident[] = [{ ...base("incident-1", "Elevated hallucination rate after prompt v2 rollout"), severity: "medium", resolvedAt: iso("2026-08-02") }];
const retirementPlan: RetirementPlan = { ...base("retire-1", "Assistant retirement plan (future)", { status: "planned" }), exitCriteria: ["Successor platform reaches feature parity"], dataRetentionPolicy: "Retain interaction logs 12 months, then delete" };

// ---------------------------------------------------------------------------
// Governance entities
// ---------------------------------------------------------------------------

const risks: Risk[] = [
  { ...base("risk-hallucination", "Model produces unsupported/hallucinated citations"), category: "AI quality", aiRiskCategory: "Hallucination or unsupported output", cause: "insufficient retrieval grounding", event: "model cites nonexistent source", consequence: "user distrust, incorrect action taken", likelihood: 3, impact: 4, exposure: 12, proximity: "near-term", velocity: "fast", treatment: "Groundedness evaluation gate + citation verification", linkedTaskIds: ["task-8-5"], reviewDate: iso("2026-09-01") },
  { ...base("risk-injection", "Prompt injection via retrieved documents"), category: "Security", aiRiskCategory: "Prompt injection", cause: "untrusted content in retrieval context", event: "injected instruction alters agent behavior", consequence: "unsafe tool invocation", likelihood: 3, impact: 5, exposure: 15, proximity: "near-term", velocity: "fast", treatment: "Input filtering guardrail + human review gate for high-risk actions", linkedTaskIds: ["task-8-8"], reviewDate: iso("2026-09-01") },
  { ...base("risk-privacy", "Sensitive data leakage via retrieval"), category: "Privacy", aiRiskCategory: "Data leakage", cause: "insufficiently classified source documents", event: "confidential doc surfaced to unauthorized user", consequence: "compliance breach", likelihood: 2, impact: 5, exposure: 10, proximity: "medium-term", velocity: "moderate", treatment: "Document classification + access-aware retrieval", linkedTaskIds: ["task-4-5"], reviewDate: iso("2026-09-01") },
  { ...base("risk-cost", "AI inference cost escalation beyond budget"), category: "FinOps", aiRiskCategory: "Cost escalation", cause: "unbounded agent tool-call loops", event: "token consumption exceeds budget", consequence: "unplanned cloud spend", likelihood: 3, impact: 3, exposure: 9, proximity: "near-term", velocity: "moderate", treatment: "Token budget alerting + max agent step limit", linkedTaskIds: ["task-6-9"], reviewDate: iso("2026-09-01") },
  { ...base("risk-vendor", "Model provider dependency / deprecation"), category: "Technical", aiRiskCategory: "Model or vendor dependency", cause: "single-provider architecture", event: "provider deprecates selected model", consequence: "forced re-evaluation and re-integration", likelihood: 2, impact: 3, exposure: 6, proximity: "long-term", velocity: "slow", treatment: "Abstraction layer over model provider API", linkedTaskIds: ["task-6-3"], reviewDate: iso("2026-11-01") },
  { ...base("risk-bias", "Retrieval bias toward better-documented teams"), category: "AI quality", aiRiskCategory: "Bias or unfairness", cause: "uneven documentation coverage across teams", event: "assistant under-serves teams with sparse docs", consequence: "inequitable adoption", likelihood: 3, impact: 2, exposure: 6, proximity: "medium-term", velocity: "slow", treatment: "Coverage audit during data readiness gate", linkedTaskIds: ["task-4-4"], reviewDate: iso("2026-09-15") },
  { ...base("risk-drift", "Undetected quality drift after model update"), category: "Operations", aiRiskCategory: "Drift", cause: "no continual evaluation in production", event: "quality regresses silently after a provider-side model update", consequence: "degraded user trust before detection", likelihood: 3, impact: 3, exposure: 9, proximity: "long-term", velocity: "slow", treatment: "", linkedTaskIds: ["task-10-9"], reviewDate: iso("2026-10-01") }, // deliberately no treatment yet — exercises riskBlocksMilestoneCompletion
  { ...base("risk-adoption", "Low pilot adoption undermines business case"), category: "Product", cause: "insufficient change management", event: "pilot cohort does not adopt the assistant", consequence: "benefit case not realized", likelihood: 2, impact: 3, exposure: 6, proximity: "near-term", velocity: "moderate", treatment: "Dedicated change manager + training plan", linkedTaskIds: ["task-9-3"], reviewDate: iso("2026-09-01") },
];
const issues: Issue[] = [
  { ...base("issue-1", "Documentation corpus export API rate-limited, slowing ingestion") },
  { ...base("issue-2", "Shared staging environment contention with another team") },
];
const assumptions: Assumption[] = [
  { ...base("assumption-1", "Provider A will maintain current pricing through the pilot"), validated: false },
  { ...base("assumption-2", "Engineering documentation is the primary knowledge source engineers need"), validated: true },
];
const decisions: Decision[] = [
  { ...base("decision-1", "Build (not buy) the retrieval layer for data-residency control"), decidedBy: "VP Engineering", decidedAt: iso("2026-02-16") },
  { ...base("decision-2", "Use hybrid dense+sparse retrieval over pure dense embeddings"), decidedBy: "David Kim (AI Architect)", decidedAt: iso("2026-04-20") },
];
const changeRequests: ChangeRequest[] = [
  { ...base("change-1", "Add ticketing agent tool to MVP scope"), impact: "Adds ~2 weeks to Model & AI Engineering workstream", approved: true },
];
const policyMapping: PolicyMapping = { ...base("policy-1", "Maps to internal Responsible AI Policy v2"), policyName: "Responsible AI Policy v2" };
const control: Control = { ...base("control-1", "Human review required for high-risk agent actions"), policyMappingId: "policy-1" };
const evidence: Evidence[] = [
  { ...base("evidence-1", "Architecture review sign-off minutes"), uri: "docs://architecture-review-2026-05-14" },
  { ...base("evidence-2", "Evaluation scorecard — release candidate"), uri: "docs://eval-scorecard-2026-07-28" },
  { ...base("evidence-3", "Pilot readiness checklist"), uri: "docs://pilot-readiness-2026-06-10" },
];
const approvals: Approval[] = [
  { ...base("approval-1", "Architecture & governance gate approval"), approverId: "res-secure", decision: "approved" },
  { ...base("approval-2", "Release gate approval"), approverId: "res-datasci", decision: "approved" },
  { ...base("approval-3", "Production readiness gate approval (pending)"), approverId: "res-sre", decision: "conditional" },
];
const deploymentGates: DeploymentGate[] = [
  { ...base("gate-architecture", "Architecture and governance gate"), gateName: "Architecture and governance gate", passed: true, evidenceIds: ["evidence-1"], approvalIds: ["approval-1"] },
  { ...base("gate-release", "Release gate"), gateName: "Release gate", passed: true, evidenceIds: ["evidence-2"], approvalIds: ["approval-2"] },
  { ...base("gate-production", "Production readiness gate"), gateName: "Production readiness gate", passed: false, evidenceIds: ["evidence-3"], approvalIds: ["approval-3"] }, // deliberately not yet passable: no *approved* decision
];

// ---------------------------------------------------------------------------
// Write output files
// ---------------------------------------------------------------------------

const sampleDataDir = resolve(__dirname, "..", "sample-data");

const projectBundleJson = exportProjectBundle({
  project,
  tasks: [...finalTasksById.values()],
  dependencies,
  calendars,
  resources,
  assignments,
  baselines: [baseline],
});
writeFileSync(resolve(sampleDataDir, "enterprise-rag-program.json"), projectBundleJson + "\n");

const aiProductRoadmap = {
  schemaVersion: 1,
  exportedAt: STATUS_DATE,
  product: {
    productVision,
    personas,
    jobsToBeDone: jtbds,
    problemStatements,
    opportunities,
    outcomes,
    okrs: [okr],
    kpis,
    hypotheses,
    epics,
    features,
    stories,
    experiments,
    acceptanceCriteria,
    benefits,
    adoptionMetrics,
  },
  ai: {
    aiUseCase,
    datasets,
    dataQualityGates: [dataQualityGate],
    modelCandidates,
    modelVersions,
    promptVersions,
    retrievalConfigurations: [retrievalConfig],
    agentDefinitions: [agentDefinition],
    toolDefinitions,
    evaluationMetrics,
    evaluationContracts: [evaluationContract],
    evaluationRuns,
    safetyControls,
    humanReviewGates: [humanReviewGate],
    deploymentGates,
    inferenceCostProfiles: [inferenceCostProfile],
    tokenBudgets: [tokenBudget],
    monitoringMetrics,
    incidents,
    retirementPlans: [retirementPlan],
  },
  governance: {
    risks,
    issues,
    assumptions,
    decisions,
    changeRequests,
    policyMappings: [policyMapping],
    controls: [control],
    evidence,
    approvals,
  },
};
writeFileSync(resolve(sampleDataDir, "ai-product-roadmap.json"), JSON.stringify(aiProductRoadmap, null, 2) + "\n");

const resourceCalendarFile = { schemaVersion: 1, exportedAt: STATUS_DATE, calendars, resources };
writeFileSync(resolve(sampleDataDir, "resource-calendar.json"), JSON.stringify(resourceCalendarFile, null, 2) + "\n");

// eslint-disable-next-line no-console
console.log(
  `Generated ${finalTasksById.size} tasks (${[...finalTasksById.values()].filter((t) => t.isMilestone).length} milestones), ` +
    `${dependencies.length} dependencies, ${resources.length} resources, ${assignments.length} assignments.`,
);
