export type DependencyType = "FS" | "SS" | "FF" | "SF";
export type SchedulingMode = "auto" | "manual";
export type ConstraintType =
  | "ASAP"
  | "ALAP"
  | "SNET"
  | "SNLT"
  | "FNET"
  | "FNLT"
  | "MSO"
  | "MFO";

export type TaskStatus =
  | "not-started"
  | "in-progress"
  | "blocked"
  | "complete"
  | "cancelled";

export interface Task {
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

  start: string;
  finish: string;
  durationMinutes: number;
  workMinutes: number;
  remainingWorkMinutes: number;

  percentComplete: number;
  physicalPercentComplete?: number;

  constraintType: ConstraintType;
  constraintDate?: string;
  deadline?: string;

  calendarId: string;
  priority: number;

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

  status: TaskStatus;
  tags: string[];
}

export interface Dependency {
  id: string;
  predecessorTaskId: string;
  successorTaskId: string;
  type: DependencyType;
  lagMinutes: number;
}

export interface CalendarWorkingHours {
  start: string;
  end: string;
}

export interface CalendarException {
  date: string;
  isWorking: boolean;
  workingHours?: CalendarWorkingHours[];
  label?: string;
}

export interface Calendar {
  id: string;
  name: string;
  baseCalendarId?: string;
  workingDays: Record<number, boolean>;
  workingHours: CalendarWorkingHours[];
  exceptions: CalendarException[];
  timeZone: string;
}

export interface CostRate {
  id: string;
  resourceId: string;
  standardRatePerHour: number;
  overtimeRatePerHour?: number;
  effectiveFrom: string;
}

export interface Resource {
  id: string;
  name: string;
  resourceGroupId?: string;
  calendarId: string;
  maxUnits: number;
  costRates: CostRate[];
  status: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  tags: string[];
}

export interface ResourceGroup {
  id: string;
  name: string;
  resourceIds: string[];
  status: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  tags: string[];
}

export interface Assignment {
  id: string;
  taskId: string;
  resourceId: string;
  units: number;
  plannedWorkMinutes: number;
  actualWorkMinutes: number;
  remainingWorkMinutes: number;
  costRateId?: string;
}

export interface Baseline {
  id: string;
  name: string;
  projectId: string;
  capturedAt: string;
  taskSnapshots: Record<
    string,
    Pick<Task, "start" | "finish" | "durationMinutes" | "workMinutes" | "fixedCost">
  >;
  status: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  tags: string[];
}

export interface StatusSnapshot {
  id: string;
  name: string;
  projectId: string;
  statusDate: string;
  taskPercentComplete: Record<string, number>;
  status: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  tags: string[];
}

export interface Deliverable {
  id: string;
  name: string;
  taskId: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  tags: string[];
}

export interface WBSNode {
  id: string;
  name: string;
  projectId: string;
  parentId: string | null;
  wbsCode: string;
  sequence: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  tags: string[];
}
