import type { Calendar, CalendarWorkingHours } from "@/domain";

const MAX_DAY_ITERATIONS = 10_000;

// Constructing an Intl.DateTimeFormat is expensive (a well-known V8 hot
// path); with a large schedule this function is called per task per
// working-time day, so every formatter is cached and reused per time zone
// rather than rebuilt on every call.
const offsetFormatterCache = new Map<string, Intl.DateTimeFormat>();
function offsetFormatterFor(timeZone: string): Intl.DateTimeFormat {
  let dtf = offsetFormatterCache.get(timeZone);
  if (!dtf) {
    dtf = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    offsetFormatterCache.set(timeZone, dtf);
  }
  return dtf;
}

const dateStrFormatterCache = new Map<string, Intl.DateTimeFormat>();
function dateStrFormatterFor(timeZone: string): Intl.DateTimeFormat {
  let dtf = dateStrFormatterCache.get(timeZone);
  if (!dtf) {
    dtf = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
    dateStrFormatterCache.set(timeZone, dtf);
  }
  return dtf;
}

const weekdayFormatterCache = new Map<string, Intl.DateTimeFormat>();
function weekdayFormatterFor(timeZone: string): Intl.DateTimeFormat {
  let dtf = weekdayFormatterCache.get(timeZone);
  if (!dtf) {
    dtf = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" });
    weekdayFormatterCache.set(timeZone, dtf);
  }
  return dtf;
}

function getOffsetMinutes(utcInstant: Date, timeZone: string): number {
  const parts = offsetFormatterFor(timeZone).formatToParts(utcInstant);
  const map: Record<string, string> = {};
  for (const part of parts) map[part.type] = part.value;
  const hour = map.hour === "24" ? 0 : Number(map.hour);
  const asUtc = Date.UTC(Number(map.year), Number(map.month) - 1, Number(map.day), hour, Number(map.minute), Number(map.second));
  return (asUtc - utcInstant.getTime()) / 60_000;
}

/** Converts a local wall-clock date+time in `timeZone` to the corresponding UTC instant, DST-safe. */
export function zonedWallTimeToUtc(dateStr: string, timeStr: string, timeZone: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  const naiveUtcMs = Date.UTC(y, m - 1, d, hh, mm);
  let guess = new Date(naiveUtcMs);
  const offset1 = getOffsetMinutes(guess, timeZone);
  guess = new Date(naiveUtcMs - offset1 * 60_000);
  const offset2 = getOffsetMinutes(guess, timeZone);
  if (offset2 !== offset1) {
    guess = new Date(naiveUtcMs - offset2 * 60_000);
  }
  return guess;
}

export function utcToZonedDateStr(instant: Date, timeZone: string): string {
  return dateStrFormatterFor(timeZone).format(instant);
}

function utcToZonedWeekday(instant: Date, timeZone: string): number {
  const weekday = weekdayFormatterFor(timeZone).format(instant);
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[weekday];
}

function addDaysToDateStr(dateStr: string, delta: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
}

const MS_PER_DAY = 86_400_000;

/** A pure day-counting index (days since the Unix epoch), used only for closed-form range arithmetic. */
function dateStrToDayIndex(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / MS_PER_DAY);
}

/** 1970-01-01 (day index 0) was a Thursday (weekday 4); weekday 0 = Sunday. */
function dayIndexWeekday(dayIndex: number): number {
  return ((dayIndex + 4) % 7 + 7) % 7;
}

function sumWorkingHoursMinutes(workingHours: CalendarWorkingHours[]): number {
  return workingHours.reduce((sum, wh) => {
    const [sh, sm] = wh.start.split(":").map(Number);
    const [eh, em] = wh.end.split(":").map(Number);
    return sum + (eh * 60 + em - (sh * 60 + sm));
  }, 0);
}

interface ResolvedInterval {
  start: Date;
  end: Date;
}

function mergeCalendars(child: Calendar, base: Calendar): Calendar {
  const exceptionsByDate = new Map(base.exceptions.map((e) => [e.date, e]));
  for (const exception of child.exceptions) exceptionsByDate.set(exception.date, exception);
  return {
    ...base,
    ...child,
    workingDays: { ...base.workingDays, ...child.workingDays },
    workingHours: child.workingHours.length > 0 ? child.workingHours : base.workingHours,
    exceptions: [...exceptionsByDate.values()],
  };
}

export class CalendarEngine {
  private readonly byId = new Map<string, Calendar>();
  private readonly resolvedCache = new Map<string, Calendar>();
  private readonly intervalsCache = new Map<string, ResolvedInterval[]>();
  private readonly weekdayMinutesCache = new Map<string, number[]>();

