import { toDailyRecords } from "../../lib/engine/climate";
import type { EngineData } from "../../lib/engine/data";
import { effectiveSoil } from "../../lib/engine/soil-input";
import { checkRegion } from "../../lib/data/regions";
import type { DailyWeather } from "../../lib/nasa/power";
import type { Field, LngLat, Rotation, RotationSlot } from "../../lib/types";

/** Deterministic pseudo-random in [0,1) so tests give the same numbers every run. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

export interface SyntheticOptions {
  startYear?: number;
  endYear?: number;
  lat?: number;
  lon?: number;
  /** Multiplies monsoon rainfall so a test can make a wet or dry climate. */
  rainScale?: number;
  /** Dates (ISO) to blank out with POWER's fill: they become null, never zero. */
  missing?: (iso: string) => boolean;
}

/** A Myanmar-like year: hot dry season, monsoon June to October. Not real data. */
export function syntheticWeather(o: SyntheticOptions = {}): DailyWeather {
  const start = o.startYear ?? 2015;
  const end = o.endYear ?? 2026;
  const lat = o.lat ?? 20.15;
  const lon = o.lon ?? 94.95;
  const scale = o.rainScale ?? 1;
  const rand = rng(42);
  const dates: string[] = [];
  const keys = ["T2M", "T2M_MAX", "T2M_MIN", "RH2M", "WS2M", "ALLSKY_SFC_SW_DWN", "PRECTOTCORR", "PS"] as const;
  const series: DailyWeather["series"] = {};
  for (const k of keys) series[k] = [];
  for (let t = Date.UTC(start, 0, 1); t <= Date.UTC(end, 11, 31); t += 86_400_000) {
    const d = new Date(t);
    const iso = d.toISOString().slice(0, 10);
    const month = d.getUTCMonth() + 1;
    const doy = Math.round((t - Date.UTC(d.getUTCFullYear(), 0, 0)) / 86_400_000);
    const season = Math.cos(((doy - 110) / 365) * 2 * Math.PI); // hottest around mid April
    const monsoon = month >= 6 && month <= 10;
    const wetProb = monsoon ? 0.6 : month === 5 || month === 11 ? 0.15 : 0.02;
    const rain = rand() < wetProb ? (monsoon ? 4 + rand() * 24 : 2 + rand() * 6) * scale : 0;
    const tmean = 27 + 4 * season - (monsoon ? 1.5 : 0);
    const miss = o.missing?.(iso) ?? false;
    dates.push(iso);
    const put = (k: (typeof keys)[number], v: number) => series[k]!.push(miss ? null : v);
    put("T2M", tmean);
    put("T2M_MAX", tmean + 6 - (monsoon ? 2 : 0));
    put("T2M_MIN", tmean - 6);
    put("RH2M", monsoon ? 82 : 45);
    put("WS2M", 1.2);
    put("ALLSKY_SFC_SW_DWN", monsoon ? 16 : 22);
    put("PRECTOTCORR", rain);
    put("PS", 99.2);
  }
  return {
    latitude: lat,
    longitude: lon,
    elevationM: 166,
    dates,
    series,
    source: { dataset: "NASA POWER", resolution: "synthetic", version: "test" },
    meta: { fillValue: -999, timeStandard: "UTC", sources: ["SYNTHETIC"], units: {}, apiVersion: "test", start: dates[0], end: dates[dates.length - 1] },
  };
}

export function syntheticField(over: Partial<Field> = {}): Field {
  const centroid: LngLat = over.centroid ?? [94.95, 20.15];
  const geometry = over.geometry ?? { type: "Point" as const, coordinates: centroid };
  return {
    id: "f1",
    name: "Test field",
    geometry,
    areaHa: 1,
    centroid,
    samplePoints: [centroid],
    irrigation: "none",
    region: checkRegion(geometry, centroid).region,
    locationConfirmed: true,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...over,
  };
}

export function slot(id: string, cropId: string, plant: string, harvest: string, over: Partial<RotationSlot> = {}): RotationSlot {
  return { id, kind: "crop", cropId, plantDate: plant, harvestDate: harvest, dateConfidence: "typical", irrigated: false, ...over };
}

export function rotation(fieldId: string, slots: RotationSlot[], cycleYears: 1 | 2 | 3 | 4 = 1): Rotation {
  return { id: "current", fieldId, label: "Current", cycleYears, slots, source: "farmer" };
}

export function engineData(field: Field, weather: DailyWeather | null, over: Partial<EngineData> = {}): EngineData {
  const records = weather ? toDailyRecords(weather) : [];
  return {
    field,
    region: field.region ?? "unsupported",
    latitude: field.centroid[1],
    elevationM: weather?.elevationM ?? 100,
    records,
    power: {
      status: weather ? "ok" : "unavailable",
      version: "test",
      fillValue: -999,
      timeStandard: "UTC",
      sources: [],
      retrievedAt: "2026-11-14T00:00:00Z",
      start: weather?.dates[0] ?? null,
      end: weather?.dates[weather.dates.length - 1] ?? null,
      elevationM: weather?.elevationM ?? null,
      units: {},
    },
    imerg: [],
    imergInfo: { status: "unconfigured", granules: 0, partialDays: 0, retrievedAt: null, start: null, end: null },
    smap: [],
    smapInfo: { status: "unconfigured", provider: null, retrievedAt: null, start: null, end: null },
    hls: [],
    hlsInfo: { status: "unconfigured", provider: null, retrievedAt: null, start: null, end: null },
    slope: null,
    srtmInfo: { status: "unconfigured", provider: null, retrievedAt: null, start: null, end: null },
    modis: [],
    modisInfo: { status: "unconfigured", provider: null, retrievedAt: null, start: null, end: null },
    ecostressLst: [],
    ecostressLstInfo: { status: "unconfigured", provider: null, retrievedAt: null, start: null, end: null },
    ecostressEt: [],
    ecostressEtInfo: { status: "unconfigured", provider: null, retrievedAt: null, start: null, end: null },
    soil: effectiveSoil(field, null),
    ...over,
  };
}
