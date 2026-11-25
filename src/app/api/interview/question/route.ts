import { aiEnabled } from "@/lib/ai";
import { questionHandler } from "@/lib/api-handlers";
import { billingDeps } from "@/lib/billing/deps";
import { aiAllowed, bearer } from "@/lib/billing/handlers";

export async function POST(request: Request) {
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  // Claude is used only for a signed-in user with an open AI session (free uses or a paid plan).
  const deps = billingDeps();
  const ai =
    aiEnabled() && !!deps &&
    (await aiAllowed(deps, bearer(request.headers.get("authorization")), (input as { session?: unknown } | null)?.session).catch(() => false));
  const { status, body } = await questionHandler(input, { ai });
  return Response.json(body, { status });
}
