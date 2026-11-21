"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { clearHistory, computeStats, type DashboardStats, loadHistory } from "@/lib/history";
import { buildReport } from "@/lib/report";
import { getRole } from "@/lib/roles";
import type { InterviewSession } from "@/lib/types";
import { Radar, scoreColor, TrendChart } from "./Charts";
import { ReportCardView } from "./ReportCardView";

export function Dashboard() {
  const [history, setHistory] = useState<InterviewSession[] | null>(null);
  const [stats, setStats] = useState<DashboardStats>(() => computeStats([], new Date(0)));
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    // Hydrate from localStorage after mount (also keeps `new Date()` out of prerender).
    const h = loadHistory();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHistory(h);
    setStats(computeStats(h));
  }, []);
  const current = history?.find((s) => s.id === selected) ?? null;

  if (history === null) return <div className="mx-auto max-w-6xl px-5 py-20 text-white/40">Loading…</div>;

  if (!history.length) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-24 text-center" data-testid="dashboard-empty">
        <div className="text-6xl">📈</div>
        <h1 className="mt-6 font-[family-name:var(--font-display)] text-4xl font-bold">Your progress lives here</h1>
        <p className="mt-3 text-white/60">Finish your first mock interview to unlock score trends, skill radar and history.</p>
        <Link href="/interview" className="btn-neon mt-8">Start first interview →</Link>
      </div>
    );
  }

  const tiles = [
    { label: "Interviews", value: stats.total, sub: "completed" },
    { label: "Average score", value: stats.average, sub: "out of 100" },
    { label: "Personal best", value: stats.best, sub: "top session" },
    { label: "Streak", value: `${stats.streak}🔥`, sub: stats.streak === 1 ? "day" : "days" },
  ];

  return (
    <div className="mx-auto max-w-6xl px-5 py-12" data-testid="dashboard">
      <div className="animate-fade-up mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-4xl font-bold">
            Progress <span className="neon-text">dashboard</span>
          </h1>
          <p className="mt-2 text-white/60">
            {stats.improvement > 0
              ? `You've improved ${stats.improvement} points since your first sessions. Keep it up!`
              : "Track every session and watch your scores climb."}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/interview" className="btn-neon">New interview</Link>
          <button
            className="btn-ghost"
            onClick={() => {
              if (confirm("Clear all interview history on this device?")) {
                clearHistory();
                setHistory([]);
                setStats(computeStats([]));
              }
            }}
          >
            Reset
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {tiles.map((t, i) => (
          <div key={t.label} className="animate-fade-up glass p-5" style={{ animationDelay: `${i * 70}ms` }}>
            <p className="text-xs uppercase tracking-widest text-white/40">{t.label}</p>
            <p className="mt-2 font-[family-name:var(--font-display)] text-4xl font-bold" data-testid={`stat-${i}`}>{t.value}</p>
            <p className="text-xs text-white/40">{t.sub}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="glass p-6">
          <h2 className="mb-4 font-semibold">Score trend</h2>
          <TrendChart
            points={stats.trend.map((p) => ({
              label: new Date(p.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
              value: p.overall,
            }))}
          />
        </div>
        <div className="glass flex flex-col items-center p-6">
          <h2 className="mb-2 self-start font-semibold">Skill radar</h2>
          <Radar scores={stats.dimensionAverages} />
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[300px_1fr]">
        <div className="glass p-6">
          <h2 className="mb-4 font-semibold">By role</h2>
          <div className="space-y-4">
            {stats.byRole.map((r) => {
              const info = getRole(r.role);
              return (
                <div key={r.role}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>{info?.icon} {info?.title}</span>
                    <span className="font-mono text-white/60">{r.average} · {r.count}×</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/5">
                    <div className={`h-full rounded-full bg-gradient-to-r ${info?.accent}`} style={{ width: `${r.average}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="glass p-6">
          <h2 className="mb-4 font-semibold">History</h2>
          <div className="space-y-2" data-testid="history-list">
            {history.map((s) => {
              const r = buildReport(s);
              const info = getRole(s.role);
              return (
                <button
                  key={s.id}
                  onClick={() => setSelected(selected === s.id ? null : s.id)}
                  className={`flex w-full items-center gap-4 rounded-xl border p-3 text-left transition hover:bg-white/5 ${selected === s.id ? "border-cyan-300/40 bg-white/5" : "border-white/5"}`}
                >
                  <span className="grid h-11 w-11 place-items-center rounded-xl font-mono font-bold" style={{ background: `${scoreColor(r.overall)}22`, color: scoreColor(r.overall) }}>
                    {r.overall}
                  </span>
                  <span className="flex-1">
                    <span className="block text-sm font-medium">{info?.icon} {info?.title} <span className="text-white/40">· {s.difficulty}</span></span>
                    <span className="block text-xs text-white/40">
                      {new Date(s.finishedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })} · {s.turns.length} Qs · {r.hireSignal}
                    </span>
                  </span>
                  <span className="chip">{r.grade}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {current && (
        <div className="mt-8">
          <ReportCardView session={current} />
        </div>
      )}
    </div>
  );
}
