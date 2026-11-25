import { questionHandler } from "@/lib/api-handlers";
import { aiGate } from "@/lib/billing/gate";

export async function POST(request: Request) {
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  // Claude is used only for a signed-in user with an open AI session (free uses or a paid plan).
  const { status, body } = await questionHandler(input, { ai: await aiGate(request, input) });
  return Response.json(body, { status });
}
