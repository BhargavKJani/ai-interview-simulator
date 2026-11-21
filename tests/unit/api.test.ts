import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const create = vi.fn();
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create };
  },
}));

const { evaluateHandler, questionHandler, statusHandler } = await import("@/lib/api-handlers");

const question = { id: "q1", text: "Explain the Android Activity lifecycle.", keywords: ["oncreate", "onresume", "onpause", "ondestroy"], hint: "List callbacks." };

describe("demo mode (no API key)", () => {
  beforeEach(() => vi.stubEnv("ANTHROPIC_API_KEY", ""));
  afterEach(() => { vi.unstubAllEnvs(); create.mockReset(); });

  it("reports demo status", () => {
    expect(statusHandler().body).toEqual({ ai: false, mode: "demo", model: null });
  });

  it("rejects invalid input", async () => {
    expect((await questionHandler({ role: "x", difficulty: "mid" })).status).toBe(400);
    expect((await evaluateHandler({ role: "android", difficulty: "mid", question, answer: 3 })).status).toBe(400);
    expect((await evaluateHandler({ role: "android", difficulty: "mid", question: { text: 1 }, answer: "a" })).status).toBe(400);
  });

  it("serves deterministic bank questions without calling the API", async () => {
    const a = await questionHandler({ role: "android", difficulty: "junior", index: 1, seed: 9 });
    const b = await questionHandler({ role: "android", difficulty: "junior", index: 1, seed: 9 });
    expect(a.status).toBe(200);
    expect(a.body).toEqual(b.body);
    expect((a.body as { mode: string }).mode).toBe("demo");
    expect(create).not.toHaveBeenCalled();
  });

  it("scores answers locally", async () => {
    const res = await evaluateHandler({ role: "android", difficulty: "junior", question, answer: "onCreate runs first, then onStart and onResume. When leaving, onPause, onStop and onDestroy run." });
    expect(res.status).toBe(200);
    const body = res.body as { mode: string; evaluation: { overall: number } };
    expect(body.mode).toBe("demo");
    expect(body.evaluation.overall).toBeGreaterThan(40);
  });
});

describe("AI mode (Claude)", () => {
  beforeEach(() => vi.stubEnv("ANTHROPIC_API_KEY", "sk-test"));
  afterEach(() => { vi.unstubAllEnvs(); create.mockReset(); });

  it("uses the tool result from Claude", async () => {
    create.mockResolvedValue({
      content: [{ type: "tool_use", name: "submit_evaluation", input: { scores: { clarity: 9, depth: 8, relevance: 10 }, feedback: "Great", strengths: ["s"], improvements: ["i"], modelAnswer: "m" } }],
    });
    const res = await evaluateHandler({ role: "android", difficulty: "mid", question, answer: "Some answer" });
    const body = res.body as { mode: string; evaluation: { overall: number; feedback: string } };
    expect(body.mode).toBe("ai");
    expect(body.evaluation.feedback).toBe("Great");
    expect(body.evaluation.overall).toBe(91);
    expect(create.mock.calls[0][0].model).toBe("claude-sonnet-5-5");
  });

  it("generates adaptive questions", async () => {
    create.mockResolvedValue({ content: [{ type: "tool_use", name: "ask_question", input: { text: "Tell me about Compose.", keywords: ["state"], hint: "h" } }] });
    const res = await questionHandler({ role: "android", difficulty: "mid", index: 2, previous: [{ question: "a", answer: "b" }] });
    expect((res.body as { mode: string; question: { text: string } }).question.text).toBe("Tell me about Compose.");
  });

  it("falls back to the demo engine when Claude fails", async () => {
    create.mockRejectedValue(new Error("rate limited"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const q = await questionHandler({ role: "android", difficulty: "mid", index: 0, seed: 1 });
    const e = await evaluateHandler({ role: "android", difficulty: "mid", question, answer: "onCreate onResume" });
    expect((q.body as { mode: string }).mode).toBe("demo");
    expect((e.body as { mode: string }).mode).toBe("demo");
  });
});
