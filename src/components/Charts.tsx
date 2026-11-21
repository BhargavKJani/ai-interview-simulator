"use client";

import { useId } from "react";
import type { Scores } from "@/lib/types";

export function scoreColor(v: number, max = 100) {
  const p = v / max;
  if (p >= 0.75) return "#34d399";
  if (p >= 0.55) return "#22d3ee";
  if (p >= 0.4) return "#fbbf24";
  return "#f472b6";
}

export function ScoreRing({ value, size = 120, label, max = 100 }: { value: number; size?: number; label?: string; max?: number }) {
  const id = useId();
  const stroke = Math.max(6, size / 12);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value / max));
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" role="img" aria-label={`${label ?? "Score"} ${value} of ${max}`}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#22d3ee" />
            <stop offset="55%" stopColor="#a855f7" />
            <stop offset="100%" stopColor="#f472b6" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(255 255 255 / 0.08)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${id})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(.2,.8,.2,1)", filter: "drop-shadow(0 0 6px rgb(168 85 247 / .6))" }}
        />
      </svg>
      <div className="absolute text-center">
        <div className="font-[family-name:var(--font-display)] font-bold leading-none" style={{ fontSize: size / 3.6 }}>
          {max === 10 ? value.toFixed(1) : value}
        </div>
        {label && <div className="mt-1 text-[10px] uppercase tracking-widest text-white/50">{label}</div>}
      </div>
    </div>
  );
}

export function ScoreBars({ scores }: { scores: Scores }) {
  const rows: [keyof Scores, string][] = [
    ["clarity", "Clarity"],
    ["depth", "Depth"],
    ["relevance", "Relevance"],
  ];
  return (
    <div className="space-y-3">
      {rows.map(([k, label]) => (
        <div key={k}>
          <div className="mb-1 flex justify-between text-xs">
            <span className="text-white/60">{label}</span>
            <span className="font-mono font-semibold" style={{ color: scoreColor(scores[k], 10) }} data-testid={`score-${k}`}>
              {scores[k].toFixed(1)}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-violet-500 to-pink-500"
              style={{ width: `${scores[k] * 10}%`, transition: "width 1s cubic-bezier(.2,.8,.2,1)" }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Three-axis radar for clarity / depth / relevance. */
export function Radar({ scores, size = 220 }: { scores: Scores; size?: number }) {
  const cx = size / 2;
  const cy = size / 2 + 8;
  const R = size / 2 - 44;
  const axes: [keyof Scores, string, number][] = [
    ["clarity", "Clarity", -90],
    ["depth", "Depth", 30],
    ["relevance", "Relevance", 150],
  ];
  const pt = (deg: number, r: number) => [cx + r * Math.cos((deg * Math.PI) / 180), cy + r * Math.sin((deg * Math.PI) / 180)];
  const poly = (f: (k: keyof Scores) => number) => axes.map(([k, , d]) => pt(d, R * f(k)).join(",")).join(" ");
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Skill radar" className="overflow-visible">
      {[0.25, 0.5, 0.75, 1].map((s) => (
        <polygon key={s} points={poly(() => s)} fill="none" stroke="rgb(255 255 255 / 0.08)" />
      ))}
      {axes.map(([k, , d]) => {
        const [x, y] = pt(d, R);
        return <line key={k} x1={cx} y1={cy} x2={x} y2={y} stroke="rgb(255 255 255 / 0.08)" />;
      })}
      <polygon
        points={poly((k) => scores[k] / 10)}
        fill="rgb(168 85 247 / 0.25)"
        stroke="#22d3ee"
        strokeWidth={2}
        style={{ filter: "drop-shadow(0 0 8px rgb(34 211 238 / .6))" }}
      />
      {axes.map(([k, label, d]) => {
        const [x, y] = pt(d, R + 18);
        return (
          <text key={k} x={x} y={y} textAnchor="middle" dominantBaseline="middle" className="fill-white/60 text-[11px]">
            {label} {scores[k].toFixed(1)}
          </text>
        );
      })}
    </svg>
  );
}

export function TrendChart({ points, height = 200 }: { points: { label: string; value: number }[]; height?: number }) {
  const id = useId();
  const W = 640;
  const H = height;
  const pad = { l: 34, r: 16, t: 16, b: 28 };
  if (!points.length) return null;
  const xs = (i: number) => pad.l + (points.length === 1 ? (W - pad.l - pad.r) / 2 : (i * (W - pad.l - pad.r)) / (points.length - 1));
  const ys = (v: number) => pad.t + (1 - v / 100) * (H - pad.t - pad.b);
  const line = points.map((p, i) => `${i ? "L" : "M"}${xs(i)},${ys(p.value)}`).join(" ");
  const area = `${line} L${xs(points.length - 1)},${H - pad.b} L${xs(0)},${H - pad.b} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Score trend">
      <defs>
        <linearGradient id={`${id}-a`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#a855f7" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#a855f7" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${id}-l`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#f472b6" />
        </linearGradient>
      </defs>
      {[0, 25, 50, 75, 100].map((g) => (
        <g key={g}>
          <line x1={pad.l} x2={W - pad.r} y1={ys(g)} y2={ys(g)} stroke="rgb(255 255 255 / 0.06)" />
          <text x={pad.l - 8} y={ys(g)} textAnchor="end" dominantBaseline="middle" className="fill-white/35 text-[10px]">
            {g}
          </text>
        </g>
      ))}
      <path d={area} fill={`url(#${id}-a)`} />
      <path d={line} fill="none" stroke={`url(#${id}-l)`} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={xs(i)} cy={ys(p.value)} r={5} fill="#05060f" stroke="#22d3ee" strokeWidth={2.5} />
          <title>{`${p.label}: ${p.value}`}</title>
        </g>
      ))}
      {points.map((p, i) =>
        points.length <= 8 || i % Math.ceil(points.length / 8) === 0 ? (
          <text key={`l${i}`} x={xs(i)} y={H - 8} textAnchor="middle" className="fill-white/35 text-[10px]">
            {p.label}
          </text>
        ) : null,
      )}
    </svg>
  );
}
