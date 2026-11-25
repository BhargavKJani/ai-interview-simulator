import { billingDeps, billingOff } from "@/lib/billing/deps";
import { webhookHandler } from "@/lib/billing/handlers";

export async function POST(request: Request) {
  const d = billingDeps();
  if (!d) return billingOff();
  const raw = await request.text();
  try {
    const { status, body } = await webhookHandler(d, raw, request.headers.get("x-razorpay-signature") ?? "");
    return Response.json(body, { status });
  } catch (err) {
    console.error("[billing] webhook failed:", (err as Error).message);
    return Response.json({ error: "Temporary failure" }, { status: 500 }); // Razorpay retries non-2xx
  }
}
