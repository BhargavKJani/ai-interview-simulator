import type { InterviewSession, ReportCard, Scores } from "./types";

export function gradeFor(overall: number): string {
  if (overall >= 90) return "A+";
  if (overall >= 80) return "A";
  if (overall >= 70) return "B";
  if (overall >= 60) return "C";
  if (overall >= 45) return "D";
  return "F";
}

export function hireSignalFor(overall: number): ReportCard["hireSignal"] {
  if (overall >= 85) return "Strong hire";
  if (overall >= 70) return "Hire";
  if (overall >= 58) return "Lean hire";
  if (overall >= 42) return "Lean no hire";
  return "No hire";
}

const DIM_LABEL: Record<keyof Scores, string> = { clarity: "Clarity", depth: "Depth", relevance: "Relevance" };

export function buildReport(session: Pick<InterviewSession, "turns">): ReportCard {
  const turns = session.turns;
  if (!turns.length) {
    return {
      overall: 0, grade: "F", averages: { clarity: 0, depth: 0, relevance: 0 },
      verdict: "No answers recorded.", hireSignal: "No hire", topStrengths: [], focusAreas: [],
      bestTurnIndex: -1, weakestTurnIndex: -1,
    };
  }
  const n = turns.length;
  const sum = turns.reduce(
    (acc, t) => ({
      clarity: acc.clarity + t.evaluation.scores.clarity,
      depth: acc.depth + t.evaluation.scores.depth,
      relevance: acc.relevance + t.evaluation.scores.relevance,
    }),
    { clarity: 0, depth: 0, relevance: 0 },
  );
  const averages: Scores = {
    clarity: Math.round((sum.clarity / n) * 10) / 10,
    depth: Math.round((sum.depth / n) * 10) / 10,
    relevance: Math.round((sum.relevance / n) * 10) / 10,
  };
  const overall = Math.round(turns.reduce((a, t) => a + t.evaluation.overall, 0) / n);

  let best = 0;
  let worst = 0;
  turns.forEach((t, i) => {
    if (t.evaluation.overall > turns[best].evaluation.overall) best = i;
    if (t.evaluation.overall < turns[worst].evaluation.overall) worst = i;
  });

  const dims = (Object.keys(averages) as (keyof Scores)[]).sort((a, b) => averages[b] - averages[a]);
  const strongest = dims[0];
  const weakest = dims[dims.length - 1];

  const freq = (list: string[]) => {
    const m = new Map<string, number>();
    list.forEach((s) => m.set(s, (m.get(s) ?? 0) + 1));
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([s]) => s);
  };
  const topStrengths = freq(turns.flatMap((t) => t.evaluation.strengths)).slice(0, 3);
  const focusAreas = freq(turns.flatMap((t) => t.evaluation.improvements)).slice(0, 3);

  const verdict =
    `Your strongest dimension was ${DIM_LABEL[strongest].toLowerCase()} (${averages[strongest]}/10)` +
    (strongest !== weakest ? ` and the biggest opportunity is ${DIM_LABEL[weakest].toLowerCase()} (${averages[weakest]}/10).` : ".") +
    (overall >= 70 ? " You're interview-ready for this level — keep practising to stay sharp." : " A few more focused sessions will move you into the hire zone.");

  return {
    overall, grade: gradeFor(overall), averages, verdict, hireSignal: hireSignalFor(overall),
    topStrengths, focusAreas, bestTurnIndex: best, weakestTurnIndex: worst,
  };
}
