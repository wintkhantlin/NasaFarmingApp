import { NextResponse } from "next/server";
import { loadSoil } from "@/lib/server/soil";

/** SoilGrids can take 20+ seconds for the first read of a point; later reads come from cache. */
export const maxDuration = 60;

/** Fetch only the regional soil map for the profile form. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lngText = searchParams.get("lng");
  const latText = searchParams.get("lat");
  const lng = Number(lngText);
  const lat = Number(latText);
  if (!lngText || !latText || !Number.isFinite(lng) || !Number.isFinite(lat) || Math.abs(lng) > 180 || Math.abs(lat) > 90) {
    return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 });
  }
  const result = await loadSoil(lat, lng);
  return NextResponse.json({ soil: result.soil, unavailable: Boolean(result.error) });
}
