import { describe, expect, it } from "vitest";
import type { Calendar } from "@/domain";
import { CalendarEngine, zonedWallTimeToUtc } from "@/calculations/calendar";

const standardCalendar: Calendar = {
  id: "cal-standard",
  name: "Standard M-F 9-17",
  workingDays: { 0: false, 1: true, 2: true, 3: true, 4: true, 5: true, 6: false },
  workingHours: [{ start: "09:00", end: "17:00" }],
  exceptions: [],
  timeZone: "America/New_York",
};

const splitShiftCalendar: Calendar = {
  ...standardCalendar,
  id: "cal-split",
  workingHours: [
    { start: "09:00", end: "12:00" },
    { start: "13:00", end: "17:00" },
  ],
};

const holidayCalendar: Calendar = {
  ...standardCalendar,
  id: "cal-holiday",
  exceptions: [{ date: "2026-01-21", isWorking: false, label: "Company holiday" }],
};

describe("CalendarEngine.addWorkingMinutes", () => {
  const engine = new CalendarEngine([standardCalendar, splitShiftCalendar, holidayCalendar]);

  it("skips a weekend", () => {
    // Friday 2026-01-16 16:00 local + 120 minutes -> Monday 2026-01-19 10:00 local
    const start = zonedWallTimeToUtc("2026-01-16", "16:00", "America/New_York");
    const result = engine.addWorkingMinutes(start, 120, "cal-standard");
    const expected = zonedWallTimeToUtc("2026-01-19", "10:00", "America/New_York");
    expect(result.getTime()).toBe(expected.getTime());
  });

  it("skips a holiday exception", () => {
    // Tuesday 2026-01-20 16:00 + 120 min; Wed 21st is a holiday -> lands Thursday 22nd 10:00
    const start = zonedWallTimeToUtc("2026-01-20", "16:00", "America/New_York");
    const result = engine.addWorkingMinutes(start, 120, "cal-holiday");
    const expected = zonedWallTimeToUtc("2026-01-22", "10:00", "America/New_York");
    expect(result.getTime()).toBe(expected.getTime());
  });

  it("carries remaining duration across a split-shift lunch break", () => {
    // 11:30 + 90 minutes: 30 min consumes to 12:00, remaining 60 min starts at 13:00 -> 14:00
    const start = zonedWallTimeToUtc("2026-01-19", "11:30", "America/New_York");
    const result = engine.addWorkingMinutes(start, 90, "cal-split");
    const expected = zonedWallTimeToUtc("2026-01-19", "14:00", "America/New_York");
    expect(result.getTime()).toBe(expected.getTime());
  });

  it("crosses a month boundary", () => {
    // Friday 2026-01-30 16:00 + 120 min -> Monday 2026-02-02 10:00 (Jan 31/Feb 1 are Sat/Sun)
    const start = zonedWallTimeToUtc("2026-01-30", "16:00", "America/New_York");
    const result = engine.addWorkingMinutes(start, 120, "cal-standard");
    const expected = zonedWallTimeToUtc("2026-02-02", "10:00", "America/New_York");
    expect(result.getTime()).toBe(expected.getTime());
  });

  it("crosses a year boundary", () => {
    // Wednesday 2025-12-31 16:00 + 120 min -> Thursday 2026-01-01 is a working day per this calendar (no holiday configured) -> 10:00
    const start = zonedWallTimeToUtc("2025-12-31", "16:00", "America/New_York");
    const result = engine.addWorkingMinutes(start, 120, "cal-standard");
    const expected = zonedWallTimeToUtc("2026-01-01", "10:00", "America/New_York");
    expect(result.getTime()).toBe(expected.getTime());
  });

  it("supports negative (backward) duration", () => {
    const start = zonedWallTimeToUtc("2026-01-19", "10:00", "America/New_York");
    const result = engine.addWorkingMinutes(start, -120, "cal-standard");
    // Backward 120 min from Monday 10:00 -> Friday 16:00 (skip weekend)
    const expected = zonedWallTimeToUtc("2026-01-16", "16:00", "America/New_York");
    expect(result.getTime()).toBe(expected.getTime());
  });

  it("zero-duration milestone: addWorkingMinutes with 0 returns the same instant", () => {
    const start = zonedWallTimeToUtc("2026-01-19", "10:00", "America/New_York");
    const result = engine.addWorkingMinutes(start, 0, "cal-standard");
    expect(result.getTime()).toBe(start.getTime());
  });
});

describe("CalendarEngine.workingMinutesBetween", () => {
  const engine = new CalendarEngine([standardCalendar]);

  it("counts working minutes across a full working week", () => {
    const start = zonedWallTimeToUtc("2026-01-19", "09:00", "America/New_York"); // Monday
    const end = zonedWallTimeToUtc("2026-01-23", "17:00", "America/New_York"); // Friday
    expect(engine.workingMinutesBetween(start, end, "cal-standard")).toBe(5 * 8 * 60);
  });

  it("returns a negative value when end precedes start", () => {
    const start = zonedWallTimeToUtc("2026-01-23", "17:00", "America/New_York");
    const end = zonedWallTimeToUtc("2026-01-19", "09:00", "America/New_York");
    expect(engine.workingMinutesBetween(start, end, "cal-standard")).toBe(-5 * 8 * 60);
  });
});

describe("calendar inheritance", () => {
  it("child calendar inherits base working hours but overrides exceptions", () => {
    const base: Calendar = { ...standardCalendar, id: "cal-base" };
    const child: Calendar = {
      id: "cal-child",
      name: "Child",
      baseCalendarId: "cal-base",
      workingDays: {},
      workingHours: [],
      exceptions: [{ date: "2026-01-21", isWorking: false, label: "Team offsite" }],
      timeZone: "America/New_York",
    };
    const engine = new CalendarEngine([base, child]);
    const start = zonedWallTimeToUtc("2026-01-20", "16:00", "America/New_York");
    const result = engine.addWorkingMinutes(start, 120, "cal-child");
    const expected = zonedWallTimeToUtc("2026-01-22", "10:00", "America/New_York");
    expect(result.getTime()).toBe(expected.getTime());
  });
});

describe("zonedWallTimeToUtc DST safety", () => {
  it("the local day of a spring-forward transition is one hour shorter in UTC terms", () => {
    // 2026-03-08 is the US spring-forward date (clocks jump 02:00 -> 03:00).
    const startOfDay = zonedWallTimeToUtc("2026-03-08", "00:00", "America/New_York");
    const startOfNextDay = zonedWallTimeToUtc("2026-03-09", "00:00", "America/New_York");
    const diffMinutes = (startOfNextDay.getTime() - startOfDay.getTime()) / 60000;
    expect(diffMinutes).toBe(23 * 60);
  });

  it("a non-DST day is a full 24 hours in UTC terms", () => {
    const startOfDay = zonedWallTimeToUtc("2026-01-19", "00:00", "America/New_York");
    const startOfNextDay = zonedWallTimeToUtc("2026-01-20", "00:00", "America/New_York");
    const diffMinutes = (startOfNextDay.getTime() - startOfDay.getTime()) / 60000;
    expect(diffMinutes).toBe(24 * 60);
  });
});
