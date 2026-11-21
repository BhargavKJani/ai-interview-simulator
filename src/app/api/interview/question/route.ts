import { questionHandler } from "@/lib/api-handlers";

export async function POST(request: Request) {
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { status, body } = await questionHandler(input);
  return Response.json(body, { status });
}
