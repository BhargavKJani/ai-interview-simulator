import Anthropic from "@anthropic-ai/sdk";
import { getRole } from "./roles";
import { evaluateLocally, normaliseEvaluation } from "./scoring";
import type { Difficulty, Evaluation, Question, RoleId } from "./types";

export const MODEL = "claude-sonnet-5-5";

export function aiEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

let client: Anthropic | null = null;
function getClient() {
  client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

const EVAL_TOOL: Anthropic.Tool = {
  name: "submit_evaluation",
  description: "Submit the structured evaluation of the candidate's answer.",
  input_schema: {
    type: "object",
    properties: {
      scores: {
        type: "object",
        properties: {
          clarity: { type: "number", description: "0-10: structure, concision, communication" },
          depth: { type: "number", description: "0-10: technical/insight depth, examples, trade-offs" },
          relevance: { type: "number", description: "0-10: how directly it answers the question" },
        },
        required: ["clarity", "depth", "relevance"],
      },
      feedback: { type: "string", description: "2-3 sentence overall feedback addressed to the candidate" },
      strengths: { type: "array", items: { type: "string" }, description: "1-3 short strengths" },
      improvements: { type: "array", items: { type: "string" }, description: "1-3 short, actionable improvements" },
      modelAnswer: { type: "string", description: "A concise outline (3-5 sentences) of an excellent answer" },
    },
    required: ["scores", "feedback", "strengths", "improvements", "modelAnswer"],
  },
};

const QUESTION_TOOL: Anthropic.Tool = {
  name: "ask_question",
  description: "Ask the next interview question.",
  input_schema: {
    type: "object",
    properties: {
      text: { type: "string", description: "The question, one or two sentences, spoken naturally" },
      keywords: { type: "array", items: { type: "string" }, description: "4-6 concepts a strong answer covers" },
      hint: { type: "string", description: "One-line tip on what a great answer covers" },
    },
    required: ["text", "keywords", "hint"],
  },
};

function toolInput(msg: Anthropic.Message, name: string): unknown {
  const block = msg.content.find((b) => b.type === "tool_use" && b.name === name);
  return block && block.type === "tool_use" ? block.input : null;
}

export async function aiEvaluate(role: RoleId, difficulty: Difficulty, question: Question, answer: string): Promise<Evaluation> {
  const fallback = evaluateLocally(question, answer, difficulty);
  const roleTitle = getRole(role)?.title ?? role;
  const msg = await getClient().messages.create({
    model: MODEL,
    max_tokens: 1024,
    system:
      `You are a senior, fair but demanding interviewer for a ${difficulty}-level ${roleTitle} role at a top Indian tech company. ` +
      "Score answers honestly on a 0-10 scale for clarity, depth and relevance. Be specific and encouraging. " +
      "The answer may come from speech-to-text, so ignore minor transcription errors.",
    tools: [EVAL_TOOL],
    tool_choice: { type: "tool", name: EVAL_TOOL.name },
    messages: [{ role: "user", content: `Question: ${question.text}\n\nCandidate answer:\n"""${answer.slice(0, 6000)}"""` }],
  });
  return normaliseEvaluation(toolInput(msg, EVAL_TOOL.name), fallback);
}

export async function aiNextQuestion(
  role: RoleId,
  difficulty: Difficulty,
  previous: { question: string; answer: string }[],
  index: number,
): Promise<Question | null> {
  const roleTitle = getRole(role)?.title ?? role;
  const transcript = previous.map((p, i) => `Q${i + 1}: ${p.question}\nA${i + 1}: ${p.answer.slice(0, 1200)}`).join("\n\n");
  const msg = await getClient().messages.create({
    model: MODEL,
    max_tokens: 400,
    system:
      `You are interviewing a candidate for a ${difficulty}-level ${roleTitle} role. Ask exactly one question at a time. ` +
      "Mix fundamentals, practical scenarios and one behavioural question. Occasionally follow up on something the candidate said. Never repeat a question.",
    tools: [QUESTION_TOOL],
    tool_choice: { type: "tool", name: QUESTION_TOOL.name },
    messages: [{ role: "user", content: transcript ? `Interview so far:\n${transcript}\n\nAsk question ${index + 1}.` : "Ask the first question." }],
  });
  const raw = toolInput(msg, QUESTION_TOOL.name) as Partial<Question> | null;
  if (!raw || typeof raw.text !== "string" || !raw.text.trim()) return null;
  return {
    id: `${role}-ai-${index}-${Date.now()}`,
    text: raw.text.trim(),
    keywords: Array.isArray(raw.keywords) ? raw.keywords.filter((k): k is string => typeof k === "string").slice(0, 8) : [],
    hint: typeof raw.hint === "string" ? raw.hint : "Structure your answer and support it with an example.",
  };
}
