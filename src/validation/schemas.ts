import { z } from "zod";

const isoDateTime = z.string().refine((v) => !Number.isNaN(Date.parse(v)), {
  message: "must be a valid ISO 8601 date-time string",
});

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "must be an ISO date (YYYY-MM-DD)");

const auditEventSchema = z.object({
  at: isoDateTime,
  actor: z.string(),
  action: z.string(),
  details: z.string().optional(),
});

export const entityBaseSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  ownerId: z.string().optional(),
  status: z.string().min(1),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
  version: z.number().int().positive(),
  tags: z.array(z.string()),
  auditTrail: z.array(auditEventSchema).default([]),
  externalRef: z.string().optional(),
});

const hhmm = z.string().regex(/^\d{2}:\d{2}$/, "must be HH:MM");

const workingHoursSchema = z
  .object({ start: hhmm, end: hhmm })
  .refine((v) => v.start < v.end, { message: "end must be after start" });

const calendarExceptionSchema = z.object({
  date: isoDate,
  isWorking: z.boolean(),
  workingHours: z.array(workingHoursSchema).optional(),
  label: z.string().optional(),
});

export const calendarSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  baseCalendarId: z.string().optional(),
  workingDays: z.record(z.string(), z.boolean()),
  workingHours: z.array(workingHoursSchema).min(1),
  exceptions: z.array(calendarExceptionSchema),
  timeZone: z.string().min(1),
});

const dependencyType = z.enum(["FS", "SS", "FF", "SF"]);
const schedulingMode = z.enum(["auto", "manual"]);
const constraintType = z.enum([
  "ASAP",
  "ALAP",
  "SNET",
  "SNLT",
  "FNET",
  "FNLT",
  "MSO",
  "MFO",
]);
const taskStatus = z.enum(["not-started", "in-progress", "blocked", "complete", "cancelled"]);
const costAccrual = z.enum(["start", "prorated", "end"]);

const dateBoundConstraints = new Set(["SNET", "SNLT", "FNET", "FNLT", "MSO", "MFO"]);

export const taskSchema = z
  .object({
    id: z.string().min(1),
    projectId: z.string().min(1),
    parentId: z.string().nullable(),
    wbsCode: z.string().min(1),
    sequence: z.number().int().nonnegative(),

    name: z.string().min(1),
    description: z.string().optional(),
    workstreamId: z.string().optional(),
    ownerId: z.string().optional(),

    schedulingMode,
    isSummary: z.boolean(),
    isMilestone: z.boolean(),

    start: isoDateTime,
    finish: isoDateTime,
    durationMinutes: z.number().int().nonnegative(),
    workMinutes: z.number().int().nonnegative(),
    remainingWorkMinutes: z.number().int().nonnegative(),

    percentComplete: z.number().min(0).max(100),
    physicalPercentComplete: z.number().min(0).max(100).optional(),

    constraintType,
    constraintDate: isoDateTime.optional(),
    deadline: isoDateTime.optional(),

    calendarId: z.string().min(1),
    priority: z.number().int().min(0).max(1000),

    fixedCost: z.number().nonnegative(),
    costAccrual,

    baselineStart: isoDateTime.optional(),
    baselineFinish: isoDateTime.optional(),
    baselineDurationMinutes: z.number().int().nonnegative().optional(),
    baselineWorkMinutes: z.number().int().nonnegative().optional(),
    baselineCost: z.number().nonnegative().optional(),

    actualStart: isoDateTime.optional(),
    actualFinish: isoDateTime.optional(),
    actualWorkMinutes: z.number().int().nonnegative().optional(),
    actualCost: z.number().nonnegative().optional(),

    totalFloatMinutes: z.number().int().optional(),
    freeFloatMinutes: z.number().int().optional(),
    isCritical: z.boolean().optional(),

    status: taskStatus,
    tags: z.array(z.string()),
  })
  .superRefine((task, ctx) => {
    if (Date.parse(task.finish) < Date.parse(task.start)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["finish"], message: "finish must not be before start" });
    }
    if (task.isMilestone && task.durationMinutes !== 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["durationMinutes"], message: "milestones must have zero duration" });
    }
    if (dateBoundConstraints.has(task.constraintType) && !task.constraintDate) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["constraintDate"], message: `${task.constraintType} requires constraintDate` });
    }
    if (task.parentId === task.id) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["parentId"], message: "a task cannot be its own parent" });
    }
  });

export const dependencySchema = z
  .object({
    id: z.string().min(1),
    predecessorTaskId: z.string().min(1),
    successorTaskId: z.string().min(1),
    type: dependencyType,
    lagMinutes: z.number().int(),
  })
  .refine((d) => d.predecessorTaskId !== d.successorTaskId, {
    message: "a task cannot depend on itself",
    path: ["successorTaskId"],
  });

export const costRateSchema = z.object({
  id: z.string().min(1),
  resourceId: z.string().min(1),
  standardRatePerHour: z.number().nonnegative(),
  overtimeRatePerHour: z.number().nonnegative().optional(),
  effectiveFrom: isoDateTime,
});

export const resourceSchema = entityBaseSchema.omit({ description: true, ownerId: true, externalRef: true }).extend({
  resourceGroupId: z.string().optional(),
  calendarId: z.string().min(1),
  maxUnits: z.number().positive(),
  costRates: z.array(costRateSchema),
});

export const assignmentSchema = z
  .object({
    id: z.string().min(1),
    taskId: z.string().min(1),
    resourceId: z.string().min(1),
    units: z.number().positive(),
    plannedWorkMinutes: z.number().int().nonnegative(),
    actualWorkMinutes: z.number().int().nonnegative(),
    remainingWorkMinutes: z.number().int().nonnegative(),
    costRateId: z.string().optional(),
  });

export const wbsNodeSchema = entityBaseSchema
  .omit({ description: true, ownerId: true, externalRef: true })
  .extend({
    projectId: z.string().min(1),
    parentId: z.string().nullable(),
    wbsCode: z.string().min(1),
    sequence: z.number().int().nonnegative(),
  })
  .refine((n) => n.parentId !== n.id, {
    message: "a WBS node cannot be its own parent",
    path: ["parentId"],
  });

const stakeholderSchema = z.object({
  name: z.string().min(1),
  role: z.string().min(1),
  raciRole: z.enum(["R", "A", "C", "I"]),
});

const projectCharterSchema = z.object({
  objectives: z.array(z.string()),
  successCriteria: z.array(z.string()),
  scopeIncluded: z.array(z.string()),
  scopeExcluded: z.array(z.string()),
  stakeholders: z.array(stakeholderSchema),
});

export const projectSchema = entityBaseSchema.extend({
  programId: z.string().optional(),
  charter: projectCharterSchema,
  calendarId: z.string().min(1),
  statusDate: isoDateTime,
  workstreamIds: z.array(z.string()),
});

export const baselineSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  projectId: z.string().min(1),
  capturedAt: isoDateTime,
  taskSnapshots: z.record(
    z.string(),
    z.object({
      start: isoDateTime,
      finish: isoDateTime,
      durationMinutes: z.number().int().nonnegative(),
      workMinutes: z.number().int().nonnegative(),
      fixedCost: z.number().nonnegative(),
    }),
  ),
  status: z.string().min(1),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
  version: z.number().int().positive(),
  tags: z.array(z.string()),
});
