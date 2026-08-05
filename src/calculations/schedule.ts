import type { Calendar, Dependency, Task } from "@/domain";
import { CalendarEngine } from "./calendar";
import type { ScheduleError, ScheduleWarning, TaskForecast } from "./types";

export interface ScheduleInput {
  tasks: Task[];
  dependencies: Dependency[];
  calendars: Calendar[];
  statusDate?: string;
}

export interface ScheduleOutput {
  tasks: Task[];
  errors: ScheduleError[];
  warnings: ScheduleWarning[];
  forecasts: Record<string, TaskForecast>;
}

interface DateWindow {
  ES: Date;
  EF: Date;
}

interface LateWindow {
  LS: Date;
  LF: Date;
}

function maxDate(dates: Date[]): Date {
  return new Date(Math.max(...dates.map((d) => d.getTime())));
}

function minDate(dates: Date[]): Date {
  return new Date(Math.min(...dates.map((d) => d.getTime())));
}

/** Kahn's algorithm; returns a topological order plus the set of task ids that could not be ordered (cyclic). */
function topologicalOrder(taskIds: string[], edges: Dependency[]): { order: string[]; cyclic: Set<string> } {
  const indegree = new Map<string, number>(taskIds.map((id) => [id, 0]));
  const outgoing = new Map<string, string[]>(taskIds.map((id) => [id, []]));
  for (const edge of edges) {
    outgoing.get(edge.predecessorTaskId)!.push(edge.successorTaskId);
    indegree.set(edge.successorTaskId, (indegree.get(edge.successorTaskId) ?? 0) + 1);
  }

  const queue = taskIds.filter((id) => indegree.get(id) === 0);
  const order: string[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    order.push(id);
    for (const next of outgoing.get(id) ?? []) {
      const remaining = (indegree.get(next) ?? 0) - 1;
      indegree.set(next, remaining);
      if (remaining === 0) queue.push(next);
    }
  }

  const cyclic = new Set(taskIds.filter((id) => !order.includes(id)));
  return { order, cyclic };
}

