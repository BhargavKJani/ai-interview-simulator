"use client";

import { useState } from "react";
import { APP_NAME, FREE_LIMIT, PAID_PLANS, rupees, USE_NAME, type PaidPlanId } from "@/lib/billing/config";
import { useAccount } from "./AccountProvider";

interface RazorpayResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void; on: (e: string, cb: (r: unknown) => void) => void };
  }
}

function loadCheckout(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Could not load the payment window. Check your internet and try again."));
    document.body.appendChild(s);
  });
}

const FEATURES: Record<"free" | PaidPlanId, string[]> = {
  free: [
    `${FREE_LIMIT} ${USE_NAME.many} with Claude`,
    "Unlimited practice on the demo question bank",
    "Up to 5 questions per interview",
    "Frontend, Android, Data Analyst and HR roles",
    "Report card and progress dashboard",
  ],
  day: [
    `Up to ${PAID_PLANS.day.limit} ${USE_NAME.many} in 24 hours`,
    "All 6 roles, including Backend and Product Manager",
    "Up to 10 questions per interview",
    "Adaptive follow-up questions and model answers",
    "Perfect the night before an interview",
  ],
  month: [
    `Up to ${PAID_PLANS.month.limit} ${USE_NAME.many} in 30 days`,
    "All 6 roles, including Backend and Product Manager",
    "Up to 10 questions per interview",
    "Adaptive follow-up questions and model answers",
    "Best value for placement season",
  ],
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

export function BillingPricing({ compact = false }: { compact?: boolean }) {
  const acc = useAccount();
  const [busy, setBusy] = useState<PaidPlanId | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "err" | "info"; text: string } | null>(null);

  const buy = async (planId: PaidPlanId) => {
    setMsg(null);
    if (!acc.account) {
      await acc.signIn();
      return;
    }
    setBusy(planId);
    try {
      const token = await acc.token();
      const res = await fetch("/api/billing/order", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan: planId }),
      });
      const order = await res.json();
      if (!res.ok) throw new Error(order.error ?? "Could not start the payment");
      await loadCheckout();
      const plan = PAID_PLANS[planId];

      const rzp = new window.Razorpay!({
        key: order.keyId,
        amount: order.amount,
        currency: "INR",
        order_id: order.orderId,
        name: APP_NAME,
        description: `${plan.name} · ${plan.durationLabel}`,
        prefill: { email: order.email ?? acc.email ?? "" },
        theme: { color: "#8b5cf6" },
        // UPI only: GPay, PhonePe, Paytm, BHIM and any UPI app, by QR or app.
        config: {
          display: {
            blocks: { upi: { name: "Pay with UPI", instruments: [{ method: "upi" }] } },
            sequence: ["block.upi"],
            preferences: { show_default_blocks: false },
          },
        },
        handler: async (r: RazorpayResponse) => {
          setMsg({ kind: "info", text: "Payment received. Switching your plan on…" });
          try {
            const v = await fetch("/api/billing/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${await acc.token()}` },
              body: JSON.stringify(r),
            });
            const body = await v.json();
            if (!v.ok) throw new Error(body.error);
            await acc.refresh();
            setMsg({ kind: "ok", text: `${plan.name} is active until ${fmtDate(body.account.expiresAt)}. Enjoy your interviews!` });
          } catch {
            // The Razorpay webhook activates the plan even if this call fails.
            setMsg({ kind: "info", text: "Payment received. Your plan will switch on within a minute; refresh this page if it doesn't." });
            setTimeout(() => void acc.refresh(), 15000);
          }
        },
        modal: {
          ondismiss: () => setMsg({ kind: "info", text: "Payment cancelled. No money was taken." }),
        },
      });
      rzp.on("payment.failed", () =>
        setMsg({ kind: "err", text: "The payment failed. If money left your account, UPI returns it automatically, usually within a few days." }),
      );
      rzp.open();
    } catch (e) {
      setMsg({ kind: "err", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const current = acc.account;
  const cards: { id: "free" | PaidPlanId; name: string; price: string; per: string; sub: string; highlight?: boolean }[] = [
    { id: "free", name: "Free", price: "₹0", per: "", sub: "Try the AI interviewer" },
    { id: "day", name: PAID_PLANS.day.name, price: rupees(PAID_PLANS.day.amount), per: "/ 24 hours", sub: "One focused day of practice" },
    { id: "month", name: PAID_PLANS.month.name, price: rupees(PAID_PLANS.month.amount), per: "/ 30 days", sub: "For serious job seekers", highlight: true },
  ];

  return (
    <div className={compact ? "" : "mx-auto max-w-6xl px-5 py-16"}>
      {!compact && (
        <div className="animate-fade-up mb-10 text-center">
          <p className="chip mx-auto mb-4">Pay by UPI · no auto-renewal</p>
          <h1 className="font-[family-name:var(--font-display)] text-4xl font-bold sm:text-5xl">
            Practise for less than <span className="neon-text">a cup of chai</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-white/60">
            Start free. When you need more, pay once with GPay, PhonePe, Paytm or any UPI app. Plans end on their own; nothing renews.
          </p>
        </div>
      )}

      {current && (
        <p className="mb-6 text-center text-sm text-white/60" data-testid="current-plan">
          {current.paid
            ? `You're on the ${PAID_PLANS[current.plan as PaidPlanId].name} until ${fmtDate(current.expiresAt!)} · ${current.left} of ${current.limit} ${USE_NAME.many} left`
            : `Free plan · ${current.left} of ${current.limit} ${USE_NAME.many} left`}
        </p>
      )}

      {msg && (
        <div
          role="status"
          className={`mx-auto mb-6 max-w-2xl rounded-xl border p-4 text-center text-sm ${
            msg.kind === "ok" ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200"
              : msg.kind === "err" ? "border-pink-400/40 bg-pink-500/10 text-pink-200"
                : "border-cyan-400/30 bg-cyan-500/10 text-cyan-100"
          }`}
        >
          {msg.text}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        {cards.map((c) => {
          const active = current?.plan === c.id;
          const inner = (
            <div className={`flex h-full flex-col p-8 ${c.highlight ? "rounded-2xl bg-[#0b0c1a]/95 backdrop-blur-xl" : ""}`}>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">{c.name}</h3>
                {c.highlight && <span className="chip border-amber-300/40 bg-amber-300/10 text-amber-200">Best value</span>}
              </div>
              <p className="mt-1 text-sm text-white/50">{c.sub}</p>
              <p className="mt-6 font-[family-name:var(--font-display)] text-5xl font-bold">
                {c.price}
                <span className="text-lg font-normal text-white/40"> {c.per}</span>
              </p>
              <ul className="mt-6 flex-1 space-y-3 text-sm text-white/75">
                {FEATURES[c.id].map((f) => (
                  <li key={f} className="flex gap-2"><span className={c.id === "free" ? "text-cyan-300" : "text-pink-300"}>✓</span>{f}</li>
                ))}
              </ul>
              {c.id === "free" ? (
                current ? (
                  <button className="btn-ghost mt-8 w-full" disabled>{active ? "Current plan" : "Included"}</button>
                ) : (
                  <button className="btn-ghost mt-8 w-full" onClick={() => void acc.signIn()}>Sign in with Google</button>
                )
              ) : (
                <button
                  className={`${c.highlight ? "btn-neon" : "btn-ghost"} mt-8 w-full`}
                  disabled={busy !== null}
                  onClick={() => void buy(c.id as PaidPlanId)}
                  data-testid={`buy-${c.id}`}
                >
                  {busy === c.id ? "Opening UPI…" : !current ? `Sign in to buy · ${c.price}` : active ? `Add another · ${c.price}` : `Pay ${c.price} with UPI`}
                </button>
              )}
            </div>
          );
          return c.highlight ? (
            <div key={c.id} className="relative rounded-2xl bg-gradient-to-br from-cyan-400 via-violet-500 to-pink-500 p-px shadow-[0_0_60px_-15px_rgb(168_85_247/0.9)]" data-testid={`plan-${c.id}`}>
              {inner}
            </div>
          ) : (
            <div key={c.id} className="glass" data-testid={`plan-${c.id}`}>{inner}</div>
          );
        })}
      </div>

      <p className="mt-8 text-center text-xs text-white/40">
        Secure UPI payments by Razorpay. Buying the same plan again while it&apos;s active adds more time and resets your AI interviews.
        Questions? Email er.janibhargavk@gmail.com.
      </p>
    </div>
  );
}
