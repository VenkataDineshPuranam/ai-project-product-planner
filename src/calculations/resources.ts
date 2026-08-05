import type { Assignment, Calendar, Resource, Task } from "@/domain";
import { CalendarEngine, utcToZonedDateStr, zonedWallTimeToUtc } from "./calendar";
import type { ScheduleWarning } from "./types";

export interface ResourceAllocationInput {
  tasks: Task[];
  assignments: Assignment[];
  resources: Resource[];
  calendars: Calendar[];
}

export interface DayAllocation {
  date: string;
  allocatedUnits: number;
  maxUnits: number;
  overAllocated: boolean;
}

function addDaysToDateStr(dateStr: string, delta: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
}

/** Per-resource, per-working-day sum of assignment units across all overlapping task spans. */
export function computeResourceHistogram(input: ResourceAllocationInput): Record<string, DayAllocation[]> {
  const engine = new CalendarEngine(input.calendars);
  const tasksById = new Map(input.tasks.map((t) => [t.id, t]));
  const resourcesById = new Map(input.resources.map((r) => [r.id, r]));

  const dailyUnitsByResource = new Map<string, Map<string, number>>();

  for (const assignment of input.assignments) {
    const task = tasksById.get(assignment.taskId);
    const resource = resourcesById.get(assignment.resourceId);
    if (!task || !resource) continue;

    const tz = engine.resolve(resource.calendarId).timeZone;
    const startDateStr = utcToZonedDateStr(new Date(task.start), tz);
    const endDateStr = utcToZonedDateStr(new Date(task.finish), tz);

    if (!dailyUnitsByResource.has(resource.id)) dailyUnitsByResource.set(resource.id, new Map());
    const buckets = dailyUnitsByResource.get(resource.id)!;

    let dateStr = startDateStr;
    for (let guard = 0; guard < 10_000 && dateStr <= endDateStr; guard++) {
      const noonInstant = zonedWallTimeToUtc(dateStr, "12:00", tz);
      if (engine.isWorkingDay(noonInstant, resource.calendarId)) {
        buckets.set(dateStr, (buckets.get(dateStr) ?? 0) + assignment.units);
      }
      if (dateStr === endDateStr) break;
      dateStr = addDaysToDateStr(dateStr, 1);
    }
  }

  const result: Record<string, DayAllocation[]> = {};
  for (const [resourceId, buckets] of dailyUnitsByResource) {
    const resource = resourcesById.get(resourceId)!;
    result[resourceId] = [...buckets.entries()]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([date, allocatedUnits]) => ({
        date,
        allocatedUnits,
        maxUnits: resource.maxUnits,
        overAllocated: allocatedUnits > resource.maxUnits,
      }));
  }
  return result;
}

/** OVER_ALLOCATION warnings for every day any resource's summed units exceed its maxUnits. */
export function detectOverAllocations(input: ResourceAllocationInput): ScheduleWarning[] {
  const histogram = computeResourceHistogram(input);
  const warnings: ScheduleWarning[] = [];
  for (const [resourceId, days] of Object.entries(histogram)) {
    for (const day of days) {
      if (day.overAllocated) {
        warnings.push({ code: "OVER_ALLOCATION", resourceId, date: day.date });
      }
    }
  }
  return warnings;
}
