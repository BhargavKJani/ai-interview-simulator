/**
 * Plans and prices for this app. The same billing module is shared by all of Bhargav's apps;
 * only this file changes between them.
 */

export const APP_ID = "interview";
export const APP_NAME = "InterviewAI";
/** What one AI "use" is called in this app. */
export const USE_NAME = { one: "AI interview", many: "AI interviews" };

export type PaidPlanId = "day" | "month";
export type PlanId = "free" | PaidPlanId;

export interface PaidPlan {
  id: PaidPlanId;
  name: string;
  /** Price in paise (₹1 = 100 paise), as Razorpay expects. */
  amount: number;
  /** How long the plan lasts once paid. */
  durationLabel: string;
  /** Most AI uses allowed while the plan is active. */
  limit: number;
}

export const FREE_LIMIT = 3;

export const PAID_PLANS: Record<PaidPlanId, PaidPlan> = {
  day: { id: "day", name: "Day pass", amount: 900, durationLabel: "24 hours", limit: 10 },
  month: { id: "month", name: "Monthly", amount: 4900, durationLabel: "30 days", limit: 60 },
};

/** Most AI calls one use may make (an interview asks up to 10 questions and scores each answer). */
export const MAX_CALLS_PER_USE = 22;

export function isPaidPlan(v: unknown): v is PaidPlanId {
  return v === "day" || v === "month";
}

export const rupees = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN")}`;

/** Billing is on only when every key it needs is set. Without them the app stays in free demo mode. */
export function billingEnabled(): boolean {
  return [
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    process.env.RAZORPAY_KEY_ID,
    process.env.RAZORPAY_KEY_SECRET,
  ].every((v) => Boolean(v?.trim()));
}
