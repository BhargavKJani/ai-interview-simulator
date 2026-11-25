import { billingDeps } from "./deps";
import { aiAllowed, bearer } from "./handlers";

/**
 * Whether this AI request may call Claude: a key is set, payments are configured, and the
 * signed-in caller has an open AI session with calls left. Otherwise the route uses its demo engine.
 */
export async function aiGate(request: Request, body: unknown): Promise<boolean> {
  if (!process.env.ANTHROPIC_API_KEY?.trim()) return false;
  const deps = billingDeps();
  if (!deps) return false;
  const session = (body as { session?: unknown } | null)?.session;
  return aiAllowed(deps, bearer(request.headers.get("authorization")), session).catch(() => false);
}
