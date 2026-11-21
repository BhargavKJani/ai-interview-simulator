export type RoleId =
  | "frontend"
  | "android"
  | "backend"
  | "data-analyst"
  | "product-manager"
  | "hr";

export type Difficulty = "junior" | "mid" | "senior";

export type Plan = "free" | "pro";

export interface Question {
  id: string;
  text: string;
  /** Keywords a strong answer is expected to touch on (used by the demo scorer). */
  keywords: string[];
  /** Short tip on what a great answer covers. */
  hint: string;
}

export interface Scores {
  clarity: number; // 0-10
  depth: number; // 0-10
  relevance: number; // 0-10
}

export interface Evaluation {
  scores: Scores;
  overall: number; // 0-100
  feedback: string;
  strengths: string[];
  improvements: string[];
  modelAnswer: string;
}

export interface Turn {
  question: Question;
  answer: string;
  evaluation: Evaluation;
  durationSec: number;
  inputMode: "voice" | "text";
}

export interface InterviewSession {
  id: string;
  role: RoleId;
  difficulty: Difficulty;
  startedAt: string; // ISO
  finishedAt: string; // ISO
  turns: Turn[];
  mode: "ai" | "demo";
}

export interface ReportCard {
  overall: number; // 0-100
  grade: string;
  averages: Scores;
  verdict: string;
  hireSignal: "Strong hire" | "Hire" | "Lean hire" | "Lean no hire" | "No hire";
  topStrengths: string[];
  focusAreas: string[];
  bestTurnIndex: number;
  weakestTurnIndex: number;
}
