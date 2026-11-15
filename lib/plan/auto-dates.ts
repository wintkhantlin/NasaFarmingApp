import { getCropById, getDefaultTypicalDates } from "@/lib/data/crops";
import { addDaysToIso, daysBetween } from "@/lib/rotation-format";
import type { RegionId, RotationSlot } from "@/lib/types";

/**
 * Automatic dates for a rotation. The farmer picks crops; this places each one in its usual
 * sowing season, one after another, so nothing overlaps and nothing has to be typed.
 *
 * Dates a farmer has set themselves (`exact` or `approx`) are never moved. Only `typical`
 * (the app's own guess) dates are filled, and they stay `typical` so the UI keeps saying so.
 */

/** Days kept between one harvest and the next sowing: land preparation. */
export const TURNAROUND_DAYS = 14;

/**
 * Longest wait for a crop's usual sowing window. Beyond this the next crop is placed right after the
 * harvest instead, so a one-year plan never has a ten-month gap; the farmer still reviews the dates.
 * Same limit the candidate rotations use.
 */
export const MAX_WAIT_DAYS = 240;

/** Usual sowing window for a crop as MM-DD, or null when no calendar exists for the region. */
export function usualSowWindow(cropId: string | undefined, region?: RegionId): { start: string; end: string } | null {
  const crop = cropId ? getCropById(cropId) : undefined;
  const calendars = crop?.profile?.regionalCalendars;
  if (!calendars) return null;
  const calendar = (region ? calendars[region] : undefined) ?? Object.values(calendars)[0];
  return calendar ? { start: calendar.sowWindow[0], end: calendar.sowWindow[1] } : null;
}

const mmdd = (iso: string) => iso.slice(5, 10);

/** True when MM-DD sits inside a window that may cross the new year. */
function inWindow(day: string, start: string, end: string): boolean {
  return start <= end ? day >= start && day <= end : day >= start || day <= end;
}

/** The first date on or after `afterIso` that falls on `day` (MM-DD). */
export function nextOnOrAfter(day: string, afterIso: string): string {
  const year = Number(afterIso.slice(0, 4));
  const thisYear = `${year}-${day}`;
  return thisYear >= afterIso ? thisYear : `${year + 1}-${day}`;
}

/** Months (1 to 12) that fall inside the crop's usual sowing window. */
export function usualSowMonths(cropId: string | undefined, region?: RegionId): number[] {
  const window = usualSowWindow(cropId, region);
  if (!window) return [];
  const from = Number(window.start.slice(0, 2));
  const to = Number(window.end.slice(0, 2));
  const months: number[] = [];
  // A month counts when any part of it overlaps the window; the window may cross the new year.
  for (let m = 1; m <= 12; m += 1) {
    if (from <= to ? m >= from && m <= to : m >= from || m <= to) months.push(m);
  }
  return months;
}

export type MonthPart = "early" | "mid" | "late";
const PART_DAY: Record<MonthPart, number> = { early: 5, mid: 15, late: 25 };

/** Which part of its month a date falls in. */
export function monthPartOf(iso: string): MonthPart {
  const day = Number(iso.slice(8, 10));
  return day <= 10 ? "early" : day <= 20 ? "mid" : "late";
}

/**
 * The sowing date for "month, part of month". When a crop comes before it, the date is the first
 * time that month arrives after that crop's harvest (so choosing "Jun" for the second crop of a
 * two-year cycle gives the next June, not one already gone). Otherwise it stays in `fallbackYear`.
 */
export function plantDateFor(month: number, part: MonthPart, opts: { afterIso?: string; fallbackYear: number }): string {
  const mm = String(month).padStart(2, "0");
  const dd = String(PART_DAY[part]).padStart(2, "0");
  if (opts.afterIso) return nextOnOrAfter(`${mm}-${dd}`, opts.afterIso);
  return `${opts.fallbackYear}-${mm}-${dd}`;
}

const isFarmerSet = (slot: RotationSlot) => slot.dateConfidence === "exact" || slot.dateConfidence === "approx";

export interface AutoDatesResult {
  slots: RotationSlot[];
  /** How many crops got new dates. */
  changed: number;
}

/**
 * Fills sowing and harvest dates for the crops the farmer has not dated themselves.
 * Each crop starts in its usual sowing window and after the one before it has been harvested.
 */
export function autoFillRotationDates(
  slots: RotationSlot[],
  opts: { region?: RegionId; baseYear?: number; /** ISO date. The first undated crop is sown on or after it (use today for a plan to start from now). */ notBefore?: string } = {},
): AutoDatesResult {
  const firstDated = slots.find((s) => /^\d{4}-\d{2}-\d{2}$/.test(s.plantDate));
  const baseYear = opts.baseYear ?? (firstDated ? Number(firstDated.plantDate.slice(0, 4)) : new Date().getFullYear());
  let cursor: string | null = null;
  let changed = 0;

  const out = slots.map((slot): RotationSlot => {
    const hasDates = /^\d{4}-\d{2}-\d{2}$/.test(slot.plantDate) && /^\d{4}-\d{2}-\d{2}$/.test(slot.harvestDate);

    // Bare soil and farmer-set dates are anchors: keep them and continue after them.
    if (slot.kind === "fallow" || (isFarmerSet(slot) && hasDates)) {
      if (hasDates && (cursor === null || slot.harvestDate > cursor)) cursor = slot.harvestDate;
      return slot;
    }

    const crop = slot.cropId ? getCropById(slot.cropId) : undefined;
    const duration = crop?.cycleDays.typ ?? 100;
    const window = usualSowWindow(slot.cropId, opts.region);

    let plantDate: string;
    if (cursor === null && opts.notBefore) {
      plantDate = !window || inWindow(mmdd(opts.notBefore), window.start, window.end) ? opts.notBefore : nextOnOrAfter(window.start, opts.notBefore);
    } else if (cursor === null) {
      plantDate = slot.cropId
        ? getDefaultTypicalDates(slot.cropId, baseYear, opts.region).plantDate
        : `${baseYear}-05-15`;
    } else {
      const earliest: string = addDaysToIso(cursor, TURNAROUND_DAYS);
      if (!window || inWindow(mmdd(earliest), window.start, window.end)) plantDate = earliest;
      else {
        const inSeason = nextOnOrAfter(window.start, earliest);
        plantDate = daysBetween(earliest, inSeason) > MAX_WAIT_DAYS ? earliest : inSeason;
      }
    }
    const harvestDate = addDaysToIso(plantDate, duration);
    cursor = harvestDate;

    if (slot.plantDate === plantDate && slot.harvestDate === harvestDate && slot.dateConfidence === "typical") return slot;
    changed += 1;
    return { ...slot, plantDate, harvestDate, dateConfidence: "typical" };
  });

  return { slots: out, changed };
}

/** Days of bare soil (positive) or overlap (negative) between two consecutive crops. */
export function gapBetween(prev: RotationSlot, next: RotationSlot): number {
  return daysBetween(prev.harvestDate, next.plantDate);
}
