import type { Difficulty, Evaluation, Question, Scores } from "./types";

/**
 * Heuristic scorer used in demo mode (no ANTHROPIC_API_KEY) and as a safety net
 * when the AI response can't be parsed. Deterministic and explainable.
 */

const FILLERS = ["um", "uh", "like", "basically", "actually", "you know", "kind of", "sort of", "literally"];
const STRUCTURE_MARKERS = ["first", "second", "then", "finally", "for example", "for instance", "because", "therefore", "however", "so that", "in short", "result"];
const DEPTH_MARKERS = ["trade-off", "tradeoff", "because", "for example", "for instance", "measured", "metric", "%", "impact", "edge case", "instead", "versus", "vs", "why"];

export const clamp = (n: number, lo = 0, hi = 10) => Math.min(hi, Math.max(lo, n));
const round1 = (n: number) => Math.round(n * 10) / 10;

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9%?!.\-\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

export function countOccurrences(text: string, phrases: string[]): number {
  const t = ` ${text.toLowerCase().replace(/\s+/g, " ")} `;
  let total = 0;
  for (const p of phrases) {
    const escaped = p.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(^|[^a-z])${escaped}([^a-z]|$)`, "g");
    total += (t.match(re) || []).length;
  }
  return total;
}

export function keywordCoverage(answer: string, keywords: string[]): { hit: string[]; missed: string[] } {
  const a = answer.toLowerCase();
  const hit: string[] = [];
  const missed: string[] = [];
  for (const k of keywords) {
    // allow light stemming: "indexes" matches "index", "cached" matches "cache"
    const stem = k.toLowerCase().replace(/(es|s|ed|ing)$/, "");
    if (a.includes(k.toLowerCase()) || (stem.length > 3 && a.includes(stem))) hit.push(k);
    else missed.push(k);
  }
  return { hit, missed };
}

const DIFFICULTY_WORD_TARGET: Record<Difficulty, number> = { junior: 60, mid: 90, senior: 120 };

export function scoreAnswer(question: Question, answer: string, difficulty: Difficulty = "mid"): Scores {
  const words = tokenize(answer);
  const wc = words.length;
  if (wc === 0) return { clarity: 0, depth: 0, relevance: 0 };

  const sentences = answer.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean);
  const avgSentence = wc / Math.max(1, sentences.length);
  const fillerRatio = countOccurrences(answer, FILLERS) / wc;
  const structure = countOccurrences(answer, STRUCTURE_MARKERS);

  // Clarity: well-sized sentences, structure markers, few fillers.
  let clarity = 4;
  if (avgSentence >= 8 && avgSentence <= 25) clarity += 2;
  else if (avgSentence > 40) clarity -= 1.5;
  clarity += Math.min(3, structure * 0.75);
  clarity -= Math.min(4, fillerRatio * 40);
  if (wc < 12) clarity -= 2;
  if (wc >= 25) clarity += 1;

  // Depth: length relative to difficulty, reasoning markers, numbers/examples.
  const target = DIFFICULTY_WORD_TARGET[difficulty];
  let depth = Math.min(5, (wc / target) * 5);
  depth += Math.min(3, countOccurrences(answer, DEPTH_MARKERS) * 0.75);
  if (/\d/.test(answer)) depth += 1;
  if (sentences.length >= 3) depth += 1;

  // Relevance: coverage of expected concepts.
  const { hit } = keywordCoverage(answer, question.keywords);
  const coverage = hit.length / Math.max(1, question.keywords.length);
  let relevance = 2 + coverage * 8;
  if (wc < 8) relevance = Math.min(relevance, 3);

  return { clarity: round1(clamp(clarity)), depth: round1(clamp(depth)), relevance: round1(clamp(relevance)) };
}

export function overallFromScores(s: Scores): number {
  // Relevance weighs slightly more: an articulate but off-topic answer shouldn't win.
  return Math.round(((s.clarity * 0.3 + s.depth * 0.3 + s.relevance * 0.4) / 10) * 100);
}

export function evaluateLocally(question: Question, answer: string, difficulty: Difficulty = "mid"): Evaluation {
  const scores = scoreAnswer(question, answer, difficulty);
  const overall = overallFromScores(scores);
  const { hit, missed } = keywordCoverage(answer, question.keywords);
  const wc = tokenize(answer).length;

  const strengths: string[] = [];
  const improvements: string[] = [];

  if (scores.clarity >= 7) strengths.push("Clear, well-structured delivery.");
  if (scores.depth >= 7) strengths.push("Good depth with reasoning and specifics.");
  if (hit.length) strengths.push(`Touched on key concepts: ${hit.slice(0, 4).join(", ")}.`);

  if (missed.length) improvements.push(`Consider mentioning: ${missed.slice(0, 3).join(", ")}.`);
  if (wc < 20) improvements.push("Expand your answer — aim for 45–90 seconds when speaking.");
  if (scores.clarity < 6) improvements.push("Structure it: headline answer first, then 2–3 supporting points.");
  if (scores.depth < 6) improvements.push("Add a concrete example, metric or trade-off to show real experience.");
  if (countOccurrences(answer, FILLERS) >= 3) improvements.push("Cut filler words (like, basically, um) — pause instead.");

  if (!strengths.length) strengths.push("You attempted the question — that's the first step.");
  if (!improvements.length) improvements.push("Polish further by quantifying your impact.");

  const feedback =
    overall >= 80
      ? "Excellent answer — confident, relevant and backed with detail. This would land well in a real interview."
      : overall >= 60
        ? "Solid answer. You're on the right track; a sharper structure and one concrete example would make it stand out."
        : overall >= 40
          ? "A reasonable start, but the answer misses important points. Focus on the core concepts and support them with examples."
          : "This answer needs work. Revisit the fundamentals and practise answering in a structured way.";

  return {
    scores,
    overall,
    feedback,
    strengths: strengths.slice(0, 3),
    improvements: improvements.slice(0, 3),
    modelAnswer: question.hint,
  };
}

/** Validate & normalise an evaluation coming from the AI so the UI can trust it. */
export function normaliseEvaluation(raw: unknown, fallback: Evaluation): Evaluation {
  if (!raw || typeof raw !== "object") return fallback;
  const r = raw as Record<string, unknown>;
  const s = (r.scores ?? {}) as Record<string, unknown>;
  const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? round1(clamp(v)) : d);
  const scores: Scores = {
    clarity: num(s.clarity, fallback.scores.clarity),
    depth: num(s.depth, fallback.scores.depth),
    relevance: num(s.relevance, fallback.scores.relevance),
  };
  const strArr = (v: unknown, d: string[]) =>
    Array.isArray(v) && v.every((x) => typeof x === "string") && v.length ? (v as string[]).slice(0, 4) : d;
  return {
    scores,
    overall: overallFromScores(scores),
    feedback: typeof r.feedback === "string" && r.feedback.trim() ? r.feedback.trim() : fallback.feedback,
    strengths: strArr(r.strengths, fallback.strengths),
    improvements: strArr(r.improvements, fallback.improvements),
    modelAnswer: typeof r.modelAnswer === "string" && r.modelAnswer.trim() ? r.modelAnswer.trim() : fallback.modelAnswer,
  };
}
