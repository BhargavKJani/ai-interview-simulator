import { aiEnabled, aiEvaluate, aiNextQuestion, MODEL } from "./ai";
import { billingEnabled } from "./billing/config";
import { isDifficulty, isRoleId, pickQuestions } from "./roles";
import { evaluateLocally } from "./scoring";
import type { Evaluation, Question } from "./types";

/**
 * Framework-agnostic handlers so they can be unit-tested without Next.js.
 * Every path degrades to the deterministic demo engine when no API key is set,
 * the caller has no paid/free AI session (`opts.ai === false`), or the AI call fails.
 */

export interface AiOptions {
  /** Whether this request may use Claude. Routes decide this from the user's plan; defaults to "a key is set". */
  ai?: boolean;
}

export type HandlerResult<T> = { status: number; body: T | { error: string } };

const MAX_ANSWER = 8000;
const MAX_QUESTIONS = 10;

/** AI is available when a key is set and payments are configured (so only signed-in users with a plan can use it). */
export function statusHandler() {
  const billing = billingEnabled();
  const ai = aiEnabled() && billing;
  return { status: 200, body: { ai, mode: ai ? "ai" : "demo", model: ai ? MODEL : null, billing } };
}

export async function questionHandler(input: unknown, opts: AiOptions = {}): Promise<HandlerResult<{ question: Question; mode: "ai" | "demo" }>> {
  const b = (input ?? {}) as Record<string, unknown>;
  if (!isRoleId(b.role) || !isDifficulty(b.difficulty)) return { status: 400, body: { error: "Invalid role or difficulty" } };
  const index = Number.isInteger(b.index) ? Math.min(Math.max(0, b.index as number), MAX_QUESTIONS - 1) : 0;
  const seed = typeof b.seed === "number" && Number.isFinite(b.seed) ? b.seed : 42;
  const previous = Array.isArray(b.previous)
    ? (b.previous as unknown[])
        .filter((p): p is { question: string; answer: string } => !!p && typeof (p as { question?: unknown }).question === "string" && typeof (p as { answer?: unknown }).answer === "string")
        .slice(0, MAX_QUESTIONS)
    : [];

  if (opts.ai ?? aiEnabled()) {
    try {
      const q = await aiNextQuestion(b.role, b.difficulty, previous, index);
      if (q) return { status: 200, body: { question: q, mode: "ai" } };
    } catch (err) {
      console.error("[ai] question generation failed, using demo bank:", (err as Error).message);
    }
  }
  const list = pickQuestions(b.role, b.difficulty, index + 1, seed);
  return { status: 200, body: { question: list[Math.min(index, list.length - 1)], mode: "demo" } };
}

function isQuestion(q: unknown): q is Question {
  const o = q as Question;
  return !!o && typeof o.text === "string" && o.text.length < 1000 && Array.isArray(o.keywords) && typeof o.hint === "string";
}

export async function evaluateHandler(input: unknown, opts: AiOptions = {}): Promise<HandlerResult<{ evaluation: Evaluation; mode: "ai" | "demo" }>> {
  const b = (input ?? {}) as Record<string, unknown>;
  if (!isRoleId(b.role) || !isDifficulty(b.difficulty)) return { status: 400, body: { error: "Invalid role or difficulty" } };
  if (!isQuestion(b.question)) return { status: 400, body: { error: "Invalid question" } };
  if (typeof b.answer !== "string") return { status: 400, body: { error: "Answer must be a string" } };
  const answer = b.answer.trim().slice(0, MAX_ANSWER);
  const question: Question = {
    id: String(b.question.id ?? "q"),
    text: b.question.text,
    keywords: b.question.keywords.filter((k): k is string => typeof k === "string").slice(0, 10),
    hint: b.question.hint,
  };

  if (!answer) return { status: 200, body: { evaluation: evaluateLocally(question, "", b.difficulty), mode: "demo" } };

  if (opts.ai ?? aiEnabled()) {
    try {
      return { status: 200, body: { evaluation: await aiEvaluate(b.role, b.difficulty, question, answer), mode: "ai" } };
    } catch (err) {
      console.error("[ai] evaluation failed, using demo scorer:", (err as Error).message);
    }
  }
  return { status: 200, body: { evaluation: evaluateLocally(question, answer, b.difficulty), mode: "demo" } };
}