  constructor(calendars: Calendar[]) {
    for (const cal of calendars) this.byId.set(cal.id, cal);
  }

  resolve(calendarId: string): Calendar {
    const cached = this.resolvedCache.get(calendarId);
    if (cached) return cached;

    const cal = this.byId.get(calendarId);
    if (!cal) throw new Error(`unknown calendar: ${calendarId}`);

    const resolved = cal.baseCalendarId ? mergeCalendars(cal, this.resolve(cal.baseCalendarId)) : cal;
    this.resolvedCache.set(calendarId, resolved);
    return resolved;
  }

  private rawWorkingHoursForDate(calendar: Calendar, dateStr: string): CalendarWorkingHours[] {
    const exception = calendar.exceptions.find((e) => e.date === dateStr);
    if (exception) {
      if (!exception.isWorking) return [];
      return exception.workingHours ?? calendar.workingHours;
    }
    const [y, m, d] = dateStr.split("-").map(Number);
    const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    if (calendar.workingDays[weekday] === false) return [];
    return calendar.workingHours;
  }

  private intervalsForDate(calendarId: string, dateStr: string): ResolvedInterval[] {
    const cacheKey = `${calendarId}|${dateStr}`;
    const cached = this.intervalsCache.get(cacheKey);
    if (cached) return cached;

    const calendar = this.resolve(calendarId);
    const raw = this.rawWorkingHoursForDate(calendar, dateStr);
    const intervals = raw
      .map((wh) => ({
        start: zonedWallTimeToUtc(dateStr, wh.start, calendar.timeZone),
        end: zonedWallTimeToUtc(dateStr, wh.end, calendar.timeZone),
      }))
      .sort((a, b) => a.start.getTime() - b.start.getTime());
    this.intervalsCache.set(cacheKey, intervals);
    return intervals;
  }

  /** Adds (or subtracts, if minutes < 0) working minutes to a UTC instant per the given calendar. */
  addWorkingMinutes(start: Date, minutes: number, calendarId: string): Date {
    if (minutes === 0) return start;
    const calendar = this.resolve(calendarId);
    const forward = minutes > 0;
    let remaining = Math.abs(minutes);
    let cursor = start;
    let dateStr = utcToZonedDateStr(cursor, calendar.timeZone);

    for (let iterations = 0; iterations < MAX_DAY_ITERATIONS; iterations++) {
      const intervals = this.intervalsForDate(calendarId, dateStr);
      const ordered = forward ? intervals : [...intervals].reverse();

      for (const interval of ordered) {
        if (forward) {
          if (cursor.getTime() >= interval.end.getTime()) continue;
          const segStart = cursor.getTime() > interval.start.getTime() ? cursor : interval.start;
          const capacityMin = (interval.end.getTime() - segStart.getTime()) / 60_000;
          if (capacityMin <= 0) continue;
          if (remaining <= capacityMin) {
            return new Date(segStart.getTime() + remaining * 60_000);
          }
          remaining -= capacityMin;
          cursor = interval.end;
        } else {
          if (cursor.getTime() <= interval.start.getTime()) continue;
          const segEnd = cursor.getTime() < interval.end.getTime() ? cursor : interval.end;
          const capacityMin = (segEnd.getTime() - interval.start.getTime()) / 60_000;
          if (capacityMin <= 0) continue;
          if (remaining <= capacityMin) {
            return new Date(segEnd.getTime() - remaining * 60_000);
          }
          remaining -= capacityMin;
          cursor = interval.start;
        }
      }

      if (forward) {
        dateStr = addDaysToDateStr(dateStr, 1);
        cursor = zonedWallTimeToUtc(dateStr, "00:00", calendar.timeZone);
      } else {
        // The start-of-`dateStr` boundary is also the end boundary of the
        // previous day, which is what backward consumption needs as its cursor.
        cursor = zonedWallTimeToUtc(dateStr, "00:00", calendar.timeZone);
        dateStr = addDaysToDateStr(dateStr, -1);
      }
    }

    throw new Error(`addWorkingMinutes exceeded ${MAX_DAY_ITERATIONS} day iterations; calendar may have no working time`);
  }

  private weekdayMinutesFor(calendarId: string): number[] {
    const cached = this.weekdayMinutesCache.get(calendarId);
    if (cached) return cached;
    const calendar = this.resolve(calendarId);
    const perWeekday = new Array(7).fill(0) as number[];
    for (let weekday = 0; weekday < 7; weekday++) {
      if (calendar.workingDays[weekday] === false) continue;
      perWeekday[weekday] = sumWorkingHoursMinutes(calendar.workingHours);
    }
    this.weekdayMinutesCache.set(calendarId, perWeekday);
    return perWeekday;
  }

