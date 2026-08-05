import type { Task } from "@/domain";

export type ZoomLevel = "day" | "week" | "month" | "quarter" | "year";

/** Pixels per calendar day at each zoom level. */
export const ZOOM_PX_PER_DAY: Record<ZoomLevel, number> = {
  day: 120,
  week: 48,
  month: 16,
  quarter: 6,
  year: 1.6,
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface TimelineBounds {
  start: Date;
  end: Date;
}

/** Earliest start to latest finish across all tasks, with a fallback window when there are none. */
export function computeTimelineBounds(tasks: Task[]): TimelineBounds {
  if (tasks.length === 0) {
    const start = new Date();
    return { start, end: new Date(start.getTime() + 30 * MS_PER_DAY) };
  }
  const starts = tasks.map((t) => new Date(t.start).getTime());
  const finishes = tasks.map((t) => new Date(t.finish).getTime());
  return { start: new Date(Math.min(...starts)), end: new Date(Math.max(...finishes)) };
}

/** Horizontal pixel offset of `date` relative to `timelineStart`, at the given zoom's px-per-day. */
export function dateToX(date: Date, timelineStart: Date, pxPerDay: number): number {
  const elapsedDays = (date.getTime() - timelineStart.getTime()) / MS_PER_DAY;
  return elapsedDays * pxPerDay;
}
