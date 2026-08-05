import { openDB, type IDBPDatabase } from "idb";

export const DB_NAME = "ai-project-product-planner";
export const DB_VERSION = 1;

export const STORE_NAMES = [
  "projects",
  "tasks",
  "dependencies",
  "calendars",
  "resources",
  "assignments",
  "baselines",
  "features",
  "evaluationContracts",
  "evaluationRuns",
  "deploymentGates",
  "approvals",
  "risks",
] as const;

export type StoreName = (typeof STORE_NAMES)[number];

let dbPromise: Promise<IDBPDatabase> | null = null;

export function openPlannerDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        for (const storeName of STORE_NAMES) {
          if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName, { keyPath: "id" });
          }
        }
      },
    });
  }
  return dbPromise;
}

export async function closeDb(): Promise<void> {
  if (dbPromise) {
    const db = await dbPromise;
    db.close();
    dbPromise = null;
  }
}
