import { describe, expect, it } from "vitest";
import { exportTasksToCsv, parseTasksCsv } from "@/import-export/csvTasks";
import type { Task } from "@/domain";

const task: Task = {
  id: "task-1",
  projectId: "proj-1",
  parentId: null,
  wbsCode: "1.1",
  sequence: 1,
  name: "Design API",
  schedulingMode: "auto",
  isSummary: false,
  isMilestone: false,
  start: "2026-01-19T14:00:00.000Z",
  finish: "2026-01-19T22:00:00.000Z",
  durationMinutes: 480,
  workMinutes: 480,
  remainingWorkMinutes: 480,
  percentComplete: 40,
  constraintType: "ASAP",
  calendarId: "cal-1",
  priority: 500,
  fixedCost: 0,
  costAccrual: "prorated",
  status: "in-progress",
  tags: [],
};

describe("exportTasksToCsv", () => {
  it("produces a header row plus one row per task", () => {
    const csv = exportTasksToCsv([task]);
    const lines = csv.trim().split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain("id");
    expect(lines[1]).toContain("task-1");
  });

  it("neutralizes a formula-injection payload in a text field on export", () => {
    const malicious: Task = { ...task, name: "=cmd|'/C calc'!A1" };
    const csv = exportTasksToCsv([malicious]);
    expect(csv).not.toContain("\n=cmd");
    expect(csv).toContain("'=cmd");
  });

  it("quotes fields containing commas", () => {
    const withComma: Task = { ...task, name: "Design, then build" };
    const csv = exportTasksToCsv([withComma]);
    expect(csv).toContain('"Design, then build"');
  });
});

describe("parseTasksCsv", () => {
  it("round-trips a valid exported CSV back into task updates", () => {
    const csv = exportTasksToCsv([task]);
    const result = parseTasksCsv(csv);
    expect(result.errors).toHaveLength(0);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({ id: "task-1", name: "Design API", percentComplete: 40, status: "in-progress" });
  });

  it("reports a row-level error for an invalid percentComplete without dropping other valid rows", () => {
    const csv = exportTasksToCsv([task, { ...task, id: "task-2", name: "Task Two" }]).replace("40", "150");
    const result = parseTasksCsv(csv);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].row).toBe(2); // header is row 1, first data row is row 2
  });

  it("reports a row-level error for an invalid date without throwing", () => {
    const csv = exportTasksToCsv([task]).replace("2026-01-19T14:00:00.000Z", "not-a-date");
    const result = parseTasksCsv(csv);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toMatch(/date/i);
  });

  it("never treats a formula-looking cell as executable content, only as text", () => {
    const csv = 'id,wbsCode,name,start,finish,durationMinutes,percentComplete,status\ntask-1,1,"\'=SUM(A1:A9)",2026-01-19T14:00:00.000Z,2026-01-19T22:00:00.000Z,480,0,not-started\n';
    const result = parseTasksCsv(csv);
    expect(result.errors).toHaveLength(0);
    expect(result.rows[0].name).toBe("'=SUM(A1:A9)");
  });
});