  /**
   * Working minutes between two UTC instants (negative if end precedes
   * start). The two boundary days are computed precisely (interval
   * clipping); everything strictly in between is computed in closed form
   * from the calendar's weekly pattern plus any exceptions that fall in
   * range, rather than iterating day by day — this keeps float/variance
   * calculations fast even when a task has months of slack (docs/PRD.md §18:
   * "No quadratic algorithm on common task-edit paths").
   */
  workingMinutesBetween(start: Date, end: Date, calendarId: string): number {
    if (end.getTime() < start.getTime()) {
      return -this.workingMinutesBetween(end, start, calendarId);
    }
    const calendar = this.resolve(calendarId);
    const tz = calendar.timeZone;
    const startDateStr = utcToZonedDateStr(start, tz);
    const endDateStr = utcToZonedDateStr(end, tz);

    const clip = (dateStr: string, lower: Date, upper: Date): number => {
      let minutes = 0;
      for (const interval of this.intervalsForDate(calendarId, dateStr)) {
        const segStart = interval.start.getTime() > lower.getTime() ? interval.start : lower;
        const segEnd = interval.end.getTime() < upper.getTime() ? interval.end : upper;
        if (segEnd.getTime() > segStart.getTime()) minutes += (segEnd.getTime() - segStart.getTime()) / 60_000;
      }
      return minutes;
    };

    if (startDateStr === endDateStr) {
      return clip(startDateStr, start, end);
    }

    const MAX_DATE = new Date(8.64e15);
    const MIN_DATE = new Date(-8.64e15);
    let total = clip(startDateStr, start, MAX_DATE);
    total += clip(endDateStr, MIN_DATE, end);

    const d0 = dateStrToDayIndex(startDateStr) + 1;
    const d1 = dateStrToDayIndex(endDateStr) - 1;
    if (d1 >= d0) {
      const weekdayMinutes = this.weekdayMinutesFor(calendarId);
      const weekTotal = weekdayMinutes.reduce((a, b) => a + b, 0);
      const n = d1 - d0 + 1;
      const fullWeeks = Math.floor(n / 7);
      total += fullWeeks * weekTotal;
      const remainderDays = n - fullWeeks * 7;
      for (let i = 0; i < remainderDays; i++) {
        total += weekdayMinutes[dayIndexWeekday(d0 + i)];
      }
      for (const exception of calendar.exceptions) {
        const idx = dateStrToDayIndex(exception.date);
        if (idx < d0 || idx > d1) continue;
        const standard = weekdayMinutes[dayIndexWeekday(idx)];
        const actual = exception.isWorking ? sumWorkingHoursMinutes(exception.workingHours ?? calendar.workingHours) : 0;
        total += actual - standard;
      }
    }

    return total;
  }

  /**
   * If `instant` falls within a working interval, returns it unchanged;
   * otherwise returns the next instant that is (e.g. rolls a predecessor's
   * exact-boundary finish, like 17:00 Friday, forward to Monday 09:00 so it
   * is usable as a successor's start).
   */
  ceilToWorkingInstant(instant: Date, calendarId: string): Date {
    const calendar = this.resolve(calendarId);
    let cursor = instant;
    let dateStr = utcToZonedDateStr(cursor, calendar.timeZone);

    for (let iterations = 0; iterations < MAX_DAY_ITERATIONS; iterations++) {
      const intervals = this.intervalsForDate(calendarId, dateStr);
      for (const interval of intervals) {
        if (cursor.getTime() >= interval.start.getTime() && cursor.getTime() < interval.end.getTime()) {
          return cursor;
        }
        if (interval.start.getTime() > cursor.getTime()) {
          return interval.start;
        }
      }
      dateStr = addDaysToDateStr(dateStr, 1);
      cursor = zonedWallTimeToUtc(dateStr, "00:00", calendar.timeZone);
    }

    throw new Error(`ceilToWorkingInstant exceeded ${MAX_DAY_ITERATIONS} day iterations; calendar may have no working time`);
  }

  isWorkingDay(instant: Date, calendarId: string): boolean {
    const calendar = this.resolve(calendarId);
    const dateStr = utcToZonedDateStr(instant, calendar.timeZone);
    return this.rawWorkingHoursForDate(calendar, dateStr).length > 0;
  }
}

export { utcToZonedWeekday };
