import type { Crop, RegionId } from "../../types";
import { MYANMAR_CROPS, CROP_LIBRARY_VERSION } from "./myanmar";
import { REFERENCE_CROPS } from "./reference";

export { CROP_LIBRARY_VERSION };

/** Myanmar crops first, then the reference-only crops. */
export const CROPS: Crop[] = [...MYANMAR_CROPS, ...REFERENCE_CROPS];

export function getCropById(id: string): Crop | undefined {
  return CROPS.find((c) => c.id === id);
}

/** Crops with sourced stage-level rules, optionally limited to those with a calendar in the region. */
export function strategyCrops(region?: RegionId): Crop[] {
  return MYANMAR_CROPS.filter((c) => !region || c.profile?.regionalCalendars[region]);
}

/** "06-01" and a year to "2026-06-01". */
const iso = (year: number, mmdd: string) => `${year}-${mmdd}`;
const addDays = (isoDate: string, days: number) => {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
};

/**
 * A starting plant and harvest date for the editor. For a supported crop in a region this is the
 * start of the regional sowing window plus the typical cycle; otherwise a generic mid-May start.
 * These are labelled "typical" in the UI, never "exact".
 */
export function getDefaultTypicalDates(
  cropId: string,
  baseYear = new Date().getFullYear(),
  region?: RegionId,
): { plantDate: string; harvestDate: string } {
  const crop = getCropById(cropId);
  const cycleDays = crop ? crop.cycleDays.typ : 120;
  const calendar = region ? crop?.profile?.regionalCalendars[region] : undefined;
  const firstCalendar = crop?.profile ? Object.values(crop.profile.regionalCalendars)[0] : undefined;
  const sow = (calendar ?? firstCalendar)?.sowWindow[0];

  const isWinter = cropId === "wheat" || cropId === "crimson-clover";
  const plantDate = sow ? iso(baseYear, sow) : iso(baseYear, isWinter ? "10-15" : "05-15");
  return { plantDate, harvestDate: addDays(plantDate, cycleDays) };
}
