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

/** Copy for the pricing page. */
export const PRICING_COPY = {
  chip: "Pay by UPI · no auto-renewal",
  title: "Practise for less than",
  titleAccent: "a cup of chai",
  sub: "Start free. When you need more, pay once with GPay, PhonePe, Paytm or any UPI app. Plans end on their own; nothing renews.",
  free: "Try the AI interviewer",
  day: "One focused day of practice",
  month: "For serious job seekers",
};

export const PLAN_FEATURES: Record<PlanId, string[]> = {
  free: [
    `${FREE_LIMIT} AI interviews with Claude`,
    "Unlimited practice on the demo question bank",
    "Up to 5 questions per interview",
    "Frontend, Android, Data Analyst and HR roles",
    "Report card and progress dashboard",
  ],
  day: [
    `Up to ${PAID_PLANS.day.limit} AI interviews in 24 hours`,
    "All 6 roles, including Backend and Product Manager",
    "Up to 10 questions per interview",
    "Adaptive follow-up questions and model answers",
    "Perfect the night before an interview",
  ],
  month: [
    `Up to ${PAID_PLANS.month.limit} AI interviews in 30 days`,
    "All 6 roles, including Backend and Product Manager",
    "Up to 10 questions per interview",
    "Adaptive follow-up questions and model answers",
    "Best value for placement season",
  ],
};

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
