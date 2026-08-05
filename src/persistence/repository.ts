import type { IDBPDatabase } from "idb";
import type { ZodType } from "zod";
import type { StoreName } from "./db";

export interface QuarantinedRecord {
  id: string;
  raw: unknown;
  reason: string;
}

export interface Repository<T extends { id: string }> {
  getById(id: string): Promise<T | undefined>;
  getAll(): Promise<T[]>;
  getAllWithQuarantine(): Promise<{ valid: T[]; quarantined: QuarantinedRecord[] }>;
  put(record: unknown): Promise<T>;
  putMany(records: unknown[]): Promise<T[]>;
  delete(id: string): Promise<void>;
  clear(): Promise<void>;
}

export function createRepository<T extends { id: string }>(
  db: IDBPDatabase,
  storeName: StoreName,
  schema: ZodType<T>,
): Repository<T> {
  return {
    async getById(id) {
      const raw = await db.get(storeName, id);
      if (raw === undefined) return undefined;
      return schema.parse(raw);
    },

    async getAll() {
      const raw = await db.getAll(storeName);
      return raw.map((r) => schema.parse(r));
    },

    async getAllWithQuarantine() {
      const raw = await db.getAll(storeName);
      const valid: T[] = [];
      const quarantined: QuarantinedRecord[] = [];
      for (const record of raw) {
        const result = schema.safeParse(record);
        if (result.success) {
          valid.push(result.data);
        } else {
          const id = typeof (record as { id?: unknown })?.id === "string" ? (record as { id: string }).id : "unknown";
          quarantined.push({ id, raw: record, reason: result.error.message });
        }
      }
      return { valid, quarantined };
    },

    async put(record) {
      const parsed = schema.parse(record);
      await db.put(storeName, parsed);
      return parsed;
    },

    async putMany(records) {
      const parsed = records.map((r) => schema.parse(r));
      const tx = db.transaction(storeName, "readwrite");
      await Promise.all(parsed.map((r) => tx.store.put(r)));
      await tx.done;
      return parsed;
    },

    async delete(id) {
      await db.delete(storeName, id);
    },

    async clear() {
      await db.clear(storeName);
    },
  };
}
