import { billingEnabled } from "./config";
import type { Deps } from "./handlers";
import { createOrder } from "./razorpay";
import { getStore } from "./store";

export function billingDeps(): Deps | null {
  if (!billingEnabled()) return null;
  return {
    store: getStore(),
    createOrder: (input) => createOrder(input),
    keyId: process.env.RAZORPAY_KEY_ID!,
    keySecret: process.env.RAZORPAY_KEY_SECRET!,
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET ?? "",
  };
}

export const billingOff = () => Response.json({ error: "Payments are not set up yet" }, { status: 503 });

export async function readJSON(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
