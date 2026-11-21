import { buildReport } from "./report";
import type { InterviewSession, Plan, RoleId } from "./types";

export interface KV {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

const HISTORY_KEY = "ais.history.v1";
const PLAN_KEY = "ais.plan.v1";

export const FREE_DAILY_LIMIT = 3;
export const FREE_MAX_QUESTIONS = 5;
export const PRO_MAX_QUESTIONS = 10;
export const PRO_PRICE_INR = 399;

function browserStore(): KV | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function loadHistory(store: KV | null = browserStore()): InterviewSession[] {
  if (!store) return [];
  try {
    const raw = store.getItem(HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveSession(session: InterviewSession, store: KV | null = browserStore()): InterviewSession[] {
  const list = [session, ...loadHistory(store).filter((s) => s.id !== session.id)].slice(0, 100);
  try {
    store?.setItem(HISTORY_KEY, JSON.stringify(list));
  } catch {
    /* storage full or blocked — keep the in-memory result */
  }
  return list;
}

export function clearHistory(store: KV | null = browserStore()) {
  try {
    store?.removeItem(HISTORY_KEY);
  } catch {
    /* ignore */
  }
}

export function getPlan(store: KV | null = browserStore()): Plan {
  try {
    return store?.getItem(PLAN_KEY) === "pro" ? "pro" : "free";
  } catch {
    return "free";
  }
}

export function setPlan(plan: Plan, store: KV | null = browserStore()) {
  try {
    store?.setItem(PLAN_KEY, plan);
  } catch {
    /* ignore */
  }
}

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

export function sessionsToday(history: InterviewSession[], now = new Date()): number {
  const today = dayKey(now);
  return history.filter((s) => dayKey(new Date(s.finishedAt)) === today).length;
}

export function canStartInterview(plan: Plan, history: InterviewSession[], now = new Date()) {
  if (plan === "pro") return { ok: true as const, remaining: Infinity };
  const remaining = Math.max(0, FREE_DAILY_LIMIT - sessionsToday(history, now));
  return { ok: remaining > 0, remaining };
}

/** Consecutive days (ending today or yesterday) with at least one finished interview. */
export function practiceStreak(history: InterviewSession[], now = new Date()): number {
  const days = new Set(history.map((s) => dayKey(new Date(s.finishedAt))));
  const cursor = new Date(now);
  if (!days.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (days.has(dayKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export interface DashboardStats {
  total: number;
  average: number;
  best: number;
  streak: number;
  improvement: number; // last 3 avg minus first 3 avg (chronological)
  trend: { date: string; overall: number; role: RoleId }[];
  byRole: { role: RoleId; count: number; average: number }[];
  dimensionAverages: { clarity: number; depth: number; relevance: number };
}

export function computeStats(history: InterviewSession[], now = new Date()): DashboardStats {
  const chronological = [...history].sort((a, b) => a.finishedAt.localeCompare(b.finishedAt));
  const reports = chronological.map((s) => ({ s, r: buildReport(s) }));
  const overalls = reports.map((x) => x.r.overall);
  const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);
  const avg1 = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : 0);

  const roleMap = new Map<RoleId, number[]>();
  reports.forEach(({ s, r }) => roleMap.set(s.role, [...(roleMap.get(s.role) ?? []), r.overall]));

  return {
    total: history.length,
    average: avg(overalls),
    best: overalls.length ? Math.max(...overalls) : 0,
    streak: practiceStreak(history, now),
    improvement: overalls.length >= 2 ? avg(overalls.slice(-3)) - avg(overalls.slice(0, Math.min(3, overalls.length - 1))) : 0,
    trend: reports.map(({ s, r }) => ({ date: s.finishedAt, overall: r.overall, role: s.role })),
    byRole: [...roleMap.entries()].map(([role, xs]) => ({ role, count: xs.length, average: avg(xs) })).sort((a, b) => b.count - a.count),
    dimensionAverages: {
      clarity: avg1(reports.map((x) => x.r.averages.clarity)),
      depth: avg1(reports.map((x) => x.r.averages.depth)),
      relevance: avg1(reports.map((x) => x.r.averages.relevance)),
    },
  };
}
