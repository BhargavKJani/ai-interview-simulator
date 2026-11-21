import { describe, expect, it } from "vitest";
import { DIFFICULTIES, isDifficulty, isRoleId, pickQuestions, QUESTION_BANK, ROLES } from "@/lib/roles";

describe("question bank", () => {
  it("has questions for every role and difficulty", () => {
    for (const r of ROLES) for (const d of DIFFICULTIES) {
      const items = QUESTION_BANK[r.id][d.id];
      expect(items.length).toBeGreaterThanOrEqual(3);
      for (const q of items) {
        expect(q.text.length).toBeGreaterThan(10);
        expect(q.keywords.length).toBeGreaterThanOrEqual(4);
      }
    }
  });

  it("validates ids", () => {
    expect(isRoleId("android")).toBe(true);
    expect(isRoleId("astronaut")).toBe(false);
    expect(isDifficulty("senior")).toBe(true);
    expect(isDifficulty("god")).toBe(false);
  });
});

describe("pickQuestions", () => {
  it("is deterministic for a seed and unique within a session", () => {
    const a = pickQuestions("frontend", "mid", 5, 123);
    const b = pickQuestions("frontend", "mid", 5, 123);
    expect(a).toEqual(b);
    expect(new Set(a.map((q) => q.id)).size).toBe(5);
  });

  it("puts the chosen level first, then tops up", () => {
    const qs = pickQuestions("hr", "senior", 5, 7);
    expect(qs.slice(0, 3).every((q) => q.id.includes("-senior-"))).toBe(true);
    expect(qs.slice(3).every((q) => q.id.includes("-mid-"))).toBe(true);
  });

  it("clamps the count", () => {
    expect(pickQuestions("android", "junior", 0, 1)).toHaveLength(1);
    expect(pickQuestions("android", "junior", 99, 1)).toHaveLength(9);
  });
});
