import { beforeEach, describe, expect, it } from "vitest";
import {
  canStartInterview, clearHistory, computeStats, FREE_DAILY_LIMIT, getPlan, type KV, loadHistory, practiceStreak, saveSession, sessionsToday, setPlan,
} from "@/lib/history";
import type { InterviewSession } from "@/lib/types";

class MemoryKV implements KV {
  m = new Map<string, string>();
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
}

const session = (id: string, finishedAt: string, overall = 70, role: InterviewSession["role"] = "frontend"): InterviewSession => ({
  id, role, difficulty: "mid", startedAt: finishedAt, finishedAt, mode: "demo",
  turns: [{
    question: { id: "q", text: "Q", keywords: [], hint: "" }, answer: "a", durationSec: 10, inputMode: "text",
    evaluation: { scores: { clarity: overall / 10, depth: overall / 10, relevance: overall / 10 }, overall, feedback: "", strengths: [], improvements: [], modelAnswer: "" },
  }],
});

let kv: MemoryKV;
beforeEach(() => { kv = new MemoryKV(); });

describe("persistence", () => {
  it("saves newest first, de-duplicates and clears", () => {
    saveSession(session("a", "2026-11-20T10:00:00Z"), kv);
    saveSession(session("b", "2026-11-21T10:00:00Z"), kv);
    saveSession(session("a", "2026-11-20T10:00:00Z", 90), kv);
    const h = loadHistory(kv);
    expect(h.map((s) => s.id)).toEqual(["a", "b"]);
    clearHistory(kv);
    expect(loadHistory(kv)).toEqual([]);
  });

  it("survives corrupt storage and missing storage", () => {
    kv.setItem("ais.history.v1", "{not json");
    expect(loadHistory(kv)).toEqual([]);
    expect(loadHistory(null)).toEqual([]);
  });

  it("stores the plan", () => {
    expect(getPlan(kv)).toBe("free");
    setPlan("pro", kv);
    expect(getPlan(kv)).toBe("pro");
  });
});

describe("plan limits", () => {
  const now = new Date(2026, 10, 21, 18, 0, 0);
  const today = (h: number) => new Date(2026, 10, 21, h).toISOString();
  it("counts today's sessions only", () => {
    const h = [session("1", today(9)), session("2", today(10)), session("3", new Date(2026, 10, 20, 9).toISOString())];
    expect(sessionsToday(h, now)).toBe(2);
  });
  it("blocks free users after the daily limit; pro is unlimited", () => {
    const h = Array.from({ length: FREE_DAILY_LIMIT }, (_, i) => session(String(i), today(9 + i)));
    expect(canStartInterview("free", h.slice(0, 1), now)).toEqual({ ok: true, remaining: FREE_DAILY_LIMIT - 1 });
    expect(canStartInterview("free", h, now).ok).toBe(false);
    expect(canStartInterview("pro", h, now).ok).toBe(true);
  });
});

describe("stats", () => {
  const now = new Date(2026, 10, 21, 20);
  it("computes streaks ending today or yesterday", () => {
    const d = (day: number) => new Date(2026, 10, day, 12).toISOString();
    expect(practiceStreak([session("a", d(21)), session("b", d(20)), session("c", d(19)), session("x", d(15))], now)).toBe(3);
    expect(practiceStreak([session("a", d(20)), session("b", d(19))], now)).toBe(2);
    expect(practiceStreak([session("a", d(18))], now)).toBe(0);
  });

  it("aggregates averages, best, improvement and roles", () => {
    const h = [
      session("a", "2026-11-18T10:00:00Z", 40, "frontend"),
      session("b", "2026-11-19T10:00:00Z", 60, "hr"),
      session("c", "2026-11-20T10:00:00Z", 80, "frontend"),
    ];
    const s = computeStats(h, now);
    expect(s.total).toBe(3);
    expect(s.average).toBe(60);
    expect(s.best).toBe(80);
    expect(s.improvement).toBeGreaterThan(0);
    expect(s.trend.map((t) => t.overall)).toEqual([40, 60, 80]);
    expect(s.byRole[0]).toEqual({ role: "frontend", count: 2, average: 60 });
  });

  it("handles an empty history", () => {
    const s = computeStats([], now);
    expect(s).toMatchObject({ total: 0, average: 0, best: 0, streak: 0, improvement: 0 });
  });
});
