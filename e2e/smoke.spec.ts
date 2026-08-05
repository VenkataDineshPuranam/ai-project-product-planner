import { expect, test } from "@playwright/test";

test("app loads and renders the grid/Gantt split view against the sample data", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(err.message));

  await page.goto("/");

  await expect(page.getByRole("treegrid", { name: "Task list" })).toBeVisible();
  await expect(page.getByRole("img", { name: "Gantt timeline" })).toBeVisible();
  await expect(page.getByText("Design API")).toBeVisible();
  await expect(page.getByText("Build Endpoint")).toBeVisible();

  expect(consoleErrors).toEqual([]);
});

test("grid and Gantt selection stay in sync via a real click", async ({ page }) => {
  await page.goto("/");

  await page.getByText("Build Endpoint").click();
  const row = page.getByTestId("task-row-task-build");
  await expect(row).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("gantt-bar-task-build")).toHaveAttribute("data-selected", "true");
});

test("makes no runtime network requests during use, and keeps working once offline", async ({ page, context }) => {
  const requestUrls: string[] = [];
  page.on("request", (req) => requestUrls.push(req.url()));

  await page.goto("/");
  await expect(page.getByRole("treegrid")).toBeVisible();
  requestUrls.length = 0; // only care about requests made *after* initial load

  await context.setOffline(true);
  await page.getByText("Build Endpoint").click();
  await expect(page.getByTestId("task-row-task-build")).toHaveAttribute("aria-selected", "true");

  // No XHR/fetch/navigation happened as a result of interacting with the
  // already-loaded app — confirms the "no runtime network dependency" claim
  // for in-session use. A hard reload with zero connectivity is a separate
  // guarantee that would require a service worker, which is not in v1 scope
  // (see README's Stage 9 residual risks) — not tested here.
  expect(requestUrls).toEqual([]);
});
