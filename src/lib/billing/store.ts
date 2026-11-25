import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { PaidPlanId, PlanId } from "./config";

export interface BillingUser {
  id: string;
  email: string | null;
}

export interface Entitlement {
  plan: PlanId;
  expiresAt: string | null;
  freeUsed: number;
  periodUsed: number;
}

export interface ConsumeResult {
  allowed: boolean;
  reason: "ok" | "limit";
  sessionId: string | null;
  plan: PlanId;
  used: number;
  limit: number;
  expiresAt: string | null;
}

export interface ActivateResult {
  activated: boolean;
  plan: PlanId | null;
  expiresAt: string | null;
}

/** Everything the billing handlers need from the database. Swappable for tests. */
export interface BillingStore {
  userFromToken(token: string): Promise<BillingUser | null>;
  status(userId: string, app: string): Promise<Entitlement>;
  consume(userId: string, app: string, limits: { free: number; day: number; month: number; maxCalls: number }): Promise<ConsumeResult>;
  useCall(sessionId: string, userId: string): Promise<boolean>;
  createPayment(p: { orderId: string; userId: string; app: string; plan: PaidPlanId; amount: number }): Promise<void>;
  getPayment(orderId: string): Promise<{ userId: string; app: string; plan: PaidPlanId; amount: number; status: "created" | "paid" } | null>;
  activate(orderId: string, paymentId: string): Promise<ActivateResult>;
}

type Row = Record<string, unknown>;
const first = (data: unknown): Row => (Array.isArray(data) ? (data[0] as Row) : (data as Row)) ?? {};

export class SupabaseBillingStore implements BillingStore {
  constructor(private db: SupabaseClient) {}

  async userFromToken(token: string) {
    if (!token) return null;
    const { data, error } = await this.db.auth.getUser(token);
    if (error || !data.user) return null;
    return { id: data.user.id, email: data.user.email ?? null };
  }

  async status(userId: string, app: string): Promise<Entitlement> {
    const { data, error } = await this.db.rpc("billing_status", { p_user: userId, p_app: app });
    if (error) throw new Error(error.message);
    const r = first(data);
    return {
      plan: (r.plan as PlanId) ?? "free",
      expiresAt: (r.expires_at as string) ?? null,
      freeUsed: Number(r.free_used ?? 0),
      periodUsed: Number(r.period_used ?? 0),
    };
  }

  async consume(userId: string, app: string, l: { free: number; day: number; month: number; maxCalls: number }): Promise<ConsumeResult> {
    const { data, error } = await this.db.rpc("consume_use", {
      p_user: userId, p_app: app, p_free_limit: l.free, p_day_limit: l.day, p_month_limit: l.month, p_max_calls: l.maxCalls,
    });
    if (error) throw new Error(error.message);
    const r = first(data);
    return {
      allowed: Boolean(r.allowed),
      reason: r.reason === "ok" ? "ok" : "limit",
      sessionId: (r.session_id as string) ?? null,
      plan: (r.plan as PlanId) ?? "free",
      used: Number(r.used ?? 0),
      limit: Number(r.use_limit ?? 0),
      expiresAt: (r.expires_at as string) ?? null,
    };
  }

  async useCall(sessionId: string, userId: string) {
    const { data, error } = await this.db.rpc("use_session_call", { p_session: sessionId, p_user: userId });
    if (error) return false;
    return data === true;
  }

  async createPayment(p: { orderId: string; userId: string; app: string; plan: PaidPlanId; amount: number }) {
    const { error } = await this.db.from("payments").insert({ order_id: p.orderId, user_id: p.userId, app: p.app, plan: p.plan, amount: p.amount });
    if (error) throw new Error(error.message);
  }

  async getPayment(orderId: string) {
    const { data, error } = await this.db.from("payments").select("user_id, app, plan, amount, status").eq("order_id", orderId).maybeSingle();
    if (error || !data) return null;
    return { userId: data.user_id as string, app: data.app as string, plan: data.plan as PaidPlanId, amount: Number(data.amount), status: data.status as "created" | "paid" };
  }

  async activate(orderId: string, paymentId: string): Promise<ActivateResult> {
    const { data, error } = await this.db.rpc("activate_order", { p_order: orderId, p_payment: paymentId });
    if (error) throw new Error(error.message);
    const r = first(data);
    return { activated: Boolean(r.activated), plan: (r.plan as PlanId) ?? null, expiresAt: (r.expires_at as string) ?? null };
  }
}

let store: BillingStore | null = null;
export function getStore(): BillingStore {
  store ??= new SupabaseBillingStore(
    createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
  );
  return store;
}
