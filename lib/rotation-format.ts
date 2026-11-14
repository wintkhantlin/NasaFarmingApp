import { getCropById } from "@/lib/data/crops";
import type { Rotation, RotationSlot } from "@/lib/types";

/** The plain name of what grows in a slot: "Maize (Corn)", "Fallow", "Cover crop". */
export function slotName(slot: RotationSlot): string {
  if (slot.kind === "fallow") return "Fallow";
  const crop = slot.cropId ? getCropById(slot.cropId) : undefined;
  if (crop) return crop.names.common;
  return slot.kind === "cover" ? "Cover crop" : (slot.cropId ?? "Crop");
}

/** A short name for tight spaces: "Maize" from "Maize (Corn)". */
export function shortSlotName(slot: RotationSlot): string {
  return slotName(slot).replace(/\s*\(.*\)\s*$/, "");
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-05-15" to "15 May". No timezone maths, so it never shifts a day. */
export function formatDay(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  if (!m || !d) return iso;
  return `${d} ${MONTHS[m - 1]}`;
}

/** "15 May to 10 Oct". */
export function formatSpan(plantDate: string, harvestDate: string): string {
  return `${formatDay(plantDate)} to ${formatDay(harvestDate)}`;
}

/** "Maize, then Soybean, then Fallow". */
export function sequenceText(rotation: Pick<Rotation, "slots">, joiner = ", then "): string {
  return rotation.slots.map(shortSlotName).join(joiner);
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** Total days in a calendar year, handling leap years (including century leap-year rules). */
export function daysInCalendarYear(year: number): number {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 366 : 365;
}

/** Day of the year (1 to 366) for an ISO date, using UTC to prevent DST/timezone drift. */
export function dayOfYear(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return 1;
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 0)) / 86_400_000);
}

/** Difference in days between two ISO dates (date-only UTC arithmetic). */
export function daysBetween(startIso: string, endIso: string): number {
  const [y1, m1, d1] = startIso.split("-").map(Number);
  const [y2, m2, d2] = endIso.split("-").map(Number);
  if (!y1 || !m1 || !d1 || !y2 || !m2 || !d2) return 0;
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
}

/** Adds `days` to an ISO date, returning YYYY-MM-DD. */
export function addDaysToIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/**
 * Calculates horizontal placement (left and width as 0..1 fractions) for a date span
 * within a specific calendar year. Accurately divides by 366 in leap years (e.g. 2028)
 * and clamps to [0, 1] so Dec 31 never overflows.
 */
export function segmentYear(year: number, startIso: string, endIso: string): { left: number; width: number } | null {
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  const segStart = startIso > yearStart ? startIso : yearStart;
  const segEnd = endIso < yearEnd ? endIso : yearEnd;
  if (segStart > segEnd) return null;

  const totalDays = daysInCalendarYear(year);
  const startDoy = dayOfYear(segStart);
  const endDoy = dayOfYear(segEnd);

  const left = Math.max(0, Math.min(1, (startDoy - 1) / totalDays));
  const rawWidth = (endDoy - startDoy + 1) / totalDays;
  const width = Math.max(0, Math.min(1 - left, rawWidth));

  return { left, width };
}

/**
 * Calculates the percentage of the full rotation cycle with living crop cover.
 * Uses the UNION of active cropped days across the full planning cycle:
 * overlapping crops are counted once, and fallow days are excluded.
 */
export function calculateGroundCoverPercent(
  slots: RotationSlot[],
  cycleYears: number,
  baseYear = new Date().getFullYear(),
): { coverPercent: number; coveredDays: number; totalCycleDays: number } {
  const safeYears = Math.max(1, Math.min(4, cycleYears));
  let totalCycleDays = 0;
  for (let i = 0; i < safeYears; i++) {
    totalCycleDays += daysInCalendarYear(baseYear + i);
  }

  const cycleStart = `${baseYear}-01-01`;
  const cycleEnd = addDaysToIso(cycleStart, totalCycleDays - 1);

  // Collect intervals clipped to the cycle horizon
  const intervals: Array<[number, number]> = [];
  for (const s of slots) {
    if (s.kind === "fallow") continue;
    if (s.harvestDate < cycleStart || s.plantDate > cycleEnd) continue;
    const startOffset = Math.max(0, daysBetween(cycleStart, s.plantDate));
    const endOffset = Math.min(totalCycleDays - 1, daysBetween(cycleStart, s.harvestDate));
    if (endOffset >= startOffset) {
      intervals.push([startOffset, endOffset]);
    }
  }

  intervals.sort((a, b) => a[0] - b[0]);

  // Compute union of active days
  let coveredDays = 0;
  let currentStart = -1;
  let currentEnd = -1;

  for (const [start, end] of intervals) {
    if (currentStart === -1) {
      currentStart = start;
      currentEnd = end;
    } else if (start <= currentEnd + 1) {
      currentEnd = Math.max(currentEnd, end);
    } else {
      coveredDays += currentEnd - currentStart + 1;
      currentStart = start;
      currentEnd = end;
    }
  }

  if (currentStart !== -1) {
    coveredDays += currentEnd - currentStart + 1;
  }

  const coverPercent = totalCycleDays > 0 ? Math.min(100, Math.round((coveredDays / totalCycleDays) * 100)) : 0;
  return { coverPercent, coveredDays, totalCycleDays };
}

/** Position of a date inside its calendar year, 0 to 1. */
export function yearFraction(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return 0;
  const start = Date.UTC(y, 0, 1);
  const end = Date.UTC(y + 1, 0, 1);
  return (Date.UTC(y, m - 1, d) - start) / (end - start);
}

/** Number of calendar days from ISO date `from` to `to`. Positive when to > from. */
export function daysBetween(from: string, to: string): number {
  const d1 = Date.parse(from);
  const d2 = Date.parse(to);
  if (Number.isNaN(d1) || Number.isNaN(d2)) return 0;
  return Math.round((d2 - d1) / 86_400_000);
}

/** Adds `days` days to an ISO YYYY-MM-DD date and returns a new YYYY-MM-DD string. */
export function addDaysToIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

/** Left and width (0 to 1) of [from, to] inside calendar year `year`, or null when it does not touch it. */
export function segmentYear(year: number, from: string, to: string): { left: number; width: number } | null {
  const y0 = Date.UTC(year, 0, 1) / 86_400_000;
  const y1 = Date.UTC(year + 1, 0, 1) / 86_400_000;
  const dFrom = Date.parse(from) / 86_400_000;
  const dTo = Date.parse(to) / 86_400_000;
  if (Number.isNaN(dFrom) || Number.isNaN(dTo)) return null;
  const a = Math.max(dFrom, y0);
  const b = Math.min(dTo + 1, y1);
  if (b <= a) return null;
  return { left: (a - y0) / (y1 - y0), width: (b - a) / (y1 - y0) };
}
