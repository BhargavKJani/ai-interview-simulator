import { createHmac, timingSafeEqual } from "node:crypto";

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
}

function safeEqualHex(a: string, b: string): boolean {
  const x = Buffer.from(a, "utf8");
  const y = Buffer.from(b, "utf8");
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Checkout success: Razorpay signs `order_id|payment_id` with your key secret. */
export function verifyPaymentSignature(orderId: string, paymentId: string, signature: string, secret: string): boolean {
  if (!orderId || !paymentId || !signature || !secret) return false;
  const expected = createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
  return safeEqualHex(expected, signature);
}

/** Webhooks: Razorpay signs the raw request body with your webhook secret. */
export function verifyWebhookSignature(rawBody: string, signature: string, secret: string): boolean {
  if (!rawBody || !signature || !secret) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  return safeEqualHex(expected, signature);
}

export async function createOrder(
  input: { amount: number; receipt: string; notes: Record<string, string> },
  keyId = process.env.RAZORPAY_KEY_ID ?? "",
  keySecret = process.env.RAZORPAY_KEY_SECRET ?? "",
): Promise<RazorpayOrder> {
  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
    },
    body: JSON.stringify({ amount: input.amount, currency: "INR", receipt: input.receipt.slice(0, 40), notes: input.notes }),
  });
  if (!res.ok) throw new Error(`Razorpay order failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  const o = (await res.json()) as RazorpayOrder;
  if (!o?.id) throw new Error("Razorpay order response had no id");
  return o;
}
