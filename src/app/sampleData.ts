import type { Calendar, Dependency, Task } from "@/domain";

/**
 * The Stage 2/3 "smallest vertical slice" from docs/IMPLEMENTATION_PLAN.md:
 * one project, three tasks, one FS dependency. Stage 8 replaces this with
 * the full Enterprise RAG program sample (120+ tasks).
 */
export const sampleCalendar: Calendar = {
  id: "cal-standard",
  name: "Standard M-F 9-17",
  workingDays: { 0: false, 1: true, 2: true, 3: true, 4: true, 5: true, 6: false },
  workingHours: [{ start: "09:00", end: "17:00" }],
  exceptions: [],
  timeZone: "America/New_York",
};

const projectStart = "2026-01-19T14:00:00.000Z"; // Monday 09:00 America/New_York

export const sampleTasks: Task[] = [
  {
    id: "task-design",
    projectId: "proj-sample",
    parentId: null,
    wbsCode: "1",
    sequence: 1,
    name: "Design API",
    schedulingMode: "auto",
    isSummary: false,
    isMilestone: false,
    start: projectStart,
    finish: projectStart,
    durationMinutes: 960,
    workMinutes: 960,
    remainingWorkMinutes: 960,
    percentComplete: 100,
    constraintType: "ASAP",
    calendarId: "cal-standard",
    priority: 500,
    fixedCost: 0,
    costAccrual: "prorated",
    status: "complete",
    tags: [],
  },
  {
    id: "task-build",
    projectId: "proj-sample",
    parentId: null,
    wbsCode: "2",
    sequence: 2,
    name: "Build Endpoint",
    schedulingMode: "auto",
    isSummary: false,
    isMilestone: false,
    start: projectStart,
    finish: projectStart,
    durationMinutes: 1440,
    workMinutes: 1440,
    remainingWorkMinutes: 720,
    percentComplete: 50,
    constraintType: "ASAP",
    calendarId: "cal-standard",
    priority: 500,
    fixedCost: 0,
    costAccrual: "prorated",
    status: "in-progress",
    tags: [],
  },
  {
    id: "task-review",
    projectId: "proj-sample",
    parentId: null,
    wbsCode: "3",
    sequence: 3,
    name: "Review & Ship",
    schedulingMode: "auto",
    isSummary: false,
    isMilestone: false,
    start: projectStart,
    finish: projectStart,
    durationMinutes: 240,
    workMinutes: 240,
    remainingWorkMinutes: 240,
    percentComplete: 0,
    constraintType: "ASAP",
    calendarId: "cal-standard",
    priority: 500,
    fixedCost: 0,
    costAccrual: "prorated",
    status: "not-started",
    tags: [],
  },
];

export const sampleDependencies: Dependency[] = [
  { id: "dep-1", predecessorTaskId: "task-design", successorTaskId: "task-build", type: "FS", lagMinutes: 0 },
  { id: "dep-2", predecessorTaskId: "task-build", successorTaskId: "task-review", type: "FS", lagMinutes: 0 },
];
