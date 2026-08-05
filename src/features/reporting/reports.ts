import type { Task } from "@/domain";

export interface MilestoneReportRow {
  id: string;
  name: string;
  finish: string;
  baselineFinish: string | null;
  /** null (never 0) when there is no baseline to compare against — avoids fabricating a value. */
  slippageMinutes: number | null;
  status: Task["status"];
}

export interface MilestoneReport {
  dataDate: string;
  milestones: MilestoneReportRow[];
}

export function generateMilestoneReport(tasks: Task[], dataDate: string): MilestoneReport {
  const milestones = tasks
    .filter((t) => t.isMilestone)
    .map((t): MilestoneReportRow => ({
      id: t.id,
      name: t.name,
      finish: t.finish,
      baselineFinish: t.baselineFinish ?? null,
      slippageMinutes: t.baselineFinish
        ? Math.round((new Date(t.finish).getTime() - new Date(t.baselineFinish).getTime()) / 60_000)
        : null,
      status: t.status,
    }));
  return { dataDate, milestones };
}

export interface CriticalPathReportRow {
  id: string;
  name: string;
  start: string;
  finish: string;
  totalFloatMinutes: number;
}

export interface CriticalPathReport {
  dataDate: string;
  totalTaskCount: number;
  criticalTaskCount: number;
  criticalTasks: CriticalPathReportRow[];
  /** Tasks with no computed schedule (isCritical/totalFloatMinutes undefined) — reported, not silently skipped. */
  tasksMissingScheduleData: string[];
}

export function generateCriticalPathReport(tasks: Task[], dataDate: string): CriticalPathReport {
  const leafTasks = tasks.filter((t) => !t.isSummary);
  const tasksMissingScheduleData = leafTasks
    .filter((t) => t.isCritical === undefined || t.totalFloatMinutes === undefined)
    .map((t) => t.id);

  const criticalTasks = leafTasks
    .filter((t) => t.isCritical === true && t.totalFloatMinutes !== undefined)
    .map((t): CriticalPathReportRow => ({
      id: t.id,
      name: t.name,
      start: t.start,
      finish: t.finish,
      totalFloatMinutes: t.totalFloatMinutes!,
    }));

  return {
    dataDate,
    totalTaskCount: tasks.length,
    criticalTaskCount: criticalTasks.length,
    criticalTasks,
    tasksMissingScheduleData,
  };
}
