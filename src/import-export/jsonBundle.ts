import { z } from "zod";
import type { Assignment, Baseline, Calendar, Dependency, Project, Resource, Task } from "@/domain";
import { assignmentSchema, baselineSchema, calendarSchema, dependencySchema, projectSchema, resourceSchema, taskSchema } from "@/validation/schemas";

export const BUNDLE_SCHEMA_VERSION = 1;

export interface ProjectBundleInput {
  project: Project;
  tasks: Task[];
  dependencies: Dependency[];
  calendars: Calendar[];
  resources: Resource[];
  assignments: Assignment[];
  baselines: Baseline[];
}

export interface ProjectBundle extends ProjectBundleInput {
  schemaVersion: number;
  exportedAt: string;
}

const bundleSchema = z.object({
  schemaVersion: z.number().int().positive(),
  exportedAt: z.string(),
  project: projectSchema,
  tasks: z.array(taskSchema),
  dependencies: z.array(dependencySchema),
  calendars: z.array(calendarSchema),
  resources: z.array(resourceSchema),
  assignments: z.array(assignmentSchema),
  baselines: z.array(baselineSchema),
});

export function exportProjectBundle(input: ProjectBundleInput): string {
  const bundle: ProjectBundle = {
    schemaVersion: BUNDLE_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    ...input,
  };
  return JSON.stringify(bundle, null, 2);
}

function checkReferentialIntegrity(bundle: ProjectBundle): string[] {
  const errors: string[] = [];
  const taskIds = new Set(bundle.tasks.map((t) => t.id));
  const resourceIds = new Set(bundle.resources.map((r) => r.id));

  for (const dep of bundle.dependencies) {
    if (!taskIds.has(dep.predecessorTaskId)) {
      errors.push(`dependency ${dep.id} references unknown predecessor task "${dep.predecessorTaskId}"`);
    }
    if (!taskIds.has(dep.successorTaskId)) {
      errors.push(`dependency ${dep.id} references unknown successor task "${dep.successorTaskId}"`);
    }
  }
  for (const assignment of bundle.assignments) {
    if (!taskIds.has(assignment.taskId)) {
      errors.push(`assignment ${assignment.id} references unknown task "${assignment.taskId}"`);
    }
    if (!resourceIds.has(assignment.resourceId)) {
      errors.push(`assignment ${assignment.id} references unknown resource "${assignment.resourceId}"`);
    }
  }
  return errors;
}

export function importProjectBundle(json: string): ProjectBundle {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error("import failed: the file is not valid JSON");
  }

  const parsed = bundleSchema.parse(raw);
  const referenceErrors = checkReferentialIntegrity(parsed);
  if (referenceErrors.length > 0) {
    throw new Error(`import failed: broken references —\n${referenceErrors.join("\n")}`);
  }

  return parsed;
}
