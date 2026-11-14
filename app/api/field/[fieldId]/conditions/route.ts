import { NextResponse } from "next/server";
import { BASELINE } from "@/lib/engine/data";
import { summariseConditions } from "@/lib/server/conditions-summary";
import { imergBackfill } from "@/lib/server/imerg-backfill";
import { loadSoil } from "@/lib/server/soil";
import { loadWeather } from "@/lib/server/weather";

/**
 * Long-term conditions around a field: NASA POWER daily history (UTC days, eight parameters plus GWETROOT), IMERG
 * daily rainfall for the field's 0.1 degree cell when an Earthdata token is set, and ISRIC SoilGrids.
 * A source that fails is reported as missing, never filled with made-up numbers, so the screen can
 * say what it doesn't know.
 */
export async function GET(request: Request, { params }: { params: Promise<{ fieldId: string }> }) {
  const { fieldId } = await params;
  const { searchParams } = new URL(request.url);
  const lng = parseFloat(searchParams.get("lng") ?? "");
  const lat = parseFloat(searchParams.get("lat") ?? "");

  if (Number.isNaN(lng) || Number.isNaN(lat)) {
    return NextResponse.json({ error: "Missing or invalid coordinates" }, { status: 400 });
  }

  const [weatherResult, soilResult] = await Promise.all([
    loadWeather(lat, lng),
    loadSoil(lat, lng),
  ]);
  const weather = weatherResult.weather;
  const soil = soilResult.soil;
  if (soilResult.error) console.warn("SoilGrids fetch failed:", soilResult.error);
  if (weatherResult.error) console.warn("NASA POWER fetch failed:", weatherResult.error);

  const imerg = await imergBackfill(lat, lng, { start: `${BASELINE.startYear}-01-01`, end: `${BASELINE.endYear}-12-31` });

  // Monthly summary of the baseline years for the Conditions charts, built the same way as the comparison.
  const summary = weather ? summariseConditions(weather, imerg.days) : null;

  return NextResponse.json({
    fieldId,
    fetchedAt: new Date().toISOString(),
    climateAvailable: Boolean(weather),
    soilAvailable: Boolean(soil),
    ...(summary ?? {}),
    soil,
    weather,
    power: {
      status: weather ? "ok" : "unavailable",
      version: weather?.meta.apiVersion ?? null,
      fillValue: weather?.meta.fillValue ?? -999,
      timeStandard: weather?.meta.timeStandard ?? null,
      sources: weather?.meta.sources ?? [],
      retrievedAt: weatherResult.retrievedAt,
      start: weather?.dates[0] ?? null,
      end: weather?.dates[weather.dates.length - 1] ?? null,
      elevationM: weather?.elevationM ?? null,
      units: weather?.meta.units ?? {},
    },
    imerg: {
      status: imerg.status,
      expected: imerg.expected,
      covered: imerg.covered,
      partialDays: imerg.partialDays,
      granules: imerg.granules,
      days: imerg.days,
      error: imerg.error,
    },
    sources: [
      {
        dataset: "NASA POWER",
        resolution: "about 0.5° x 0.625° (MERRA-2, CERES), daily, UTC days",
        dates: `${BASELINE.startYear} to ${BASELINE.endYear}`,
      },
      ...(imerg.status === "ok" || imerg.status === "pending"
        ? [{ dataset: "GPM IMERG Final daily V07", resolution: "0.1°", dates: `${imerg.covered} of ${imerg.expected} days retrieved` }]
        : []),
      { dataset: "ISRIC SoilGrids v2", resolution: "250 m", dates: "0 to 30 cm" },
    ],
  });
}
