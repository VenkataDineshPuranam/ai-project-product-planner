export interface Migration {
  from: number;
  to: number;
  migrate: (doc: Record<string, unknown>) => Record<string, unknown>;
}

function currentVersionOf(doc: Record<string, unknown>): number {
  const version = doc.schemaVersion;
  if (typeof version !== "number") {
    throw new Error("document is missing a numeric schemaVersion field");
  }
  return version;
}

/**
 * Applies migrations one version step at a time until the document reaches
 * targetVersion. Throws if no contiguous migration path exists.
 */
export function migrateDocument(
  doc: Record<string, unknown>,
  migrations: Migration[],
  targetVersion: number,
): Record<string, unknown> {
  let current = doc;
  let version = currentVersionOf(current);

  while (version < targetVersion) {
    const step = migrations.find((m) => m.from === version);
    if (!step) {
      throw new Error(`no migration found from schema version ${version} toward ${targetVersion}`);
    }
    current = step.migrate(current);
    version = currentVersionOf(current);
  }

  if (version > targetVersion) {
    throw new Error(`document schema version ${version} is newer than target ${targetVersion}`);
  }

  return current;
}
