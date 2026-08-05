// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { axe } from "vitest-axe";
import { PlannerWorkspace } from "@/app/PlannerWorkspace";
import { sampleCalendar, sampleDependencies, sampleTasks } from "@/app/sampleData";

describe("PlannerWorkspace accessibility", () => {
  it("has no automatically detectable accessibility violations", async () => {
    const { container } = render(
      <PlannerWorkspace tasks={sampleTasks} dependencies={sampleDependencies} calendars={[sampleCalendar]} />,
    );
    const results = await axe(container);
    if (results.violations.length > 0) {
      const summary = results.violations.map((v) => `${v.id} (${v.impact}): ${v.help} — ${v.nodes.length} node(s)`).join("\n");
      throw new Error(`accessibility violations found:\n${summary}`);
    }
    expect(results.violations).toHaveLength(0);
  }, 15000);
});