export function computeSchedule(input: ScheduleInput): ScheduleOutput {
  const engine = new CalendarEngine(input.calendars);
  const errors: ScheduleError[] = [];
  const warnings: ScheduleWarning[] = [];
  const tasksById = new Map(input.tasks.map((t) => [t.id, t]));

  const leafTasks = input.tasks.filter((t) => !t.isSummary);
  const leafIds = new Set(leafTasks.map((t) => t.id));

  const validEdges: Dependency[] = [];
  for (const edge of input.dependencies) {
    if (!tasksById.has(edge.predecessorTaskId)) {
      errors.push({ code: "BROKEN_REFERENCE", entity: "Dependency", id: edge.id, field: "predecessorTaskId" });
      continue;
    }
    if (!tasksById.has(edge.successorTaskId)) {
      errors.push({ code: "BROKEN_REFERENCE", entity: "Dependency", id: edge.id, field: "successorTaskId" });
      continue;
    }
    if (leafIds.has(edge.predecessorTaskId) && leafIds.has(edge.successorTaskId)) {
      validEdges.push(edge);
    }
  }

  const { order, cyclic } = topologicalOrder([...leafIds], validEdges);
  if (cyclic.size > 0) {
    errors.push({ code: "CYCLE", taskIds: [...cyclic] });
  }

  const incomingByTask = new Map<string, Dependency[]>();
  const outgoingByTask = new Map<string, Dependency[]>();
  for (const edge of validEdges) {
    if (!incomingByTask.has(edge.successorTaskId)) incomingByTask.set(edge.successorTaskId, []);
    incomingByTask.get(edge.successorTaskId)!.push(edge);
    if (!outgoingByTask.has(edge.predecessorTaskId)) outgoingByTask.set(edge.predecessorTaskId, []);
    outgoingByTask.get(edge.predecessorTaskId)!.push(edge);
  }

  // --- Forward pass: early start/finish, honoring dependencies and constraints. ---
  const early = new Map<string, DateWindow>();
  const resultsById = new Map<string, Task>();

  for (const id of order) {
    const task = tasksById.get(id)!;
    const calendarId = task.calendarId;
    const duration = task.durationMinutes;
    const incoming = incomingByTask.get(id) ?? [];

    const startConstraints: Date[] = [];
    const finishConstraints: Date[] = [];
    for (const edge of incoming) {
      const pred = early.get(edge.predecessorTaskId);
      if (!pred) continue;
      switch (edge.type) {
        case "FS":
          startConstraints.push(engine.ceilToWorkingInstant(engine.addWorkingMinutes(pred.EF, edge.lagMinutes, calendarId), calendarId));
          break;
        case "SS":
          startConstraints.push(engine.ceilToWorkingInstant(engine.addWorkingMinutes(pred.ES, edge.lagMinutes, calendarId), calendarId));
          break;
        case "FF":
          finishConstraints.push(engine.addWorkingMinutes(pred.EF, edge.lagMinutes, calendarId));
          break;
        case "SF":
          finishConstraints.push(engine.addWorkingMinutes(pred.ES, edge.lagMinutes, calendarId));
          break;
      }
    }

    const depStart = startConstraints.length > 0 ? maxDate(startConstraints) : undefined;
    const depFinish = finishConstraints.length > 0 ? maxDate(finishConstraints) : undefined;

    let ES: Date;
    let EF: Date;

    if (task.schedulingMode === "manual") {
      ES = new Date(task.start);
      EF = new Date(task.finish);
      if (depStart && depStart.getTime() > ES.getTime()) {
        warnings.push({ code: "MANUAL_TASK_CONFLICT", taskId: id });
      }
    } else {
      const baseStart = depStart ?? new Date(task.start);
      switch (task.constraintType) {
        case "MSO":
          ES = new Date(task.constraintDate!);
          EF = engine.addWorkingMinutes(ES, duration, calendarId);
          break;
        case "MFO":
          EF = new Date(task.constraintDate!);
          ES = engine.addWorkingMinutes(EF, -duration, calendarId);
          break;
        case "SNET": {
          const constraintDate = new Date(task.constraintDate!);
          ES = baseStart.getTime() > constraintDate.getTime() ? baseStart : constraintDate;
          EF = engine.addWorkingMinutes(ES, duration, calendarId);
          break;
        }
        case "FNET": {
          const naturalFinish = engine.addWorkingMinutes(baseStart, duration, calendarId);
          const constraintDate = new Date(task.constraintDate!);
          if (constraintDate.getTime() > naturalFinish.getTime()) {
            EF = constraintDate;
            ES = engine.addWorkingMinutes(EF, -duration, calendarId);
          } else {
            EF = naturalFinish;
            ES = baseStart;
          }
          break;
        }
        case "SNLT": {
          ES = baseStart;
          EF = engine.addWorkingMinutes(ES, duration, calendarId);
          const constraintDate = new Date(task.constraintDate!);
          if (ES.getTime() > constraintDate.getTime()) {
            warnings.push({ code: "CONSTRAINT_INFEASIBLE", taskId: id, reason: "start is later than Start No Later Than constraint" });
          }
          break;
        }
        case "FNLT": {
          ES = baseStart;
          EF = engine.addWorkingMinutes(ES, duration, calendarId);
          const constraintDate = new Date(task.constraintDate!);
          if (EF.getTime() > constraintDate.getTime()) {
            warnings.push({ code: "CONSTRAINT_INFEASIBLE", taskId: id, reason: "finish is later than Finish No Later Than constraint" });
          }
          break;
        }
        default:
          ES = baseStart;
          EF = engine.addWorkingMinutes(ES, duration, calendarId);
      }

      if (depFinish && EF.getTime() < depFinish.getTime()) {
        EF = depFinish;
        ES = engine.addWorkingMinutes(EF, -duration, calendarId);
      }
    }

    early.set(id, { ES, EF });

    if (task.deadline && EF.getTime() > new Date(task.deadline).getTime()) {
      warnings.push({ code: "DEADLINE_MISSED", taskId: id, deadline: task.deadline, forecastFinish: EF.toISOString() });
    }
  }

  const projectEnd = order.length > 0 ? maxDate(order.map((id) => early.get(id)!.EF)) : new Date(0);

  // --- Backward pass: late start/finish, for float and ALAP. ---
  const late = new Map<string, LateWindow>();
  for (let i = order.length - 1; i >= 0; i--) {
    const id = order[i];
    const task = tasksById.get(id)!;
    const duration = task.durationMinutes;
    const outgoing = outgoingByTask.get(id) ?? [];

    const lateStartConstraints: Date[] = [];
    const lateFinishConstraints: Date[] = [];
    for (const edge of outgoing) {
      const succ = late.get(edge.successorTaskId);
      if (!succ) continue;
      switch (edge.type) {
        case "FS":
          lateFinishConstraints.push(engine.addWorkingMinutes(succ.LS, -edge.lagMinutes, task.calendarId));
          break;
        case "SS":
          lateStartConstraints.push(engine.addWorkingMinutes(succ.LS, -edge.lagMinutes, task.calendarId));
          break;
        case "FF":
          lateFinishConstraints.push(engine.addWorkingMinutes(succ.LF, -edge.lagMinutes, task.calendarId));
          break;
        case "SF":
          lateStartConstraints.push(engine.addWorkingMinutes(succ.LF, -edge.lagMinutes, task.calendarId));
          break;
      }
    }

    let LF: Date;
    if (lateFinishConstraints.length > 0) {
      LF = minDate(lateFinishConstraints);
    } else if (lateStartConstraints.length > 0) {
      LF = engine.addWorkingMinutes(minDate(lateStartConstraints), duration, task.calendarId);
    } else {
      LF = projectEnd;
    }
    const LS = engine.addWorkingMinutes(LF, -duration, task.calendarId);
    late.set(id, { LS, LF });
  }

  // --- Assemble final per-task results. ---
  for (const id of order) {
    const task = tasksById.get(id)!;
    const { ES, EF } = early.get(id)!;
    const { LS, LF } = late.get(id)!;

    const isAlap = task.schedulingMode === "auto" && task.constraintType === "ALAP";
    const finalStart = task.schedulingMode === "manual" ? task.start : (isAlap ? LS : ES).toISOString();
    const finalFinish = task.schedulingMode === "manual" ? task.finish : (isAlap ? LF : EF).toISOString();

    const totalFloatMinutes = Math.round(engine.workingMinutesBetween(ES, LS, task.calendarId));

    const outgoing = outgoingByTask.get(id) ?? [];
    const freeFloatCandidates: number[] = [];
    for (const edge of outgoing) {
      const succEarly = early.get(edge.successorTaskId);
      if (!succEarly) continue;
      if (edge.type === "FS") {
        const gap = Math.round(engine.workingMinutesBetween(EF, succEarly.ES, task.calendarId)) - edge.lagMinutes;
        freeFloatCandidates.push(Math.max(0, gap));
      } else if (edge.type === "SS") {
        const gap = Math.round(engine.workingMinutesBetween(ES, succEarly.ES, task.calendarId)) - edge.lagMinutes;
        freeFloatCandidates.push(Math.max(0, gap));
      }
    }
    const freeFloatMinutes = freeFloatCandidates.length > 0 ? Math.min(...freeFloatCandidates) : totalFloatMinutes;

    resultsById.set(id, {
      ...task,
      start: finalStart,
      finish: finalFinish,
      totalFloatMinutes,
      freeFloatMinutes,
      isCritical: totalFloatMinutes <= 0,
    });
  }

  for (const id of cyclic) {
    resultsById.set(id, tasksById.get(id)!);
  }

  // --- Summary task rollup, deepest first. ---
  const depthOf = (task: Task): number => {
    let depth = 0;
    let current: Task | undefined = task;
    while (current?.parentId) {
      depth += 1;
      current = tasksById.get(current.parentId);
    }
    return depth;
  };
  const summaryTasks = input.tasks.filter((t) => t.isSummary).sort((a, b) => depthOf(b) - depthOf(a));

  for (const summary of summaryTasks) {
    const children = input.tasks.filter((t) => t.parentId === summary.id).map((t) => resultsById.get(t.id) ?? t);
    if (children.length === 0) {
      resultsById.set(summary.id, summary);
      continue;
    }
    const starts = children.map((c) => new Date(c.start));
    const finishes = children.map((c) => new Date(c.finish));
    const start = minDate(starts);
    const finish = maxDate(finishes);
    const totalWork = children.reduce((sum, c) => sum + c.workMinutes, 0);
    const weightedComplete = totalWork > 0
      ? children.reduce((sum, c) => sum + c.workMinutes * c.percentComplete, 0) / totalWork
      : 0;

    resultsById.set(summary.id, {
      ...summary,
      start: start.toISOString(),
      finish: finish.toISOString(),
      durationMinutes: Math.round(engine.workingMinutesBetween(start, finish, summary.calendarId)),
      percentComplete: Math.round(weightedComplete),
      isCritical: children.some((c) => c.isCritical === true),
    });
  }

  // --- Progress & forecasting. ---
  const forecasts: Record<string, TaskForecast> = {};
  if (input.statusDate) {
    const statusDate = new Date(input.statusDate);
    for (const task of leafTasks) {
      if (!task.actualStart || task.status === "complete") continue;
      const remaining = task.remainingWorkMinutes ?? 0;
      const forecastFinish = engine.addWorkingMinutes(statusDate, remaining, task.calendarId);
      const entry: TaskForecast = { forecastFinish: forecastFinish.toISOString() };
      if (task.baselineFinish) {
        entry.scheduleVarianceMinutes = Math.round(
          engine.workingMinutesBetween(new Date(task.baselineFinish), forecastFinish, task.calendarId),
        );
      }
      forecasts[task.id] = entry;
    }
  }

  const tasks = input.tasks.map((t) => resultsById.get(t.id) ?? t);
  return { tasks, errors, warnings, forecasts };
}
