import { describe, expect, it } from "vitest";
import { evaluateLocally, keywordCoverage, normaliseEvaluation, overallFromScores, scoreAnswer } from "@/lib/scoring";
import type { Question } from "@/lib/types";

const q: Question = {
  id: "t",
  text: "What is an index in a database and why does it matter?",
  keywords: ["b-tree", "lookup", "query", "write", "performance"],
  hint: "Explain read speed-ups vs write cost.",
};

const strong =
  "An index is a data structure, usually a B-tree, that lets the database find rows without scanning the whole table. " +
  "First, it speeds up lookup for a query that filters or sorts on the indexed column, for example turning a 2 second scan into 5 ms. " +
  "However, there is a trade-off: every write must also update the index, so insert performance drops and storage grows. " +
  "Therefore I index columns used in frequent WHERE clauses and joins, and measure with EXPLAIN before and after.";

describe("scoreAnswer", () => {
  it("returns zeros for an empty answer", () => {
    expect(scoreAnswer(q, "   ")).toEqual({ clarity: 0, depth: 0, relevance: 0 });
  });

  it("scores a strong, structured answer highly", () => {
    const s = scoreAnswer(q, strong, "mid");
    expect(s.relevance).toBeGreaterThanOrEqual(8);
    expect(s.depth).toBeGreaterThanOrEqual(7);
    expect(s.clarity).toBeGreaterThanOrEqual(7);
  });

  it("penalises short, filler-heavy, off-topic answers", () => {
    const weak = scoreAnswer(q, "um like basically it is like a thing you know");
    const good = scoreAnswer(q, strong);
    expect(weak.clarity).toBeLessThan(good.clarity);
    expect(weak.relevance).toBeLessThanOrEqual(3);
    expect(weak.depth).toBeLessThan(4);
  });

  it("keeps every score within 0..10", () => {
    const s = scoreAnswer(q, strong.repeat(10), "junior");
    for (const v of Object.values(s)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(10);
    }
  });

  it("expects more depth at senior level for the same answer", () => {
    const short = "An index speeds up query lookup using a B-tree but slows every write a little.";
    expect(scoreAnswer(q, short, "senior").depth).toBeLessThan(scoreAnswer(q, short, "junior").depth);
  });
});

describe("keywordCoverage", () => {
  it("matches simple stems and is case-insensitive", () => {
    const { hit, missed } = keywordCoverage("Queries get faster; WRITES get slower", ["query", "write", "b-tree"]);
    expect(hit).toEqual(["write"]);
    expect(missed).toContain("b-tree");
    expect(keywordCoverage("we cached results", ["cache"]).hit).toEqual(["cache"]);
  });
});

describe("overallFromScores", () => {
  it("weights relevance most", () => {
    expect(overallFromScores({ clarity: 10, depth: 10, relevance: 10 })).toBe(100);
    expect(overallFromScores({ clarity: 0, depth: 0, relevance: 10 })).toBe(40);
    expect(overallFromScores({ clarity: 10, depth: 0, relevance: 0 })).toBe(30);
  });
});

describe("evaluateLocally", () => {
  it("produces feedback, strengths and improvements", () => {
    const e = evaluateLocally(q, strong);
    expect(e.overall).toBeGreaterThan(70);
    expect(e.strengths.length).toBeGreaterThan(0);
    expect(e.improvements.length).toBeGreaterThan(0);
    expect(e.modelAnswer).toBe(q.hint);
  });

  it("suggests missed keywords for weak answers", () => {
    const e = evaluateLocally(q, "It makes things fast.");
    expect(e.overall).toBeLessThan(45);
    expect(e.improvements.join(" ")).toMatch(/Consider mentioning/);
  });
});

describe("normaliseEvaluation", () => {
  const fallback = evaluateLocally(q, strong);
  it("falls back on garbage", () => {
    expect(normaliseEvaluation(null, fallback)).toBe(fallback);
    expect(normaliseEvaluation("nope", fallback)).toBe(fallback);
  });
  it("clamps scores and recomputes overall", () => {
    const n = normaliseEvaluation({ scores: { clarity: 14, depth: -3, relevance: 7.26 }, feedback: " Nice ", strengths: ["a"], improvements: ["b"], modelAnswer: "m" }, fallback);
    expect(n.scores).toEqual({ clarity: 10, depth: 0, relevance: 7.3 });
    expect(n.overall).toBe(overallFromScores(n.scores));
    expect(n.feedback).toBe("Nice");
  });
  it("uses fallback values for missing fields", () => {
    const n = normaliseEvaluation({ scores: {} }, fallback);
    expect(n.scores).toEqual(fallback.scores);
    expect(n.strengths).toEqual(fallback.strengths);
  });
});
