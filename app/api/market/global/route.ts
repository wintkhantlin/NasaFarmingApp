import { NextResponse } from "next/server";
import { loadGlobalPrices } from "@/lib/server/global-prices";

export async function GET() {
  return NextResponse.json(await loadGlobalPrices());
}
