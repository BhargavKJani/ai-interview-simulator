"use client";

import { useEffect, useState } from "react";
import { FREE_DAILY_LIMIT, FREE_MAX_QUESTIONS, getPlan, PRO_MAX_QUESTIONS, PRO_PRICE_INR, setPlan } from "@/lib/history";
import type { Plan } from "@/lib/types";
import { useAccount } from "./AccountProvider";
import { BillingPricing } from "./BillingPricing";

const FREE_FEATURES = [
  `${FREE_DAILY_LIMIT} mock interviews per day`,
  `Up to ${FREE_MAX_QUESTIONS} questions per interview`,
  "4 roles: Frontend, Android, Data Analyst, HR",
  "Voice & text answers",
  "Instant scoring + report card",
  "Progress dashboard",
];

const PRO_FEATURES = [
  "Unlimited mock interviews",
  `Up to ${PRO_MAX_QUESTIONS} questions per interview`,
  "All roles incl. Backend & Product Manager",
  "Adaptive Claude-powered follow-up questions",
  "Model answers & deep feedback",
  "Priority access to company-specific packs",
];

export function Pricing({ compact = false }: { compact?: boolean }) {
  const { billing } = useAccount();
  const [plan, setPlanState] = useState<Plan>("free");
  const [yearly, setYearly] = useState(false);
  const [checkout, setCheckout] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPlanState(getPlan());
  }, []);

  const choose = (p: Plan) => {
    setPlan(p);
    setPlanState(p);
    window.dispatchEvent(new Event("ais-plan"));
  };

  const yearlyPrice = Math.round(PRO_PRICE_INR * 12 * 0.75);

  // Real UPI payments when Razorpay + Supabase are configured; otherwise the original demo checkout.
  if (billing) return <BillingPricing compact={compact} />;

  return (
    <div className={compact ? "" : "mx-auto max-w-5xl px-5 py-16"}>
      {!compact && (
        <div className="animate-fade-up mb-10 text-center">
          <p className="chip mx-auto mb-4">Simple pricing · cancel anytime</p>
          <h1 className="font-[family-name:var(--font-display)] text-4xl font-bold sm:text-5xl">
            Invest in your <span className="neon-text">next offer</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-white/60">One Pro month costs less than a single coaching session — and your AI interviewer never gets tired.</p>
        </div>
      )}

      <div className="mb-8 flex justify-center">
        <div className="glass inline-flex p-1 text-sm">
          {[false, true].map((y) => (
            <button
              key={String(y)}
              onClick={() => setYearly(y)}
              className={`rounded-xl px-4 py-2 transition ${yearly === y ? "bg-white/10 text-white" : "text-white/50"}`}
            >
              {y ? "Yearly · save 25%" : "Monthly"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="glass flex flex-col p-8" data-testid="plan-free">
          <h3 className="text-lg font-semibold">Free</h3>
          <p className="mt-1 text-sm text-white/50">For getting started</p>
          <p className="mt-6 font-[family-name:var(--font-display)] text-5xl font-bold">₹0</p>
          <ul className="mt-6 flex-1 space-y-3 text-sm text-white/70">
            {FREE_FEATURES.map((f) => <li key={f} className="flex gap-2"><span className="text-cyan-300">✓</span>{f}</li>)}
          </ul>
          <button className="btn-ghost mt-8 w-full" onClick={() => choose("free")} disabled={plan === "free"}>
            {plan === "free" ? "Current plan" : "Switch to Free"}
          </button>
        </div>

        <div className="relative rounded-2xl bg-gradient-to-br from-cyan-400 via-violet-500 to-pink-500 p-px shadow-[0_0_60px_-15px_rgb(168_85_247/0.9)]" data-testid="plan-pro">
          <div className="flex h-full flex-col rounded-2xl bg-[#0b0c1a]/95 p-8 backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Pro</h3>
              <span className="chip border-amber-300/40 bg-amber-300/10 text-amber-200">Most popular</span>
            </div>
            <p className="mt-1 text-sm text-white/50">For serious job seekers</p>
            <p className="mt-6 font-[family-name:var(--font-display)] text-5xl font-bold">
              ₹{yearly ? yearlyPrice.toLocaleString("en-IN") : PRO_PRICE_INR}
              <span className="text-lg font-normal text-white/40">/{yearly ? "yr" : "mo"}</span>
            </p>
            <ul className="mt-6 flex-1 space-y-3 text-sm text-white/80">
              {PRO_FEATURES.map((f) => <li key={f} className="flex gap-2"><span className="text-pink-300">★</span>{f}</li>)}
            </ul>
            {plan === "pro" ? (
              <button className="btn-ghost mt-8 w-full" disabled>★ You&apos;re on Pro</button>
            ) : (
              <button className="btn-neon mt-8 w-full" onClick={() => setCheckout(true)} data-testid="go-pro">
                Go Pro — ₹{PRO_PRICE_INR}/mo
              </button>
            )}
          </div>
        </div>
      </div>

      {checkout && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-5 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="glass-strong animate-fade-up w-full max-w-md p-8">
            <h3 className="font-[family-name:var(--font-display)] text-2xl font-bold">Demo checkout</h3>
            <p className="mt-3 text-sm text-white/60">
              This MVP runs in demo mode — no payment is taken. In production this button opens Razorpay / Stripe checkout for
              ₹{yearly ? `${yearlyPrice.toLocaleString("en-IN")}/yr` : `${PRO_PRICE_INR}/mo`}.
            </p>
            <div className="mt-8 flex gap-3">
              <button
                className="btn-neon flex-1"
                data-testid="confirm-pro"
                onClick={() => {
                  choose("pro");
                  setCheckout(false);
                }}
              >
                Activate Pro (demo)
              </button>
              <button className="btn-ghost" onClick={() => setCheckout(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
