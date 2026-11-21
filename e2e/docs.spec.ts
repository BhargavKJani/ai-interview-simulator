/**
 * Captures README screenshots + GIF frames into docs/. Skipped unless DOCS=1:
 *   DOCS=1 npx playwright test e2e/docs.spec.ts && node scripts/make-gif.mjs
 */
import fs from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { ANSWERS } from "./helpers";

test.skip(!process.env.DOCS, "docs capture only");
test.use({ viewport: { width: 1280, height: 800 } });

const FRAMES = "docs/frames";
let frame = 0;
const snap = async (page: Page, hold = 1) => {
  fs.mkdirSync(FRAMES, { recursive: true });
  await page.waitForTimeout(450);
  const buf = await page.screenshot();
  for (let i = 0; i < hold; i++) fs.writeFileSync(`${FRAMES}/${String(frame++).padStart(3, "0")}.png`, buf);
};

const seedHistory = async (page: Page) => {
  await page.evaluate(() => {
    const roles = ["frontend", "android", "data-analyst", "hr", "frontend", "android", "frontend", "hr"];
    const overalls = [42, 51, 55, 63, 61, 70, 74, 82];
    const list = overalls.map((o, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (overalls.length - 1 - i));
      const sc = (v: number) => Math.round(v * 10) / 10;
      const iso = d.toISOString();
      return {
        id: `seed-${i}`, role: roles[i], difficulty: i > 4 ? "mid" : "junior", startedAt: iso, finishedAt: iso, mode: "demo",
        turns: [0, 1, 2].map((k) => ({
          question: { id: `q${i}${k}`, text: ["Tell me about yourself.", "Explain the CSS box model.", "How do you handle missing values?"][k], keywords: [], hint: "Structure it with STAR." },
          answer: "Sample answer from an earlier practice session.", durationSec: 70, inputMode: k ? "text" : "voice",
          evaluation: {
            scores: { clarity: sc(o / 10 + 0.4), depth: sc(o / 10 - 0.8), relevance: sc(Math.min(10, o / 10 + 0.6)) }, overall: o + k - 1,
            feedback: "Solid answer with room for a sharper example.", strengths: ["Clear, well-structured delivery."], improvements: ["Add a concrete metric or trade-off."], modelAnswer: "Headline, two points, one example.",
          },
        })),
      };
    });
    localStorage.setItem("ais.history.v1", JSON.stringify(list.reverse()));
  });
};

test("capture screenshots and gif frames", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/");
  await page.waitForTimeout(800);
  await page.screenshot({ path: "docs/landing.png" });
  await snap(page, 3);
  await page.screenshot({ path: "docs/landing-full.png", fullPage: true });

  await page.locator("#pricing").scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await page.screenshot({ path: "docs/pricing.png" });

  await page.goto("/interview");
  await page.getByTestId("role-frontend").click();
  await page.getByTestId("difficulty-mid").click();
  await page.getByTestId("count-3").click();
  await page.getByTestId("mode-text").click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: "docs/setup.png" });
  await snap(page, 2);

  // Build a realistic, on-topic answer from the question's expected concepts.
  const answerFor = (k: string[]) =>
    `In short, it comes down to ${k.slice(0, 2).join(" and ")}. First, I would look at ${k[2] ?? k[0]} because it drives most of the impact. ` +
    `For example, on my last project we measured a 35% improvement after tuning ${k[3] ?? k[1]}. ` +
    `However, there is a trade-off with ${k[4] ?? k[0]}, so I validate it with metrics before rolling it out. Finally, I document the result for the team.`;
  let keywords: string[] = [];
  page.on("response", async (r) => {
    if (r.url().includes("/api/interview/question")) keywords = (await r.json()).question.keywords;
  });

  await page.getByTestId("start-btn").click();
  for (let i = 0; i < 3; i++) {
    await expect(page.getByTestId("question-text")).not.toBeEmpty();
    const answer = i === 1 ? ANSWERS[1] : answerFor(keywords);
    await snap(page, 2);
    await page.getByTestId("answer-input").pressSequentially(answer.slice(0, 90), { delay: 4 });
    await page.getByTestId("answer-input").fill(answer);
    await snap(page, 2);
    if (i === 0) await page.screenshot({ path: "docs/interview.png" });
    await page.getByTestId("submit-answer").click();
    await expect(page.getByTestId("eval-panel")).toBeVisible();
    await page.waitForTimeout(1100);
    await snap(page, 3);
    if (i === 0) await page.screenshot({ path: "docs/feedback.png" });
    if (i < 2) await page.getByTestId("next-question").click();
  }
  await page.getByTestId("finish-btn").click();
  await expect(page.getByTestId("report-card")).toBeVisible();
  await page.waitForTimeout(1400);
  await page.screenshot({ path: "docs/report.png" });
  await snap(page, 4);

  await seedHistory(page);
  await page.goto("/dashboard");
  await expect(page.getByTestId("dashboard")).toBeVisible();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: "docs/dashboard.png" });
  await snap(page, 4);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.waitForTimeout(800);
  await page.screenshot({ path: "docs/mobile.png" });
});
