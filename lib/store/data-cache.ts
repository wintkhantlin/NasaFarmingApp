import { get, set } from "idb-keyval";
import type { SoilProfile } from "../soil/soilgrids";

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
  sources: Array<{
    dataset: string;
    resolution?: string;
    dates?: string;
  }>;
}

const CONDITIONS_CACHE_PREFIX = "conditions_cache:";
/** Bump when the shape or units of ConditionsData change, so old caches are refetched. */
const CACHE_VERSION = 2;

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
