import { NextResponse } from "next/server";
import { monthlyNormals, toDailyRecords } from "@/lib/engine/climate";
import { BASELINE } from "@/lib/engine/data";
import { dailyEt0 } from "@/lib/engine/water";
import { imergBackfill } from "@/lib/server/imerg-backfill";
import { loadSoil } from "@/lib/server/soil";
import { loadWeather } from "@/lib/server/weather";

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Long-term conditions around a field: NASA POWER daily history (UTC days, eight parameters), IMERG
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

  // monthly summary of the baseline years, for the charts on the Conditions screen
  let monthly: Record<string, number[] | undefined> = {};
  let annualRainMm: number | undefined;
  if (weather) {
    const records = toDailyRecords(weather).filter((r) => r.year >= BASELINE.startYear && r.year <= BASELINE.endYear);
    const normals = monthlyNormals(records);
    const et0 = dailyEt0(records, weather.latitude, weather.elevationM ?? 0);
    const et0ByMonth = Array.from({ length: 12 }, () => 0);
    const years = new Set(records.map((r) => r.year)).size || 1;
    for (const d of et0) if (d.mm !== null) et0ByMonth[Number(d.date.slice(5, 7)) - 1] += d.mm / years;
    monthly = {
      monthlyRainMm: normals.map((n) => Math.round(n.rainMm)),
      monthlyTmaxC: normals.map((n) => round1(n.tmaxC)),
      monthlyTminC: normals.map((n) => round1(n.tminC)),
      monthlyEt0Mm: et0ByMonth.map(Math.round),
    };
    annualRainMm = (monthly.monthlyRainMm as number[]).reduce((a, b) => a + b, 0);
  }

  return NextResponse.json({
    fieldId,
    fetchedAt: new Date().toISOString(),
    climateAvailable: Boolean(weather),
    soilAvailable: Boolean(soil),
    annualRainMm,
    ...monthly,
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
