"use client";

import type { AccountState } from "@/components/AccountProvider";

/**
 * Open one AI use (an interview, a statement, a plan…) before calling the AI routes.
 * Returns the session id to send with each AI request, or null to run on the free demo engine.
 */
export async function startAiUse(acc: AccountState): Promise<{ sessionId: string | null; notice: string | null }> {
  if (!acc.billing || !acc.ai || !acc.account || acc.account.left <= 0) return { sessionId: null, notice: null };
  try {
    const res = await fetch("/api/billing/start", { method: "POST", headers: { Authorization: `Bearer ${await acc.token()}` } });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { sessionId: null, notice: body.error ?? "Could not start an AI session." };
    return { sessionId: body.sessionId as string, notice: null };
  } catch {
    return { sessionId: null, notice: "Could not reach the server. Using the free demo engine." };
  } finally {
    void acc.refresh();
  }
}

/** POST JSON to an AI route, carrying the session and sign-in token when there is a session. */
export async function postAi<T>(acc: AccountState, url: string, body: Record<string, unknown>, sessionId: string | null): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (sessionId) headers.Authorization = `Bearer ${await acc.token()}`;
  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(sessionId ? { ...body, session: sessionId } : body) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `Request failed (${res.status})`);
  return res.json() as Promise<T>;
}
