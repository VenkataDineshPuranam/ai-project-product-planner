export type ScheduleError =
  | { code: "CYCLE"; taskIds: string[] }
  | { code: "INVALID_CONSTRAINT"; taskId: string; reason: string }
  | { code: "MISSING_CALENDAR"; taskId: string; calendarId: string }
  | { code: "BROKEN_REFERENCE"; entity: string; id: string; field: string };

export type ScheduleWarning =
  | { code: "DEADLINE_MISSED"; taskId: string; deadline: string; forecastFinish: string }
  | { code: "OVER_ALLOCATION"; resourceId: string; date: string }
  | { code: "MANUAL_TASK_CONFLICT"; taskId: string }
  | { code: "CONSTRAINT_INFEASIBLE"; taskId: string; reason: string };

export interface TaskForecast {
  forecastFinish: string;
  scheduleVarianceMinutes?: number;
}
