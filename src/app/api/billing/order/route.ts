import { billingDeps, billingOff, readJSON } from "@/lib/billing/deps";
import { bearer, orderHandler } from "@/lib/billing/handlers";

export async function POST(request: Request) {
  const d = billingDeps();
  if (!d) return billingOff();
  try {
    const { status, body } = await orderHandler(d, bearer(request.headers.get("authorization")), await readJSON(request));
    return Response.json(body, { status });
  } catch (err) {
    console.error("[billing] order failed:", (err as Error).message);
    return Response.json({ error: "Could not start the payment. Please try again." }, { status: 502 });
  }
}
