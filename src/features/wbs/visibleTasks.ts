import type { Task } from "@/domain";

export interface TaskTreeNode {
  task: Task;
  depth: number;
}

/** Depth-first WBS order (parent immediately followed by its children, sorted by `sequence`). */
export function buildTaskTreeOrder(tasks: Task[]): TaskTreeNode[] {
  const childrenOf = new Map<string | null, Task[]>();
  for (const task of tasks) {
    const key = task.parentId;
    if (!childrenOf.has(key)) childrenOf.set(key, []);
    childrenOf.get(key)!.push(task);
  }
  for (const siblings of childrenOf.values()) {
    siblings.sort((a, b) => a.sequence - b.sequence);
  }

  const result: TaskTreeNode[] = [];
  function visit(parentId: string | null, depth: number) {
    for (const task of childrenOf.get(parentId) ?? []) {
      result.push({ task, depth });
      visit(task.id, depth + 1);
    }
  }
  visit(null, 0);
  return result;
}

/** Tree order with the subtrees of any collapsed (id present in `collapsedIds`) summary task removed. */
export function visibleTasks(tasks: Task[], collapsedIds: Set<string>): TaskTreeNode[] {
  const all = buildTaskTreeOrder(tasks);
  const hiddenAncestors = new Set<string>();
  const result: TaskTreeNode[] = [];

  for (const node of all) {
    if (node.task.parentId && hiddenAncestors.has(node.task.parentId)) {
      hiddenAncestors.add(node.task.id);
      continue;
    }
    result.push(node);
    if (collapsedIds.has(node.task.id)) {
      hiddenAncestors.add(node.task.id);
    }
  }

  return result;
}
