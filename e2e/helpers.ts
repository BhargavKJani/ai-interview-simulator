import { expect, type Page } from "@playwright/test";

export const ANSWERS = [
  "First, I would explain the core idea clearly. For example, in my last project I measured the impact and reduced load time by 40%. " +
    "However, there is a trade-off between speed and complexity, so I chose the simplest approach that met the goal. Finally, I documented the result for the team.",
  "In short, it depends on scope and state. Because each option has costs, I compare them with metrics, then pick one and monitor it in production with alerts and tests.",
  "I would start with the user problem, then list two or three options, explain the trade-offs and finally recommend one with a measurable success metric.",
];

/** Run a complete text-mode interview of `count` questions from the setup screen. */
export async function runInterview(page: Page, opts: { role?: string; difficulty?: string; count?: number } = {}) {
  const { role = "frontend", difficulty = "junior", count = 3 } = opts;
  await page.goto("/interview");
  await page.getByTestId(`role-${role}`).click();
  await page.getByTestId(`difficulty-${difficulty}`).click();
  await page.getByTestId(`count-${count}`).click();
  await page.getByTestId("mode-text").click();
  await page.getByTestId("start-btn").click();

  for (let i = 0; i < count; i++) {
    await expect(page.getByTestId("progress-label")).toHaveText(`Question ${i + 1} / ${count}`);
    await expect(page.getByTestId("question-text")).not.toBeEmpty();
    await page.getByTestId("answer-input").fill(ANSWERS[i % ANSWERS.length]);
    await page.getByTestId("submit-answer").click();
    await expect(page.getByTestId("eval-panel")).toBeVisible();
    if (i < count - 1) await page.getByTestId("next-question").click();
  }
  await page.getByTestId("finish-btn").click();
  await expect(page.getByTestId("report-card")).toBeVisible();
}
