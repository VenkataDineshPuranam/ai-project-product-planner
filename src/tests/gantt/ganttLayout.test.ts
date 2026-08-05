import { describe, expect, it } from "vitest";
import { dateToX, computeTimelineBounds, ZOOM_PX_PER_DAY, type ZoomLevel } from "@/features/gantt/ganttLayout";
import type { Task } from "@/domain";

function makeTask(overrides: Partial<Task> & { id: string }): Task {
  return {
    projectId: "proj-1",
    parentId: null,
    wbsCode: "1",
    sequence: 1,
    name: overrides.id,
    schedulingMode: "auto",
    isSummary: false,
    isMilestone: false,
    start: "2026-01-19T14:00:00.000Z",
    finish: "2026-01-19T22:00:00.000Z",
    durationMinutes: 480,
    workMinutes: 480,
    remainingWorkMinutes: 480,
    percentComplete: 0,
    constraintType: "ASAP",
    calendarId: "cal-1",
    priority: 500,
    fixedCost: 0,
    costAccrual: "prorated",
    status: "not-started",
    tags: [],
    ...overrides,
  };
}

describe("computeTimelineBounds", () => {
  it("spans from the earliest start to the latest finish across tasks", () => {
    const tasks = [
      makeTask({ id: "a", start: "2026-01-19T14:00:00.000Z", finish: "2026-01-20T14:00:00.000Z" }),
      makeTask({ id: "b", start: "2026-01-21T14:00:00.000Z", finish: "2026-01-25T14:00:00.000Z" }),
    ];
    const bounds = computeTimelineBounds(tasks);
    expect(bounds.start.toISOString()).toBe("2026-01-19T14:00:00.000Z");
    expect(bounds.end.toISOString()).toBe("2026-01-25T14:00:00.000Z");
  });

  it("returns a fallback window for an empty task list", () => {
    const bounds = computeTimelineBounds([]);
    expect(bounds.end.getTime()).toBeGreaterThan(bounds.start.getTime());
  });
});

describe("dateToX", () => {
  const timelineStart = new Date("2026-01-19T00:00:00.000Z");

  it("places the timeline start at x=0", () => {
    expect(dateToX(timelineStart, timelineStart, ZOOM_PX_PER_DAY.week)).toBe(0);
  });

  it("scales linearly with elapsed days at a given zoom level", () => {
    const oneDayLater = new Date("2026-01-20T00:00:00.000Z");
    const pxPerDay = ZOOM_PX_PER_DAY.week;
    expect(dateToX(oneDayLater, timelineStart, pxPerDay)).toBeCloseTo(pxPerDay, 5);
  });

  it("produces a wider layout at day zoom than at year zoom", () => {
    const later = new Date("2026-02-19T00:00:00.000Z");
    const dayZoomX = dateToX(later, timelineStart, ZOOM_PX_PER_DAY.day);
    const yearZoomX = dateToX(later, timelineStart, ZOOM_PX_PER_DAY.year);
    expect(dayZoomX).toBeGreaterThan(yearZoomX);
  });
});

describe("ZOOM_PX_PER_DAY", () => {
  it("covers all five required zoom levels", () => {
    const levels: ZoomLevel[] = ["day", "week", "month", "quarter", "year"];
    for (const level of levels) {
      expect(ZOOM_PX_PER_DAY[level]).toBeGreaterThan(0);
    }
  });
});
