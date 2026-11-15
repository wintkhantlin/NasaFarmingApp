import { NextResponse } from "next/server";
import { geometrySchema } from "@/lib/schemas/field";
import { advance, type EcostressData, type HlsData, type ModisData, type SmapData, type SrtmData } from "@/lib/server/remote-sensing";

/**
 * Moves the AppEEARS jobs for this field forward and reports where each one is. The browser calls
 * this again every few seconds while any job is pending. Without Earthdata credentials on the server
 * each source answers `unconfigured`; nothing is estimated in its place.
 *
 * POST body: { geometry: GeoJSON Point | Polygon, centroid: [lng, lat] }
 */
export async function POST(request: Request, { params }: { params: Promise<{ fieldId: string }> }) {
  const { fieldId } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Send JSON." }, { status: 400 });
  }
  const b = body as { geometry?: unknown; centroid?: unknown };
  const geometry = geometrySchema.safeParse(b.geometry);
  const centroid = Array.isArray(b.centroid) && b.centroid.length === 2 && b.centroid.every((n) => typeof n === "number") ? (b.centroid as [number, number]) : null;
  if (!geometry.success || !centroid) return NextResponse.json({ error: "Missing or invalid geometry." }, { status: 400 });

  const field = { id: fieldId, geometry: geometry.data, centroid };
  const [smap, hls, srtm, modis, ecostressLst, ecostressEt] = await Promise.all([
    advance<SmapData>("smap", field),
    advance<HlsData>("hls", field),
    advance<SrtmData>("srtm", field),
    advance<ModisData>("modis", field),
    advance<EcostressData>("ecostress-lst", field),
    advance<EcostressData>("ecostress-et", field),
  ]);
  return NextResponse.json({ fieldId, checkedAt: new Date().toISOString(), smap, hls, srtm, modis, ecostressLst, ecostressEt });
}
