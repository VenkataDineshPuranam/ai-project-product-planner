import type { IDBPDatabase } from "idb";
import type { ZodType } from "zod";
import { z } from "zod";
import { STORE_NAMES, type StoreName } from "@/persistence/db";
import {
  assignmentSchema,
  baselineSchema,
  calendarSchema,
  dependencySchema,
  projectSchema,
  resourceSchema,
  taskSchema,
} from "@/validation/schemas";
import {
  approvalSchema,
  deploymentGateSchema,
  evaluationContractSchema,
  evaluationRunSchema,
  featureSchema,
  riskSchema,
} from "@/validation/lifecycleSchemas";

const STORE_SCHEMAS: Record<StoreName, ZodType> = {
  projects: projectSchema,
  tasks: taskSchema,
  dependencies: dependencySchema,
  calendars: calendarSchema,
  resources: resourceSchema,
  assignments: assignmentSchema,
  baselines: baselineSchema,
  features: featureSchema,
  evaluationContracts: evaluationContractSchema,
  evaluationRuns: evaluationRunSchema,
  deploymentGates: deploymentGateSchema,
  approvals: approvalSchema,
  risks: riskSchema,
};

export const BACKUP_SCHEMA_VERSION = 1;

const backupFileSchema = z.object({
  schemaVersion: z.number().int().positive(),
  exportedAt: z.string(),
  stores: z.record(z.string(), z.array(z.unknown())),
});

export async function backupDatabase(db: IDBPDatabase): Promise<string> {
  const stores: Record<string, unknown[]> = {};
  for (const storeName of STORE_NAMES) {
    stores[storeName] = await db.getAll(storeName);
  }
  return JSON.stringify(
    { schemaVersion: BACKUP_SCHEMA_VERSION, exportedAt: new Date().toISOString(), stores },
    null,
    2,
  );
}

export async function restoreDatabase(db: IDBPDatabase, json: string): Promise<void> {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error("restore failed: the backup file is not valid JSON");
  }

  const file = backupFileSchema.parse(raw);

  const validatedByStore = new Map<StoreName, unknown[]>();
  for (const storeName of STORE_NAMES) {
    const records = file.stores[storeName] ?? [];
    const schema = STORE_SCHEMAS[storeName];
    const validated = records.map((record, i) => {
      const result = schema.safeParse(record);
      if (!result.success) {
        throw new Error(`restore failed: store "${storeName}" record ${i} is invalid — ${result.error.message}`);
      }
      return result.data;
    });
    validatedByStore.set(storeName, validated);
  }

  // Every store's records validated successfully — now apply them all in a
  // single transaction so a mid-restore failure can't leave a half-restored
  // database (docs/SECURITY_AND_PRIVACY.md §5).
  const tx = db.transaction(STORE_NAMES, "readwrite");
  await Promise.all(
    [...validatedByStore.entries()].map(async ([storeName, records]) => {
      const store = tx.objectStore(storeName);
      await store.clear();
      for (const record of records) {
        await store.put(record);
      }
    }),
  );
  await tx.done;
}
