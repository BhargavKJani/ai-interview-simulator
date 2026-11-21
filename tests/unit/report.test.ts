import { describe, expect, it } from "vitest";
import { buildReport, gradeFor, hireSignalFor } from "@/lib/report";
import type { Evaluation, Turn } from "@/lib/types";

const turn = (overall: number, c: number, d: number, r: number, extra: Partial<Evaluation> = {}): Turn => ({
  question: { id: `q${overall}`, text: "Q", keywords: [], hint: "" },
  answer: "a",
  durationSec: 30,
  inputMode: "text",
  evaluation: { scores: { clarity: c, depth: d, relevance: r }, overall, feedback: "", strengths: ["s1"], improvements: ["i1"], modelAnswer: "", ...extra },
});

describe("grade & hire signal", () => {
  it("maps score bands", () => {
    expect(gradeFor(95)).toBe("A+");
    expect(gradeFor(80)).toBe("A");
    expect(gradeFor(72)).toBe("B");
    expect(gradeFor(10)).toBe("F");
    expect(hireSignalFor(90)).toBe("Strong hire");
    expect(hireSignalFor(60)).toBe("Lean hire");
    expect(hireSignalFor(20)).toBe("No hire");
  });
});

describe("buildReport", () => {
  it("handles an empty session", () => {
    const r = buildReport({ turns: [] });
    expect(r.overall).toBe(0);
    expect(r.bestTurnIndex).toBe(-1);
  });

  it("averages scores and finds best/weakest turns", () => {
    const r = buildReport({ turns: [turn(80, 8, 8, 8), turn(40, 4, 2, 6), turn(60, 6, 5, 7)] });
    expect(r.overall).toBe(60);
    expect(r.averages).toEqual({ clarity: 6, depth: 5, relevance: 7 });
    expect(r.bestTurnIndex).toBe(0);
    expect(r.weakestTurnIndex).toBe(1);
    expect(r.verdict).toMatch(/strongest dimension was relevance/);
    expect(r.verdict).toMatch(/opportunity is depth/);
  });

  it("ranks the most frequent strengths and focus areas", () => {
    const r = buildReport({
      turns: [
        turn(70, 7, 7, 7, { strengths: ["clear"], improvements: ["examples"] }),
        turn(70, 7, 7, 7, { strengths: ["clear", "concise"], improvements: ["examples", "metrics"] }),
      ],
    });
    expect(r.topStrengths[0]).toBe("clear");
    expect(r.focusAreas[0]).toBe("examples");
  });
});
