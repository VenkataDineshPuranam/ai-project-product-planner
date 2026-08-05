import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { exportTasksToXlsx } from "@/import-export/xlsxTasks";
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

describe("exportTasksToXlsx", () => {
  it("produces a workbook with a Tasks sheet readable back with the same data", () => {
    const buffer = exportTasksToXlsx([task]);
    const workbook = XLSX.read(buffer, { type: "array" });
    expect(workbook.SheetNames).toContain("Tasks");
    const sheet = workbook.Sheets["Tasks"];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: "task-1", name: "Design API", percentComplete: 40, status: "in-progress" });
  });

  it("stores a formula-like name as neutralized text, not as an executable formula cell", () => {
    const malicious: Task = { ...task, name: "=cmd|'/C calc'!A1" };
    const buffer = exportTasksToXlsx([malicious]);
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheet = workbook.Sheets["Tasks"];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
    expect(rows[0].name).toBe("'=cmd|'/C calc'!A1");

    // Confirm the underlying cell type is a plain string, never a formula ("f") cell.
    const nameColLetter = Object.keys(sheet).find((addr) => {
      const cell = sheet[addr];
      return typeof cell?.v === "string" && String(cell.v).includes("cmd");
    });
    expect(nameColLetter).toBeDefined();
    expect(sheet[nameColLetter!].f).toBeUndefined();
  });
});
