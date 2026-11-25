import { connection } from "next/server";
import { billingDeps, billingOff } from "@/lib/billing/deps";
import { bearer, meHandler } from "@/lib/billing/handlers";

export async function GET(request: Request) {
  await connection();
  const d = billingDeps();
  if (!d) return billingOff();
  const { status, body } = await meHandler(d, bearer(request.headers.get("authorization")));
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
