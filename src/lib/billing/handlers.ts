import { APP_ID, FREE_LIMIT, isPaidPlan, MAX_CALLS_PER_USE, PAID_PLANS, type PlanId } from "./config";
import type { RazorpayOrder } from "./razorpay";
import { verifyPaymentSignature, verifyWebhookSignature } from "./razorpay";
import type { BillingStore, Entitlement } from "./store";

/** Framework-agnostic billing handlers, unit-tested with an in-memory store. */

export type Result<T> = { status: number; body: T | { error: string } };

export interface Deps {
  store: BillingStore;
  createOrder: (input: { amount: number; receipt: string; notes: Record<string, string> }) => Promise<RazorpayOrder>;
  keyId: string;
  keySecret: string;
  webhookSecret: string;
  app?: string;
}

export interface Account {
  plan: PlanId;
  paid: boolean;
  expiresAt: string | null;
  used: number;
  limit: number;
  left: number;
}

export function toAccount(e: Entitlement): Account {
  const paid = e.plan !== "free";
  const limit = paid ? PAID_PLANS[e.plan as "day" | "month"].limit : FREE_LIMIT;
  const used = paid ? e.periodUsed : e.freeUsed;
  return { plan: e.plan, paid, expiresAt: paid ? e.expiresAt : null, used, limit, left: Math.max(0, limit - used) };
}

export function bearer(authorization: string | null | undefined): string {
  const m = /^Bearer\s+(.+)$/i.exec(authorization ?? "");
  return m ? m[1].trim() : "";
}

const unauthorised = { status: 401, body: { error: "Please sign in" } } as const;

export async function meHandler(d: Deps, token: string): Promise<Result<{ email: string | null; account: Account }>> {
  const user = await d.store.userFromToken(token);
  if (!user) return unauthorised;
  return { status: 200, body: { email: user.email, account: toAccount(await d.store.status(user.id, d.app ?? APP_ID)) } };
}

/** Start one AI use. Returns a session id that the AI routes accept, or 402 when the plan's limit is reached. */
export async function startHandler(d: Deps, token: string): Promise<Result<{ sessionId: string; account: Account }>> {
  const user = await d.store.userFromToken(token);
  if (!user) return unauthorised;
  const app = d.app ?? APP_ID;
  const r = await d.store.consume(user.id, app, {
    free: FREE_LIMIT, day: PAID_PLANS.day.limit, month: PAID_PLANS.month.limit, maxCalls: MAX_CALLS_PER_USE,
  });
  if (!r.allowed || !r.sessionId) {
    return { status: 402, body: { error: r.plan === "free" ? "Your free AI uses are finished. Choose a plan to continue." : "You have reached this plan's limit. Buy another pass to continue." } };
  }
  return { status: 200, body: { sessionId: r.sessionId, account: toAccount(await d.store.status(user.id, app)) } };
}

/** True when the request carries a signed-in user and a live AI session with calls left. */
export async function aiAllowed(d: Pick<Deps, "store">, token: string, sessionId: unknown): Promise<boolean> {
  if (!token || typeof sessionId !== "string" || !/^[0-9a-f-]{36}$/i.test(sessionId)) return false;
  const user = await d.store.userFromToken(token);
  if (!user) return false;
  return d.store.useCall(sessionId, user.id);
}

export async function orderHandler(d: Deps, token: string, input: unknown): Promise<Result<{ orderId: string; amount: number; currency: string; keyId: string; plan: string; email: string | null }>> {
  const user = await d.store.userFromToken(token);
  if (!user) return unauthorised;
  const planId = (input as { plan?: unknown } | null)?.plan;
  if (!isPaidPlan(planId)) return { status: 400, body: { error: "Unknown plan" } };
  const plan = PAID_PLANS[planId];
  const app = d.app ?? APP_ID;
  const order = await d.createOrder({
    amount: plan.amount,
    receipt: `${app}-${planId}-${Date.now()}`,
    notes: { app, plan: planId, user_id: user.id },
  });
  await d.store.createPayment({ orderId: order.id, userId: user.id, app, plan: planId, amount: plan.amount });
  return { status: 200, body: { orderId: order.id, amount: plan.amount, currency: "INR", keyId: d.keyId, plan: planId, email: user.email } };
}

/** Called by the browser right after Razorpay Checkout succeeds. */
export async function verifyHandler(d: Deps, token: string, input: unknown): Promise<Result<{ account: Account }>> {
  const user = await d.store.userFromToken(token);
  if (!user) return unauthorised;
  const b = (input ?? {}) as Record<string, unknown>;
  const orderId = String(b.razorpay_order_id ?? "");
  const paymentId = String(b.razorpay_payment_id ?? "");
  const signature = String(b.razorpay_signature ?? "");
  if (!verifyPaymentSignature(orderId, paymentId, signature, d.keySecret)) return { status: 400, body: { error: "Payment could not be verified" } };
  const payment = await d.store.getPayment(orderId);
  if (!payment || payment.userId !== user.id) return { status: 404, body: { error: "Order not found" } };
  await d.store.activate(orderId, paymentId);
  return { status: 200, body: { account: toAccount(await d.store.status(user.id, payment.app)) } };
}

/**
 * Razorpay webhook (payment.captured / order.paid). Switches the plan on even if the buyer closed
 * the tab before the browser could call verify.
 */
export async function webhookHandler(d: Deps, rawBody: string, signature: string): Promise<Result<{ ok: true; activated: boolean }>> {
  if (!d.webhookSecret) return { status: 503, body: { error: "Webhook secret not configured" } };
  if (!verifyWebhookSignature(rawBody, signature, d.webhookSecret)) return { status: 400, body: { error: "Bad signature" } };
  let evt: { event?: string; payload?: { payment?: { entity?: { id?: string; order_id?: string; amount?: number; status?: string } } } };
  try {
    evt = JSON.parse(rawBody);
  } catch {
    return { status: 400, body: { error: "Invalid JSON" } };
  }
  if (evt.event !== "payment.captured" && evt.event !== "order.paid") return { status: 200, body: { ok: true, activated: false } };
  const p = evt.payload?.payment?.entity;
  if (!p?.id || !p.order_id) return { status: 200, body: { ok: true, activated: false } };
  const payment = await d.store.getPayment(p.order_id);
  // Orders from another app sharing this Razorpay account are ignored here and handled by that app's webhook.
  if (!payment || payment.app !== (d.app ?? APP_ID)) return { status: 200, body: { ok: true, activated: false } };
  if (typeof p.amount === "number" && p.amount !== payment.amount) return { status: 400, body: { error: "Amount mismatch" } };
  const r = await d.store.activate(p.order_id, p.id);
  return { status: 200, body: { ok: true, activated: r.activated } };
}
