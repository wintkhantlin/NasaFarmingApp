import { get, set } from "idb-keyval";
import type { SoilProfile } from "../soil/soilgrids";
import type { DailyWeather } from "../nasa/power";
import type { ImergDay } from "../nasa/imerg";
import type { PowerInfo } from "../engine/data";
import type { EcostressData, HlsData, ModisData, RemoteState, SmapData, SrtmData } from "../server/remote-sensing";

/** What `/api/field/:id/conditions` returns. Missing sources leave their fields undefined. */
export interface ConditionsData {
  fieldId: string;
  fetchedAt: string; // ISO date-time
  /** False when NASA POWER could not be reached; the climate fields are then undefined. */
  climateAvailable?: boolean;
  soilAvailable?: boolean;
  soil?: SoilProfile | null;
  annualRainMm?: number;
  /** Mean rainfall per calendar month, mm, January first. */
  monthlyRainMm?: number[];
  /** Mean daily maximum and minimum temperature per month, °C. */
  monthlyTmaxC?: number[];
  monthlyTminC?: number[];
  /** Reference crop water use (Hargreaves ET0) per month, mm. */
  monthlyEt0Mm?: number[];
  /** Root-zone wetness, % of saturation, long-term mean. */
  rootWetnessPct?: number;
  drySpellsCount?: number;
  hotDaysCount?: number;
  /** Full POWER daily history (UTC days). The engine reads this; the monthly arrays above are for the charts. */
  weather?: DailyWeather | null;
  power?: PowerInfo;
  imerg?: {
    status: "unconfigured" | "pending" | "ok" | "unavailable";
    expected: number;
    covered: number;
    partialDays: number;
    granules: number;
    days: ImergDay[];
    error: string | null;
  };
  sources: Array<{
    dataset: string;
    resolution?: string;
    dates?: string;
  }>;
}

const CONDITIONS_CACHE_PREFIX = "conditions_cache:";
/** Bump when the shape or units of ConditionsData change, so old caches are refetched. */
const CACHE_VERSION = 4;

export async function getCachedConditions(fieldId: string): Promise<ConditionsData | null> {
  if (typeof window === "undefined") return null;
  try {
    const data = await get<ConditionsData & { v?: number }>(`${CONDITIONS_CACHE_PREFIX}${fieldId}`);
    return data && data.v === CACHE_VERSION ? data : null;
  } catch {
    return null;
  }
}

export async function setCachedConditions(fieldId: string, data: ConditionsData): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    await set(`${CONDITIONS_CACHE_PREFIX}${fieldId}`, { ...data, v: CACHE_VERSION });
  } catch {
    // browser quota or private mode: non-fatal
  }
}

export function isStale(fetchedAt: string, maxAgeHours = 48): boolean {
  try {
    const ageMs = Date.now() - new Date(fetchedAt).getTime();
    return ageMs > maxAgeHours * 3600 * 1000;
  } catch {
    return false;
  }
}

/** AppEEARS results for one field (regional moisture, imagery, terrain). */
export interface RemoteData {
  fieldId: string;
  checkedAt: string;
  smap: RemoteState<SmapData>;
  hls: RemoteState<HlsData>;
  srtm: RemoteState<SrtmData>;
  modis: RemoteState<ModisData>;
  ecostressLst: RemoteState<EcostressData>;
  ecostressEt: RemoteState<EcostressData>;
}

const REMOTE_CACHE_PREFIX = "remote_cache:";

export async function getCachedRemote(fieldId: string): Promise<RemoteData | null> {
  if (typeof window === "undefined") return null;
  try {
    const data = await get<RemoteData & { v?: number }>(`${REMOTE_CACHE_PREFIX}${fieldId}`);
    return data && data.v === CACHE_VERSION ? data : null;
  } catch {
    return null;
  }
}

export async function setCachedRemote(fieldId: string, data: RemoteData): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    await set(`${REMOTE_CACHE_PREFIX}${fieldId}`, { ...data, v: CACHE_VERSION });
  } catch {
    // non-fatal
  }
}
