import { billingDeps, billingOff, readJSON } from "@/lib/billing/deps";
import { bearer, verifyHandler } from "@/lib/billing/handlers";

export async function POST(request: Request) {
  const d = billingDeps();
  if (!d) return billingOff();
  try {
    const { status, body } = await verifyHandler(d, bearer(request.headers.get("authorization")), await readJSON(request));
    return Response.json(body, { status });
  } catch (err) {
    console.error("[billing] verify failed:", (err as Error).message);
    return Response.json({ error: "Payment received but activation failed. It will switch on automatically within a minute." }, { status: 502 });
  }
}
