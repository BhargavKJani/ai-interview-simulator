import { createHmac, randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { APP_ID, FREE_LIMIT, MAX_CALLS_PER_USE, PAID_PLANS, type PaidPlanId, type PlanId } from "@/lib/billing/config";
import {
  aiAllowed, bearer, meHandler, orderHandler, startHandler, toAccount, verifyHandler, webhookHandler, type Deps,
} from "@/lib/billing/handlers";
import { verifyPaymentSignature, verifyWebhookSignature } from "@/lib/billing/razorpay";
import type { BillingStore, Entitlement } from "@/lib/billing/store";

const SECRET = "key_secret_test";
const WEBHOOK = "whsec_test";
const sign = (s: string, k: string) => createHmac("sha256", k).update(s).digest("hex");

/** In-memory copy of the SQL functions in supabase/schema.sql. */
class MemoryStore implements BillingStore {
  now = Date.now();
  users = new Map([["tok-a", { id: "user-a", email: "a@example.com" }], ["tok-b", { id: "user-b", email: "b@example.com" }]]);
  ents = new Map<string, Entitlement>();
  payments = new Map<string, { userId: string; app: string; plan: PaidPlanId; amount: number; status: "created" | "paid" }>();
  sessions = new Map<string, { userId: string; calls: number; max: number }>();

  private ent(userId: string, app: string) {
    const k = `${userId}:${app}`;
    let e = this.ents.get(k) ?? { plan: "free" as PlanId, expiresAt: null, freeUsed: 0, periodUsed: 0 };
    if (e.plan !== "free" && (!e.expiresAt || Date.parse(e.expiresAt) <= this.now)) e = { ...e, plan: "free", expiresAt: null, periodUsed: 0 };
    this.ents.set(k, e);
    return e;
  }
  async userFromToken(t: string) { return this.users.get(t) ?? null; }
  async status(u: string, a: string) { return { ...this.ent(u, a) }; }
  async consume(u: string, a: string, l: { free: number; day: number; month: number; maxCalls: number }) {
    const e = this.ent(u, a);
    const cap = e.plan === "free" ? l.free : e.plan === "day" ? l.day : l.month;
    const used = e.plan === "free" ? e.freeUsed : e.periodUsed;
    if (used >= cap) return { allowed: false, reason: "limit" as const, sessionId: null, plan: e.plan, used, limit: cap, expiresAt: e.expiresAt };
    if (e.plan === "free") e.freeUsed++; else e.periodUsed++;
    const id = randomUUID();
    this.sessions.set(id, { userId: u, calls: 0, max: l.maxCalls });
    return { allowed: true, reason: "ok" as const, sessionId: id, plan: e.plan, used: used + 1, limit: cap, expiresAt: e.expiresAt };
  }
  async useCall(id: string, u: string) {
    const s = this.sessions.get(id);
    if (!s || s.userId !== u || s.calls >= s.max) return false;
    s.calls++;
    return true;
  }
  async createPayment(p: { orderId: string; userId: string; app: string; plan: PaidPlanId; amount: number }) {
    this.payments.set(p.orderId, { userId: p.userId, app: p.app, plan: p.plan, amount: p.amount, status: "created" });
  }
  async getPayment(id: string) { return this.payments.get(id) ?? null; }
  async activate(orderId: string) {
    const p = this.payments.get(orderId);
    if (!p) return { activated: false, plan: null, expiresAt: null };
    const e = this.ent(p.userId, p.app);
    if (p.status === "paid") return { activated: false, plan: e.plan, expiresAt: e.expiresAt };
    p.status = "paid";
    const span = p.plan === "day" ? 864e5 : 30 * 864e5;
    if (e.plan === p.plan && e.expiresAt && Date.parse(e.expiresAt) > this.now) Object.assign(e, { expiresAt: new Date(Date.parse(e.expiresAt) + span).toISOString(), periodUsed: 0 });
    else Object.assign(e, { plan: p.plan, expiresAt: new Date(this.now + span).toISOString(), periodUsed: 0 });
    return { activated: true, plan: e.plan, expiresAt: e.expiresAt };
  }
}

let store: MemoryStore;
let deps: Deps;
let orderSeq = 0;

beforeEach(() => {
  store = new MemoryStore();
  deps = {
    store,
    createOrder: vi.fn(async ({ amount }) => ({ id: `order_${++orderSeq}`, amount, currency: "INR" })),
    keyId: "rzp_test_key",
    keySecret: SECRET,
    webhookSecret: WEBHOOK,
  };
});

async function buy(plan: PaidPlanId, token = "tok-a") {
  const o = await orderHandler(deps, token, { plan });
  const { orderId } = o.body as { orderId: string };
  const paymentId = `pay_${orderId}`;
  return verifyHandler(deps, token, { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: sign(`${orderId}|${paymentId}`, SECRET) });
}

describe("signatures", () => {
  it("accepts Razorpay's checkout signature and rejects tampering", () => {
    expect(verifyPaymentSignature("order_1", "pay_1", sign("order_1|pay_1", SECRET), SECRET)).toBe(true);
    expect(verifyPaymentSignature("order_1", "pay_2", sign("order_1|pay_1", SECRET), SECRET)).toBe(false);
    expect(verifyPaymentSignature("order_1", "pay_1", "", SECRET)).toBe(false);
  });
  it("checks webhook bodies", () => {
    expect(verifyWebhookSignature('{"a":1}', sign('{"a":1}', WEBHOOK), WEBHOOK)).toBe(true);
    expect(verifyWebhookSignature('{"a":2}', sign('{"a":1}', WEBHOOK), WEBHOOK)).toBe(false);
  });
  it("reads bearer tokens", () => {
    expect(bearer("Bearer abc")).toBe("abc");
    expect(bearer(null)).toBe("");
  });
});

describe("free plan", () => {
  it("requires sign-in", async () => {
    expect((await startHandler(deps, "")).status).toBe(401);
    expect((await meHandler(deps, "bad")).status).toBe(401);
  });

  it(`allows ${FREE_LIMIT} AI uses, then asks to pay`, async () => {
    for (let i = 0; i < FREE_LIMIT; i++) expect((await startHandler(deps, "tok-a")).status).toBe(200);
    const r = await startHandler(deps, "tok-a");
    expect(r.status).toBe(402);
    const me = (await meHandler(deps, "tok-a")).body as { account: { left: number; plan: string } };
    expect(me.account).toMatchObject({ plan: "free", left: 0 });
  });

  it("limits AI calls to a real session owned by the caller", async () => {
    const { sessionId } = (await startHandler(deps, "tok-a")).body as { sessionId: string };
    expect(await aiAllowed(deps, "tok-a", sessionId)).toBe(true);
    expect(await aiAllowed(deps, "tok-b", sessionId)).toBe(false);
    expect(await aiAllowed(deps, "tok-a", "not-a-session")).toBe(false);
    expect(await aiAllowed(deps, "", sessionId)).toBe(false);
    for (let i = 1; i < MAX_CALLS_PER_USE; i++) await aiAllowed(deps, "tok-a", sessionId);
    expect(await aiAllowed(deps, "tok-a", sessionId)).toBe(false);
  });
});

describe("buying a plan", () => {
  it("creates an order for the right amount and rejects unknown plans", async () => {
    expect((await orderHandler(deps, "tok-a", { plan: "lifetime" })).status).toBe(400);
    expect((await orderHandler(deps, "", { plan: "day" })).status).toBe(401);
    const r = await orderHandler(deps, "tok-a", { plan: "month" });
    expect(r.body).toMatchObject({ amount: PAID_PLANS.month.amount, currency: "INR", keyId: "rzp_test_key" });
    expect(deps.createOrder).toHaveBeenCalledWith(expect.objectContaining({ amount: PAID_PLANS.month.amount }));
  });

  it("switches the day pass on after a verified payment", async () => {
    const r = await buy("day");
    expect(r.status).toBe(200);
    const acc = (r.body as { account: ReturnType<typeof toAccount> }).account;
    expect(acc).toMatchObject({ plan: "day", paid: true, left: PAID_PLANS.day.limit });
    for (let i = 0; i < PAID_PLANS.day.limit; i++) expect((await startHandler(deps, "tok-a")).status).toBe(200);
    expect((await startHandler(deps, "tok-a")).status).toBe(402);
    await buy("day");
    expect((await startHandler(deps, "tok-a")).status).toBe(200);
  });

  it("refuses a forged signature and another user's order", async () => {
    const { orderId } = (await orderHandler(deps, "tok-a", { plan: "month" })).body as { orderId: string };
    expect((await verifyHandler(deps, "tok-a", { razorpay_order_id: orderId, razorpay_payment_id: "pay_x", razorpay_signature: "forged" })).status).toBe(400);
    const sig = sign(`${orderId}|pay_x`, SECRET);
    expect((await verifyHandler(deps, "tok-b", { razorpay_order_id: orderId, razorpay_payment_id: "pay_x", razorpay_signature: sig })).status).toBe(404);
    expect((await meHandler(deps, "tok-a")).body).toMatchObject({ account: { plan: "free" } });
  });

  it("extends an active plan when bought again, and expires it later", async () => {
    await buy("month");
    const first = store.ents.get(`user-a:${APP_ID}`)!.expiresAt!;
    await buy("month");
    const second = store.ents.get(`user-a:${APP_ID}`)!.expiresAt!;
    expect(Date.parse(second) - Date.parse(first)).toBe(30 * 864e5);
    store.now += 61 * 864e5;
    expect((await meHandler(deps, "tok-a")).body).toMatchObject({ account: { plan: "free", paid: false } });
  });
});

describe("webhook", () => {
  const event = (orderId: string, amount: number) =>
    JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: `pay_w_${orderId}`, order_id: orderId, amount, status: "captured" } } } });

  it("activates the plan even if the browser never called verify", async () => {
    const { orderId } = (await orderHandler(deps, "tok-b", { plan: "day" })).body as { orderId: string };
    const body = event(orderId, PAID_PLANS.day.amount);
    const r = await webhookHandler(deps, body, sign(body, WEBHOOK));
    expect(r.body).toEqual({ ok: true, activated: true });
    expect((await meHandler(deps, "tok-b")).body).toMatchObject({ account: { plan: "day" } });
    // Razorpay retries: a second delivery changes nothing.
    expect((await webhookHandler(deps, body, sign(body, WEBHOOK))).body).toEqual({ ok: true, activated: false });
  });

  it("rejects bad signatures and wrong amounts, and ignores other events", async () => {
    const { orderId } = (await orderHandler(deps, "tok-b", { plan: "month" })).body as { orderId: string };
    expect((await webhookHandler(deps, event(orderId, PAID_PLANS.month.amount), "nope")).status).toBe(400);
    const cheap = event(orderId, 100);
    expect((await webhookHandler(deps, cheap, sign(cheap, WEBHOOK))).status).toBe(400);
    const other = JSON.stringify({ event: "refund.created" });
    expect((await webhookHandler(deps, other, sign(other, WEBHOOK))).body).toEqual({ ok: true, activated: false });
    expect((await meHandler(deps, "tok-b")).body).toMatchObject({ account: { plan: "free" } });
  });
});
