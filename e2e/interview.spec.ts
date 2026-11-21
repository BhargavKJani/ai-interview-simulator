import { expect, test } from "@playwright/test";
import { runInterview } from "./helpers";

test("landing page shows hero and pricing", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Ace your next");
  await expect(page.getByTestId("plan-free")).toContainText("₹0");
  await expect(page.getByTestId("plan-pro")).toContainText("₹399");
  await page.getByTestId("hero-cta").click();
  await expect(page).toHaveURL(/\/interview/);
});

test("demo status endpoint works without an API key", async ({ request }) => {
  const res = await request.get("/api/status");
  expect(await res.json()).toMatchObject({ ai: false, mode: "demo" });
});

test("full interview → report card → dashboard", async ({ page }) => {
  await page.goto("/interview");
  await expect(page.getByText("Demo mode")).toBeVisible();
  await runInterview(page, { role: "android", difficulty: "mid", count: 3 });

  const score = Number(await page.getByTestId("overall-score").textContent());
  expect(score).toBeGreaterThan(0);
  expect(score).toBeLessThanOrEqual(100);
  await expect(page.getByTestId("hire-signal")).not.toBeEmpty();
  await expect(page.getByTestId("report-card")).toContainText("Android Developer");

  await page.getByTestId("go-dashboard").click();
  await expect(page.getByTestId("dashboard")).toBeVisible();
  await expect(page.getByTestId("stat-0")).toHaveText("1");
  await expect(page.getByTestId("history-list").locator("button")).toHaveCount(1);
});

test("free plan limits and Pro upgrade", async ({ page }) => {
  await page.goto("/interview");
  await page.getByTestId("role-backend").click();
  await expect(page.getByTestId("upgrade-cta")).toBeVisible();
  await expect(page.getByTestId("start-btn")).toHaveCount(0);

  await page.goto("/pricing");
  await page.getByTestId("go-pro").click();
  await page.getByTestId("confirm-pro").click();
  await expect(page.getByTestId("plan-badge")).toHaveText("★ Pro");

  await page.goto("/interview");
  await page.getByTestId("role-backend").click();
  await expect(page.getByTestId("start-btn")).toBeEnabled();
  await expect(page.getByTestId("count-10")).toBeVisible();
});

test("daily free limit blocks a 4th interview", async ({ page }) => {
  await page.goto("/interview");
  await page.evaluate(() => {
    const now = new Date().toISOString();
    const s = (id: string) => ({ id, role: "hr", difficulty: "junior", startedAt: now, finishedAt: now, mode: "demo", turns: [] });
    localStorage.setItem("ais.history.v1", JSON.stringify([s("a"), s("b"), s("c")]));
  });
  await page.reload();
  await expect(page.getByTestId("quota")).toContainText("0/3");
  await expect(page.getByTestId("upgrade-cta")).toContainText("Daily limit");
});
