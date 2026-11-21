import { connection } from "next/server";
import { statusHandler } from "@/lib/api-handlers";

export async function GET() {
  await connection(); // read env at request time, not build time
  const { status, body } = statusHandler();
  return Response.json(body, { status });
}
