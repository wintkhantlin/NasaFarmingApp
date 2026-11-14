import { recommend } from "@/lib/rotation/engine";

const MAX_REQUEST_BYTES = 1_000_000;

export async function POST(request: Request) {
  const declaredLength = Number(request.headers.get("content-length"));
  if (declaredLength > MAX_REQUEST_BYTES) return Response.json({ error: "Request is too large." }, { status: 413 });

  const body = await request.text();
  if (Buffer.byteLength(body) > MAX_REQUEST_BYTES) return Response.json({ error: "Request is too large." }, { status: 413 });

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return Response.json({ error: "Request must be valid JSON." }, { status: 400 });
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return Response.json({ error: "Send a JSON object." }, { status: 400 });

  try {
    return Response.json(recommend(parsed));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Invalid rotation request." }, { status: 400 });
  }
}
