"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  canStartInterview, FREE_DAILY_LIMIT, FREE_MAX_QUESTIONS, getPlan, loadHistory, PRO_MAX_QUESTIONS, saveSession,
} from "@/lib/history";
import { DIFFICULTIES, getRole, ROLES } from "@/lib/roles";
import type { Difficulty, Evaluation, InterviewSession, Plan, Question, RoleId, Turn } from "@/lib/types";
import { useSpeech } from "@/lib/useSpeech";
import { USE_NAME } from "@/lib/billing/config";
import { useAccount } from "./AccountProvider";
import { ScoreBars, ScoreRing } from "./Charts";
import { ReportCardView } from "./ReportCardView";

type Phase = "setup" | "interview" | "report";

async function postJSON<T>(url: string, body: unknown, token = ""): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `Request failed (${res.status})`);
  return res.json();
}

export function InterviewApp() {
  const [phase, setPhase] = useState<Phase>("setup");
  const acc = useAccount();
  const [localPlan, setPlan] = useState<Plan>("free");
  const [remaining, setRemaining] = useState<number>(FREE_DAILY_LIMIT);
  const [aiMode, setAiMode] = useState<boolean | null>(null);

  const [role, setRole] = useState<RoleId>("frontend");
  const [difficulty, setDifficulty] = useState<Difficulty>("junior");
  const [count, setCount] = useState(3);
  const [voice, setVoice] = useState(true);

  const [seed, setSeed] = useState(0);
  const [index, setIndex] = useState(0);
  const [question, setQuestion] = useState<Question | null>(null);
  const [answer, setAnswer] = useState("");
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<InterviewSession | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number>(0);
  const startedAtRef = useRef<string>("");
  const usedVoiceRef = useRef(false);
  const modeRef = useRef<"ai" | "demo">("demo");
  /** AI session from /api/billing/start; null means this interview runs on the free demo engine. */
  const aiSessionRef = useRef<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const speech = useSpeech();

  useEffect(() => {
    const p = getPlan();
    // Hydrate plan/quota from localStorage after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPlan(p);
    setRemaining(canStartInterview(p, loadHistory()).remaining);
    fetch("/api/status").then((r) => r.json()).then((s) => setAiMode(!!s.ai)).catch(() => setAiMode(false));
  }, []);

  useEffect(() => {
    if (phase !== "interview" || evaluation) return;
    const t = setInterval(() => setElapsed(Math.round((Date.now() - startRef.current) / 1000)), 1000);
    return () => clearInterval(t);
  }, [phase, evaluation, question]);

  // With payments on, the server decides the plan; otherwise the old local demo plan applies.
  const billing = acc.billing;
  const plan: Plan = billing ? (acc.account?.paid ? "pro" : "free") : localPlan;
  const aiLeft = acc.account?.left ?? 0;
  const willUseAi = billing && acc.ai && !!acc.account && aiLeft > 0;

  const maxQuestions = plan === "pro" ? PRO_MAX_QUESTIONS : FREE_MAX_QUESTIONS;
  const counts = plan === "pro" ? [3, 5, 7, 10] : [3, 5];
  const roleInfo = getRole(role)!;
  const roleLocked = roleInfo.pro && plan !== "pro";
  const canStart = (billing || remaining > 0) && !roleLocked;

  const loadQuestion = useCallback(
    async (i: number, prev: Turn[], s: number) => {
      setLoading(true);
      setError(null);
      try {
        const sessionId = aiSessionRef.current;
        const data = await postJSON<{ question: Question; mode: "ai" | "demo" }>("/api/interview/question", {
          role, difficulty, index: i, seed: s, session: sessionId ?? undefined,
          previous: prev.map((t) => ({ question: t.question.text, answer: t.answer })),
        }, sessionId ? await acc.token() : "");
        setQuestion(data.question);
        setAnswer("");
        setEvaluation(null);
        usedVoiceRef.current = false;
        startRef.current = Date.now();
        setElapsed(0);
        if (voice) speech.speak(data.question.text);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [role, difficulty, voice, speech, acc],
  );

  const start = async () => {
    const s = Math.floor(Math.random() * 1e9);
    setSeed(s);
    setTurns([]);
    setIndex(0);
    setSession(null);
    modeRef.current = "demo";
    aiSessionRef.current = null;
    setNotice(null);
    if (willUseAi) {
      try {
        const r = await postJSON<{ sessionId: string }>("/api/billing/start", {}, await acc.token());
        aiSessionRef.current = r.sessionId;
      } catch (e) {
        setNotice(`${(e as Error).message} This interview uses the free demo engine.`);
      }
      void acc.refresh();
    }
    startedAtRef.current = new Date().toISOString();
    setPhase("interview");
    await loadQuestion(0, [], s);
  };

  const submit = async () => {
    if (!question) return;
    speech.stopListening();
    speech.stopSpeaking();
    setLoading(true);
    setError(null);
    try {
      const sessionId = aiSessionRef.current;
      const data = await postJSON<{ evaluation: Evaluation; mode: "ai" | "demo" }>("/api/interview/evaluate", {
        role, difficulty, question, answer, session: sessionId ?? undefined,
      }, sessionId ? await acc.token() : "");
      if (data.mode === "ai") modeRef.current = "ai";
      setEvaluation(data.evaluation);
      setTurns((prev) => [
        ...prev,
        {
          question, answer, evaluation: data.evaluation,
          durationSec: Math.max(1, Math.round((Date.now() - startRef.current) / 1000)),
          inputMode: usedVoiceRef.current ? "voice" : "text",
        },
      ]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const next = async () => {
    const i = index + 1;
    if (i >= count) return finish();
    setIndex(i);
    await loadQuestion(i, turns, seed);
  };

  const finish = () => {
    speech.stopSpeaking();
    const s: InterviewSession = {
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      role, difficulty, startedAt: startedAtRef.current, finishedAt: new Date().toISOString(), turns, mode: modeRef.current,
    };
    const history = saveSession(s);
    setRemaining(canStartInterview(plan, history).remaining);
    if (billing) void acc.refresh();
    setSession(s);
    setPhase("report");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const toggleMic = () => {
    if (speech.listening) return speech.stopListening();
    speech.stopSpeaking();
    usedVoiceRef.current = true;
    speech.startListening((t) => setAnswer((a) => (a ? `${a} ${t}` : t)));
  };

  /* ---------------------------------- SETUP --------------------------------- */
  if (phase === "setup") {
    return (
      <div className="mx-auto max-w-6xl px-5 py-12">
        <div className="animate-fade-up mb-10 flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="chip mb-3">
              {billing
                ? willUseAi
                  ? "✨ Live AI interviewer (Claude)"
                  : !acc.ai
                    ? "⚡ Demo mode"
                    : acc.account
                      ? `⚡ Demo mode · no ${USE_NAME.many} left`
                      : `⚡ Demo mode · sign in for 3 free ${USE_NAME.many}`
                : aiMode === null ? "Checking AI…" : aiMode ? "✨ Live AI interviewer (Claude)" : "⚡ Demo mode — no API key needed"}
            </p>
            <h1 className="font-[family-name:var(--font-display)] text-4xl font-bold sm:text-5xl">
              Set up your <span className="neon-text">mock interview</span>
            </h1>
            <p className="mt-3 text-white/60">Pick a role and level. Your AI interviewer asks one question at a time.</p>
          </div>
          {billing ? (
            <div className="glass px-4 py-3 text-sm text-white/70" data-testid="quota">
              {!acc.account ? (
                <button className="text-cyan-300 hover:underline" onClick={() => void acc.signIn()}>
                  Sign in with Google for 3 free {USE_NAME.many} →
                </button>
              ) : (
                <>
                  {acc.account.paid ? "★ " : ""}
                  {aiLeft}/{acc.account.limit} {USE_NAME.many} left
                  {aiLeft === 0 && <> · <Link href="/pricing" className="text-cyan-300 hover:underline">Get a plan from ₹9</Link></>}
                </>
              )}
            </div>
          ) : (
            <div className="glass px-4 py-3 text-sm text-white/70" data-testid="quota">
              {plan === "pro" ? "★ Pro — unlimited interviews" : `${remaining}/${FREE_DAILY_LIMIT} free interviews left today`}
            </div>
          )}
        </div>

        <section className="mb-10">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-white/40">1 · Role</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ROLES.map((r, i) => {
              const locked = r.pro && plan !== "pro";
              const active = role === r.id;
              return (
                <button
                  key={r.id}
                  data-testid={`role-${r.id}`}
                  onClick={() => setRole(r.id)}
                  style={{ animationDelay: `${i * 60}ms` }}
                  className={`animate-fade-up glass group relative overflow-hidden p-5 text-left transition duration-300 hover:-translate-y-1 hover:border-white/25 ${
                    active ? "!border-cyan-300/60 shadow-[0_0_40px_-12px_rgb(34_211_238/0.9)]" : ""
                  }`}
                >
                  <div className={`absolute -top-10 -right-10 h-28 w-28 rounded-full bg-gradient-to-br ${r.accent} opacity-20 blur-2xl transition group-hover:opacity-40`} />
                  <div className="relative flex items-start justify-between">
                    <span className="text-3xl">{r.icon}</span>
                    {locked ? <span className="chip border-amber-300/30 text-amber-200">🔒 Pro</span> : active ? <span className="chip text-cyan-200">Selected</span> : null}
                  </div>
                  <h3 className="relative mt-4 font-semibold">{r.title}</h3>
                  <p className="relative mt-1 text-sm text-white/50">{r.tagline}</p>
                </button>
              );
            })}
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-3">
          <section className="glass p-5">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-white/40">2 · Difficulty</h2>
            <div className="grid gap-2">
              {DIFFICULTIES.map((d) => (
                <button
                  key={d.id}
                  data-testid={`difficulty-${d.id}`}
                  onClick={() => setDifficulty(d.id)}
                  className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left transition ${
                    difficulty === d.id ? "border-violet-400/60 bg-violet-500/15" : "border-white/5 bg-white/[0.02] hover:bg-white/5"
                  }`}
                >
                  <span className="font-medium">{d.label}</span>
                  <span className="text-xs text-white/45">{d.blurb}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="glass p-5">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-white/40">3 · Length</h2>
            <div className="flex flex-wrap gap-2">
              {counts.map((c) => (
                <button
                  key={c}
                  data-testid={`count-${c}`}
                  onClick={() => setCount(c)}
                  className={`h-14 w-14 rounded-xl border font-mono text-lg transition ${
                    count === c ? "border-pink-400/60 bg-pink-500/15 text-white" : "border-white/5 bg-white/[0.02] text-white/60 hover:bg-white/5"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs text-white/40">
              questions · {plan === "pro" ? `up to ${maxQuestions}` : <>Pro unlocks up to {PRO_MAX_QUESTIONS}. <Link href="/pricing" className="text-cyan-300 hover:underline">Upgrade</Link></>}
            </p>
          </section>

          <section className="glass p-5">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-white/40">4 · Answer by</h2>
            <div className="grid grid-cols-2 gap-2">
              {[
                { v: true, label: "🎙️ Voice", sub: "Interviewer speaks, you talk" },
                { v: false, label: "⌨️ Text", sub: "Read & type answers" },
              ].map((o) => (
                <button
                  key={o.label}
                  data-testid={o.v ? "mode-voice" : "mode-text"}
                  onClick={() => setVoice(o.v)}
                  className={`rounded-xl border p-3 text-left transition ${
                    voice === o.v ? "border-cyan-400/60 bg-cyan-500/10" : "border-white/5 bg-white/[0.02] hover:bg-white/5"
                  }`}
                >
                  <div className="font-medium">{o.label}</div>
                  <div className="mt-1 text-xs text-white/45">{o.sub}</div>
                </button>
              ))}
            </div>
            {voice && speech.ttsSupported && !speech.sttSupported && (
              <p className="mt-3 text-xs text-amber-200/80">Speech-to-text isn&apos;t available here; you&apos;ll hear questions and type answers.</p>
            )}
          </section>
        </div>

        <div className="mt-10 flex flex-col items-center gap-3">
          {roleLocked ? (
            <Link href="/pricing" className="btn-neon text-lg" data-testid="upgrade-cta">🔒 Unlock {roleInfo.title} with Pro</Link>
          ) : remaining <= 0 ? (
            <Link href="/pricing" className="btn-neon text-lg" data-testid="upgrade-cta">Daily limit reached — go Pro for unlimited</Link>
          ) : (
            <button className="btn-neon px-10 py-4 text-lg" onClick={start} disabled={!canStart} data-testid="start-btn">
              Start interview →
            </button>
          )}
          <p className="text-xs text-white/40">
            {roleInfo.icon} {roleInfo.title} · {difficulty} · {count} questions · {voice ? "voice" : "text"}
          </p>
        </div>
      </div>
    );
  }

  /* --------------------------------- REPORT --------------------------------- */
  if (phase === "report" && session) {
    return (
      <div className="mx-auto max-w-5xl px-5 py-12">
        <ReportCardView session={session} />
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button className="btn-neon" onClick={() => setPhase("setup")} data-testid="practice-again">Practice again</button>
          <Link href="/dashboard" className="btn-ghost" data-testid="go-dashboard">View progress dashboard →</Link>
        </div>
      </div>
    );
  }

  /* -------------------------------- INTERVIEW ------------------------------- */
  const progress = ((index + (evaluation ? 1 : 0)) / count) * 100;
  const isLast = index + 1 >= count;
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="mx-auto max-w-4xl px-5 py-10">
      <div className="mb-6 flex items-center justify-between gap-4 text-sm text-white/50">
        <span>{roleInfo.icon} {roleInfo.title} · {difficulty}</span>
        <span className="font-mono" data-testid="progress-label">Question {index + 1} / {count}</span>
      </div>
      <div className="mb-8 h-1.5 overflow-hidden rounded-full bg-white/5">
        <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-violet-500 to-pink-500 transition-all duration-700" style={{ width: `${progress}%` }} />
      </div>

      <div className="glass-strong relative overflow-hidden p-6 sm:p-8">
        <div className="flex items-start gap-5">
          <div className="relative shrink-0">
            <div className={`grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-cyan-400 via-violet-500 to-pink-500 text-2xl ${speech.speaking ? "animate-pulse-ring" : ""}`}>
              🤖
            </div>
            {speech.speaking && (
              <div className="absolute -bottom-3 left-1/2 flex -translate-x-1/2 gap-0.5">
                {[0, 1, 2, 3, 4].map((i) => (
                  <span key={i} className="animate-wave h-3 w-1 origin-bottom rounded bg-cyan-300" style={{ animationDelay: `${i * 0.12}s` }} />
                ))}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs uppercase tracking-[0.25em] text-white/40">AI Interviewer</p>
            {loading && !question ? (
              <div className="mt-3 h-6 w-2/3 animate-pulse rounded bg-white/10" />
            ) : (
              <h2 key={question?.id} data-testid="question-text" className="animate-fade-up mt-2 font-[family-name:var(--font-display)] text-xl leading-snug font-semibold sm:text-2xl">
                {question?.text}
              </h2>
            )}
            {question && speech.ttsSupported && (
              <button className="mt-3 text-xs text-cyan-300/80 hover:text-cyan-200" onClick={() => (speech.speaking ? speech.stopSpeaking() : speech.speak(question.text))}>
                {speech.speaking ? "■ Stop voice" : "🔊 Replay question"}
              </button>
            )}
          </div>
        </div>
      </div>

      {error && <div className="mt-4 rounded-xl border border-pink-400/30 bg-pink-500/10 p-3 text-sm text-pink-200">{error}</div>}
      {notice && <div className="mt-4 rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-sm text-amber-200">{notice} <Link href="/pricing" className="underline">See plans</Link></div>}
      {speech.error && <div className="mt-4 rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-sm text-amber-200">{speech.error}</div>}

      {!evaluation ? (
        <div className="glass mt-6 p-5">
          <div className="mb-3 flex items-center justify-between">
            <label htmlFor="answer" className="text-sm font-medium text-white/70">Your answer</label>
            <span className="font-mono text-xs text-white/40">⏱ {fmt(elapsed)}</span>
          </div>
          <textarea
            id="answer"
            data-testid="answer-input"
            value={answer + (speech.interim ? (answer ? " " : "") + speech.interim : "")}
            onChange={(e) => setAnswer(e.target.value)}
            disabled={speech.listening || loading}
            rows={7}
            placeholder={voice && speech.sttSupported ? "Tap the mic and speak, or type here…" : "Type your answer… Structure it: headline, 2–3 points, an example."}
            className="w-full resize-y rounded-xl border border-white/10 bg-black/30 p-4 text-white/90 placeholder:text-white/30 focus:border-cyan-300/50 focus:outline-none focus:ring-2 focus:ring-cyan-300/20"
          />
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {speech.sttSupported && (
                <button
                  onClick={toggleMic}
                  data-testid="mic-btn"
                  aria-label={speech.listening ? "Stop recording" : "Start recording"}
                  className={`grid h-12 w-12 place-items-center rounded-full border text-xl transition ${
                    speech.listening ? "animate-pulse-ring border-pink-400 bg-pink-500/30" : "border-white/15 bg-white/5 hover:border-cyan-300/50"
                  }`}
                >
                  {speech.listening ? "■" : "🎙️"}
                </button>
              )}
              <span className="text-xs text-white/40">
                {speech.listening ? "Listening… speak naturally" : `${answer.trim() ? answer.trim().split(/\s+/).length : 0} words`}
              </span>
            </div>
            <button className="btn-neon" onClick={submit} disabled={loading || !answer.trim() || !question} data-testid="submit-answer">
              {loading ? "Scoring…" : "Submit answer"}
            </button>
          </div>
        </div>
      ) : (
        <div data-testid="eval-panel" className="animate-fade-up glass mt-6 p-6">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
            <ScoreRing value={evaluation.overall} size={120} label="Score" />
            <div className="flex-1">
              <p className="text-white/80">{evaluation.feedback}</p>
              <div className="mt-4"><ScoreBars scores={evaluation.scores} /></div>
            </div>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl bg-emerald-400/5 p-4">
              <h4 className="mb-2 text-sm font-semibold text-emerald-300">Strengths</h4>
              <ul className="space-y-1 text-sm text-white/70">{evaluation.strengths.map((s) => <li key={s}>✓ {s}</li>)}</ul>
            </div>
            <div className="rounded-xl bg-pink-400/5 p-4">
              <h4 className="mb-2 text-sm font-semibold text-pink-300">Improve</h4>
              <ul className="space-y-1 text-sm text-white/70">{evaluation.improvements.map((s) => <li key={s}>→ {s}</li>)}</ul>
            </div>
          </div>
          <p className="mt-4 rounded-xl bg-cyan-400/5 p-4 text-sm text-white/65"><b className="text-cyan-300">What a great answer covers:</b> {evaluation.modelAnswer}</p>
          <div className="mt-6 flex justify-end">
            {isLast ? (
              <button className="btn-neon" onClick={finish} data-testid="finish-btn">See report card →</button>
            ) : (
              <button className="btn-neon" onClick={next} disabled={loading} data-testid="next-question">
                {loading ? "Loading…" : "Next question →"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
