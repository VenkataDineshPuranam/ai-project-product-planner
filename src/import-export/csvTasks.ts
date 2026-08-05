import type { Task } from "@/domain";

export const CSV_COLUMNS = ["id", "wbsCode", "name", "start", "finish", "durationMinutes", "percentComplete", "status"] as const;

const ALLOWED_STATUSES = new Set(["not-started", "in-progress", "blocked", "complete", "cancelled"]);

/** Cells beginning with a character a spreadsheet would interpret as a formula are neutralized on export. */
export function guardFormulaInjection(value: string): string {
  if (/^[=+\-@\t\r]/.test(value)) {
    return `'${value}`;
  }
  return value;
}

function csvEscape(rawValue: string): string {
  const value = guardFormulaInjection(rawValue);
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function exportTasksToCsv(tasks: Task[]): string {
  const header = CSV_COLUMNS.join(",");
  const rows = tasks.map((task) =>
    [
      task.id,
      task.wbsCode,
      task.name,
      task.start,
      task.finish,
      String(task.durationMinutes),
      String(task.percentComplete),
      task.status,
    ]
      .map((v, i) => (CSV_COLUMNS[i] === "name" ? csvEscape(v) : v))
      .join(","),
  );
  return [header, ...rows].join("\n") + "\n";
}

/** Splits CSV text into rows of raw string cells, honoring quoted fields with embedded commas/quotes/newlines. */
function parseCsvLines(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => !(r.length === 1 && r[0] === ""));
}

export interface CsvRowError {
  row: number;
  message: string;
}

export interface TaskCsvUpdate {
  id: string;
  wbsCode: string;
  name: string;
  start: string;
  finish: string;
  durationMinutes: number;
  percentComplete: number;
  status: Task["status"];
}

export interface ParseTasksCsvResult {
  rows: TaskCsvUpdate[];
  errors: CsvRowError[];
}

export function parseTasksCsv(csv: string): ParseTasksCsvResult {
  const lines = parseCsvLines(csv);
  const rows: TaskCsvUpdate[] = [];
  const errors: CsvRowError[] = [];
  if (lines.length === 0) return { rows, errors };

  const header = lines[0];
  const colIndex = new Map(header.map((name, i) => [name, i]));

  for (let i = 1; i < lines.length; i++) {
    const rowNumber = i + 1; // 1-based, header is row 1
    const cells = lines[i];
    const get = (col: (typeof CSV_COLUMNS)[number]) => cells[colIndex.get(col) ?? -1] ?? "";

    const id = get("id");
    if (!id) {
      errors.push({ row: rowNumber, message: "id is required" });
      continue;
    }

    const name = get("name");
    if (!name) {
      errors.push({ row: rowNumber, message: "name is required" });
      continue;
    }

    const start = get("start");
    const finish = get("finish");
    if (Number.isNaN(Date.parse(start))) {
      errors.push({ row: rowNumber, message: `invalid start date: "${start}"` });
      continue;
    }
    if (Number.isNaN(Date.parse(finish))) {
      errors.push({ row: rowNumber, message: `invalid finish date: "${finish}"` });
      continue;
    }

    const durationMinutes = Number(get("durationMinutes"));
    if (!Number.isFinite(durationMinutes) || durationMinutes < 0) {
      errors.push({ row: rowNumber, message: `invalid durationMinutes: "${get("durationMinutes")}"` });
      continue;
    }

    const percentComplete = Number(get("percentComplete"));
    if (!Number.isFinite(percentComplete) || percentComplete < 0 || percentComplete > 100) {
      errors.push({ row: rowNumber, message: `percentComplete must be between 0 and 100: "${get("percentComplete")}"` });
      continue;
    }

    const status = get("status");
    if (!ALLOWED_STATUSES.has(status)) {
      errors.push({ row: rowNumber, message: `unknown status: "${status}"` });
      continue;
    }

    rows.push({
      id,
      wbsCode: get("wbsCode"),
      name,
      start,
      finish,
      durationMinutes,
      percentComplete,
      status: status as Task["status"],
    });
  }

  return { rows, errors };
}
