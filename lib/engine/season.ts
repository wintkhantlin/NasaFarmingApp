import type { Crop, RotationSlot, StageId } from "../types";

/**
 * Crop seasons replayed over historical years. A slot's planting and harvest dates give the crop
 * window; the same month-and-day window is laid over each historical year so every rotation sees
 * the same weather years. Windows that cross December end in the next calendar year.
 */

export interface StageWindow {
  id: StageId;
  /** ISO dates, inclusive. */
  from: string;
  to: string;
}

export interface SeasonWindow {
  /** The historical year the window starts in. */
  year: number;
  from: string;
  to: string;
  stages: StageWindow[];
}

const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

export function isoFrom(y: number, m: number, d: number): string {
  // a leap-day date in a non-leap year falls back to 28 Feb instead of rolling into March
  const day = m === 2 && d === 29 && !isLeap(y) ? 28 : d;
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(toIso) - Date.parse(fromIso)) / 86_400_000);
}

/** Inclusive number of days in a window. */
export const windowDays = (from: string, to: string) => daysBetween(from, to) + 1;

/**
 * Splits a crop window into its four stages using the crop's stage fractions.
 * The last stage takes any rounding remainder so the stages tile the window exactly.
 */
export function stageWindows(crop: Crop, from: string, to: string): StageWindow[] {
  const total = windowDays(from, to);
  const f = crop.stageFractions;
  const order: StageId[] = ["ini", "dev", "mid", "late"];
  const sum = f.ini + f.dev + f.mid + f.late || 1;
  const out: StageWindow[] = [];
  let cursor = from;
  let used = 0;
  order.forEach((id, i) => {
    const len = i === order.length - 1 ? total - used : Math.max(1, Math.round((total * f[id]) / sum));
    const stageTo = addDaysIso(cursor, len - 1);
    out.push({ id, from: cursor, to: i === order.length - 1 ? to : stageTo });
    used += len;
    cursor = addDaysIso(stageTo, 1);
  });
  return out;
}

/** One window per historical year. The slot's own year is ignored; only month and day are used. */
export function replayWindows(slot: Pick<RotationSlot, "plantDate" | "harvestDate">, crop: Crop | undefined, years: number[]): SeasonWindow[] {
  const [, pm, pd] = slot.plantDate.split("-").map(Number);
  const [, hm, hd] = slot.harvestDate.split("-").map(Number);
  const spanDays = daysBetween(slot.plantDate, slot.harvestDate);
  const crossesYear = hm < pm || (hm === pm && hd < pd) || spanDays > 366;
  return years.map((year) => {
    const from = isoFrom(year, pm, pd);
    const to = crossesYear ? isoFrom(year + 1, hm, hd) : isoFrom(year, hm, hd);
    return { year, from, to, stages: crop ? stageWindows(crop, from, to) : [] };
  });
}

/** Years that have a window for which every day in `[from, to]` is inside `[firstDate, lastDate]`. */
export function yearsCovering(
  slot: Pick<RotationSlot, "plantDate" | "harvestDate">,
  firstDate: string,
  lastDate: string,
  candidateYears: number[],
): number[] {
  return replayWindows(slot, undefined, candidateYears)
    .filter((w) => w.from >= firstDate && w.to <= lastDate)
    .map((w) => w.year);
}

export interface Overlap {
  /** Index of the earlier slot. */
  from: number;
  to: number;
  /** Days the earlier crop is still in the field after the next one is planted. */
  days: number;
}

/**
 * Overlaps between consecutive slots in cycle order. Negative gaps are overlaps; positive gaps are
 * handled by `structure.ts`. Dates are compared as written, so a cycle that spans years uses its own years.
 */
export function slotOverlaps(slots: Pick<RotationSlot, "plantDate" | "harvestDate">[]): Overlap[] {
  const sorted = slots.map((s, i) => ({ s, i })).sort((a, b) => a.s.plantDate.localeCompare(b.s.plantDate));
  const out: Overlap[] = [];
  for (let k = 0; k < sorted.length - 1; k++) {
    const a = sorted[k];
    const b = sorted[k + 1];
    const gap = daysBetween(a.s.harvestDate, b.s.plantDate);
    if (gap < 0) out.push({ from: a.i, to: b.i, days: -gap });
  }
  return out;
}
