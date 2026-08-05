import type { Assignment, CostRate, Task } from "@/domain";

export interface CostSummary {
  plannedCost: number;
  actualCost: number;
}

function rateFor(assignment: Assignment, costRates: CostRate[]): number {
  const rate = costRates.find((r) => r.id === assignment.costRateId);
  return rate?.standardRatePerHour ?? 0;
}

function fixedCostAccrued(task: Task): number {
  switch (task.costAccrual) {
    case "start":
      return task.percentComplete > 0 ? task.fixedCost : 0;
    case "end":
      return task.percentComplete >= 100 ? task.fixedCost : 0;
    case "prorated":
      return (task.fixedCost * task.percentComplete) / 100;
  }
}

/** Planned and actual cost for a single task: resource cost from its assignments plus fixed cost per its accrual method. */
export function computeTaskCost(task: Task, assignments: Assignment[], costRates: CostRate[]): CostSummary {
  const taskAssignments = assignments.filter((a) => a.taskId === task.id);

  const plannedResourceCost = taskAssignments.reduce(
    (sum, a) => sum + (a.plannedWorkMinutes / 60) * rateFor(a, costRates),
    0,
  );
  const actualResourceCost = taskAssignments.reduce(
    (sum, a) => sum + (a.actualWorkMinutes / 60) * rateFor(a, costRates),
    0,
  );

  return {
    plannedCost: plannedResourceCost + task.fixedCost,
    actualCost: actualResourceCost + fixedCostAccrued(task),
  };
}

/** Sums cost across leaf (non-summary) tasks only, to avoid double-counting rolled-up summary tasks. */
export function computeProjectCost(tasks: Task[], assignments: Assignment[], costRates: CostRate[]): CostSummary {
  return tasks
    .filter((t) => !t.isSummary)
    .reduce<CostSummary>(
      (total, task) => {
        const cost = computeTaskCost(task, assignments, costRates);
        return { plannedCost: total.plannedCost + cost.plannedCost, actualCost: total.actualCost + cost.actualCost };
      },
      { plannedCost: 0, actualCost: 0 },
    );
}
