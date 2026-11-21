"use client";

import { buildReport } from "@/lib/report";
import { getRole } from "@/lib/roles";
import type { InterviewSession } from "@/lib/types";
import { Radar, ScoreBars, ScoreRing, scoreColor } from "./Charts";

const SIGNAL_STYLE: Record<string, string> = {
  "Strong hire": "border-emerald-300/40 bg-emerald-400/10 text-emerald-200",
  Hire: "border-cyan-300/40 bg-cyan-400/10 text-cyan-200",
  "Lean hire": "border-violet-300/40 bg-violet-400/10 text-violet-200",
  "Lean no hire": "border-amber-300/40 bg-amber-400/10 text-amber-200",
  "No hire": "border-pink-300/40 bg-pink-400/10 text-pink-200",
};

export function ReportCardView({ session }: { session: InterviewSession }) {
  const report = buildReport(session);
  const role = getRole(session.role);
  const mins = Math.max(1, Math.round(session.turns.reduce((a, t) => a + t.durationSec, 0) / 60));

  return (
    <div data-testid="report-card" className="animate-fade-up space-y-6">
      <div className="glass-strong relative overflow-hidden p-6 sm:p-8">
        <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-violet-500/20 blur-3xl" />
        <div className="relative flex flex-col items-center gap-8 md:flex-row">
          <div className="flex flex-col items-center gap-3">
            <ScoreRing value={report.overall} size={168} label="Overall" />
            <span data-testid="overall-score" className="sr-only">{report.overall}</span>
          </div>
          <div className="flex-1 text-center md:text-left">
            <p className="text-xs uppercase tracking-[0.25em] text-white/40">Report card</p>
            <h2 className="mt-1 font-[family-name:var(--font-display)] text-3xl font-bold">
              {role?.icon} {role?.title} <span className="text-white/40">· {session.difficulty}</span>
            </h2>
            <div className="mt-3 flex flex-wrap justify-center gap-2 md:justify-start">
              <span className="chip !text-sm">
                Grade <b className="ml-1 text-white" data-testid="grade">{report.grade}</b>
              </span>
              <span className={`chip !text-sm ${SIGNAL_STYLE[report.hireSignal]}`} data-testid="hire-signal">{report.hireSignal}</span>
              <span className="chip !text-sm">{session.turns.length} questions</span>
              <span className="chip !text-sm">~{mins} min</span>
              <span className="chip !text-sm">{session.mode === "ai" ? "✨ Claude-scored" : "⚡ Demo scoring"}</span>
            </div>
            <p className="mt-4 max-w-xl text-white/70">{report.verdict}</p>
          </div>
          <Radar scores={report.averages} />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="glass p-6">
          <h3 className="mb-3 font-semibold text-emerald-300">▲ What went well</h3>
          <ul className="space-y-2 text-sm text-white/75">
            {report.topStrengths.map((s) => <li key={s} className="flex gap-2"><span className="text-emerald-300">✓</span>{s}</li>)}
          </ul>
        </div>
        <div className="glass p-6">
          <h3 className="mb-3 font-semibold text-pink-300">◆ Focus next</h3>
          <ul className="space-y-2 text-sm text-white/75">
            {report.focusAreas.map((s) => <li key={s} className="flex gap-2"><span className="text-pink-300">→</span>{s}</li>)}
          </ul>
        </div>
      </div>

      <div className="glass p-6">
        <h3 className="mb-4 font-semibold">Question breakdown</h3>
        <div className="space-y-3">
          {session.turns.map((t, i) => (
            <details key={t.question.id + i} className="group rounded-xl border border-white/5 bg-white/[0.02] p-4 open:bg-white/[0.04]">
              <summary className="flex cursor-pointer list-none items-center gap-4">
                <span
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-xl font-mono text-sm font-bold"
                  style={{ background: `${scoreColor(t.evaluation.overall)}22`, color: scoreColor(t.evaluation.overall) }}
                >
                  {t.evaluation.overall}
                </span>
                <span className="flex-1 text-sm text-white/85">
                  Q{i + 1}. {t.question.text}
                  {i === report.bestTurnIndex && session.turns.length > 1 && <span className="chip ml-2 !py-0 text-emerald-200">best</span>}
                </span>
                <span className="text-white/30 transition group-open:rotate-90">›</span>
              </summary>
              <div className="mt-4 grid gap-4 md:grid-cols-[1fr_220px]">
                <div className="space-y-3 text-sm">
                  <p className="rounded-lg bg-black/30 p-3 text-white/60 italic">“{t.answer || "(no answer)"}”</p>
                  <p className="text-white/75">{t.evaluation.feedback}</p>
                  <p className="text-white/50"><b className="text-cyan-300">Model answer:</b> {t.evaluation.modelAnswer}</p>
                </div>
                <ScoreBars scores={t.evaluation.scores} />
              </div>
            </details>
          ))}
        </div>
      </div>
    </div>
  );
}
