import { billingDeps, billingOff } from "@/lib/billing/deps";
import { bearer, startHandler } from "@/lib/billing/handlers";

export async function POST(request: Request) {
  const d = billingDeps();
  if (!d) return billingOff();
  const { status, body } = await startHandler(d, bearer(request.headers.get("authorization")));
  return Response.json(body, { status });
}
