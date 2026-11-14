import { NextResponse } from "next/server";
import { fetchPowerClimatology } from "@/lib/nasa/power";
import { fetchSoilGrids } from "@/lib/soil/soilgrids";
import { hargreavesEt0 } from "@/lib/engine/et0";

const DAYS_IN_MONTH = [31, 28.25, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
/** Day of year at the middle of each month, for the radiation term of ET0. */
const MID_MONTH_DOY = [15, 46, 74, 105, 135, 166, 196, 227, 258, 288, 319, 349];

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Long-term conditions around a field: NASA POWER climatology and ISRIC
 * SoilGrids. A source that fails is reported as missing, never filled with
 * made-up numbers, so the screen can say what it doesn't know.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ fieldId: string }> },
) {
  const { fieldId } = await params;
  const { searchParams } = new URL(request.url);
  const lng = parseFloat(searchParams.get("lng") ?? "");
  const lat = parseFloat(searchParams.get("lat") ?? "");

  if (Number.isNaN(lng) || Number.isNaN(lat)) {
    return NextResponse.json({ error: "Missing or invalid coordinates" }, { status: 400 });
  }

  const [climateResult, soilResult] = await Promise.allSettled([
    fetchPowerClimatology(
      lat,
      lng,
      ["T2M", "T2M_MAX", "T2M_MIN", "PRECTOTCORR", "ALLSKY_SFC_SW_DWN", "GWETROOT"],
      { signal: AbortSignal.timeout(10_000) },
    ),
    fetchSoilGrids(lat, lng, { signal: AbortSignal.timeout(12_000) }),
  ]);

  const climatology = climateResult.status === "fulfilled" ? climateResult.value : null;
  const soil = soilResult.status === "fulfilled" ? soilResult.value : null;
  if (climateResult.status === "rejected") console.warn("NASA POWER fetch failed:", climateResult.reason);
  if (soilResult.status === "rejected") console.warn("SoilGrids fetch failed:", soilResult.reason);

  // POWER climatology reports rainfall as a mean rate in mm per day.
  const rainPerDay = climatology?.months.PRECTOTCORR;
  const monthlyRainMm = rainPerDay?.map((mmDay, i) => Math.round(mmDay * DAYS_IN_MONTH[i]));
  const annualRainMm = monthlyRainMm?.reduce((a, b) => a + b, 0);

  const monthlyTmaxC = climatology?.months.T2M_MAX?.map(round1);
  const monthlyTminC = climatology?.months.T2M_MIN?.map(round1);
  const monthlyEt0Mm =
    monthlyTmaxC && monthlyTminC
      ? monthlyTmaxC.map((tmax, i) =>
          Math.round(hargreavesEt0(lat, MID_MONTH_DOY[i], tmax, monthlyTminC[i]) * DAYS_IN_MONTH[i]),
        )
      : undefined;

  const rootWetness = climatology?.annual.GWETROOT;

  return NextResponse.json({
    fieldId,
    fetchedAt: new Date().toISOString(),
    climateAvailable: Boolean(monthlyRainMm),
    soilAvailable: Boolean(soil),
    annualRainMm,
    monthlyRainMm,
    monthlyTmaxC,
    monthlyTminC,
    monthlyEt0Mm,
    rootWetnessPct: typeof rootWetness === "number" ? Math.round(rootWetness * 100) : undefined,
    soil,
    sources: [
      {
        dataset: "NASA POWER",
        resolution: "0.5° (MERRA-2, bias-corrected)",
        dates: "long-term monthly means",
      },
      {
        dataset: "ISRIC SoilGrids v2",
        resolution: "250 m",
        dates: "0 to 30 cm",
      },
    ],
  });
}
