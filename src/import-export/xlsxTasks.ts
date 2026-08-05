import * as XLSX from "xlsx";
import type { Task } from "@/domain";
import { CSV_COLUMNS, guardFormulaInjection } from "./csvTasks";

/**
 * XLSX export only (no import) — see docs/SECURITY_AND_PRIVACY.md §4. This
 * module must never call XLSX.read/readFile on untrusted input.
 */
export function exportTasksToXlsx(tasks: Task[]): Uint8Array {
  const rows = tasks.map((task) => ({
    id: task.id,
    wbsCode: task.wbsCode,
    name: guardFormulaInjection(task.name),
    start: task.start,
    finish: task.finish,
    durationMinutes: task.durationMinutes,
    percentComplete: task.percentComplete,
    status: task.status,
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows, { header: [...CSV_COLUMNS] });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Tasks");
  const written = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  return new Uint8Array(written);
}
