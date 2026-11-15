import { NextResponse } from "next/server";
import { loadTrends } from "@/lib/server/trends";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lng = parseFloat(searchParams.get("lng") ?? "");
  const lat = parseFloat(searchParams.get("lat") ?? "");
  if (Number.isNaN(lng) || Number.isNaN(lat)) return NextResponse.json({ error: "Missing or invalid coordinates" }, { status: 400 });
  return NextResponse.json(await loadTrends(lat, lng));
}
