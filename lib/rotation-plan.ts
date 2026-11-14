/**
 * Pure rules behind the Crops screen: where a tapped crop goes, how long the
 * cycle is, which crops share the same days, and when the field is bare.
 * Nothing here touches React or the store, so each rule has a unit test.
 */
import { getCropById, getDefaultTypicalDates } from "@/lib/data/crops";
import { rotationStructure } from "@/lib/engine/structure";
import { addDaysToIso, formatSpan, plural, segmentYear, shortSlotName } from "@/lib/rotation-format";
import type { RegionId, RotationSlot } from "@/lib/types";

/** Days of turnaround (clear the field, prepare the next bed) kept between two crops. */
export const TURNAROUND_DAYS = 5;
export const MAX_CYCLE_YEARS = 4;
/** A bare stretch shorter than this is turnaround, not a rest worth mentioning. */
export const MIN_GAP_DAYS = 21;
const SEARCH_STEP_DAYS = 7;

const DAY_MS = 86_400_000;
const dayNumber = (iso: string) => Date.parse(iso) / DAY_MS;
const isDate = (iso: string) => !Number.isNaN(Date.parse(iso));
const growing = (s: RotationSlot) => s.kind !== "fallow" && isDate(s.plantDate) && isDate(s.harvestDate);

export function sortByPlanting<T extends Pick<RotationSlot, "plantDate" | "harvestDate">>(slots: T[]): T[] {
  return [...slots].sort((a, b) => a.plantDate.localeCompare(b.plantDate) || a.harvestDate.localeCompare(b.harvestDate));
}

/**
 * How many years the rotation takes before it starts again. This is read from the dates, not asked:
 * the span from the first planting to the last harvest, rounded up to whole years (1 to 4).
 */
export function deriveCycleYears(slots: Pick<RotationSlot, "plantDate" | "harvestDate">[]): 1 | 2 | 3 | 4 {
  const valid = slots.filter((s) => isDate(s.plantDate) && isDate(s.harvestDate));
  if (valid.length === 0) return 1;
  const first = Math.min(...valid.map((s) => dayNumber(s.plantDate)));
  const last = Math.max(...valid.map((s) => Math.max(dayNumber(s.harvestDate), dayNumber(s.plantDate))));
  const span = last - first + 1;
  return Math.min(MAX_CYCLE_YEARS, Math.max(1, Math.ceil(span / 365))) as 1 | 2 | 3 | 4;
}

/** True when the dates need more than four years, which the app does not model. */
export function exceedsMaxCycle(slots: Pick<RotationSlot, "plantDate" | "harvestDate">[]): boolean {
  const valid = slots.filter((s) => isDate(s.plantDate) && isDate(s.harvestDate));
  if (valid.length === 0) return false;
  const first = Math.min(...valid.map((s) => dayNumber(s.plantDate)));
  const last = Math.max(...valid.map((s) => dayNumber(s.harvestDate)));
  return last - first + 1 > MAX_CYCLE_YEARS * 365;
}

export interface Overlap {
  first: RotationSlot;
  second: RotationSlot;
  /** Days both crops are in the ground at once. */
  days: number;
}

/** Pairs of crops that share days. Fallow never overlaps; it is a rest, not a crop. */
export function findOverlaps(slots: RotationSlot[]): Overlap[] {
  const list = sortByPlanting(slots.filter(growing));
  const out: Overlap[] = [];
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i];
      const b = list[j];
      if (b.plantDate > a.harvestDate) break; // sorted: nothing later can touch `a`
      const days = Math.min(dayNumber(a.harvestDate), dayNumber(b.harvestDate)) - Math.max(dayNumber(a.plantDate), dayNumber(b.plantDate)) + 1;
      if (days > 0) out.push({ first: a, second: b, days });
    }
  }
  return out;
}

export interface Placement {
  plantDate: string;
  harvestDate: string;
  /** True when the crop only fits by making the cycle longer, for example into a second year. */
  extendsCycle: boolean;
  /** False when no free window exists; the dates then sit on top of another crop. */
  fits: boolean;
}

function calendarFor(cropId: string, region?: RegionId) {
  const crop = getCropById(cropId);
  const own = region ? crop?.profile?.regionalCalendars[region] : undefined;
  return own ?? (crop?.profile ? Object.values(crop.profile.regionalCalendars)[0] : undefined);
}

/** Weekly planting dates across a crop's usual sowing window in `year`. The window may cross New Year. */
function windowStarts(cropId: string, year: number, region?: RegionId): string[] {
  const cal = calendarFor(cropId, region);
  if (!cal) return [getDefaultTypicalDates(cropId, year, region).plantDate];
  const [from, to] = cal.sowWindow;
  const start = `${year}-${from}`;
  const end = `${to < from ? year + 1 : year}-${to}`;
  const dates: string[] = [];
  for (let d = start; d < end; d = addDaysToIso(d, SEARCH_STEP_DAYS)) dates.push(d);
  dates.push(end);
  return dates;
}

/**
 * Where a newly tapped crop goes. It starts at the opening of its usual sowing window and moves
 * later until it clears the other crops (with a few days of turnaround). If the whole window is
 * taken it moves to the next year, up to the four-year limit. Only if nothing fits does it sit on
 * top of another crop, and `fits` says so.
 */
export function placeCrop(cropId: string, existing: RotationSlot[], region?: RegionId, fallbackYear = new Date().getFullYear()): Placement {
  const crop = getCropById(cropId);
  const cycleDays = crop ? crop.cycleDays.typ : 120;
  const others = existing.filter(growing);
  const baseYear = others.length > 0 ? Number(sortByPlanting(others)[0].plantDate.slice(0, 4)) : fallbackYear;

  const clear = (plant: string, harvest: string) =>
    others.every((s) => harvest < addDaysToIso(s.plantDate, -TURNAROUND_DAYS) || plant > addDaysToIso(s.harvestDate, TURNAROUND_DAYS));

  for (let offset = 0; offset < MAX_CYCLE_YEARS; offset++) {
    for (const plant of windowStarts(cropId, baseYear + offset, region)) {
      const harvest = addDaysToIso(plant, cycleDays);
      if (!clear(plant, harvest)) continue;
      const probe = [...others.map((s) => ({ plantDate: s.plantDate, harvestDate: s.harvestDate })), { plantDate: plant, harvestDate: harvest }];
      if (exceedsMaxCycle(probe)) continue;
      return { plantDate: plant, harvestDate: harvest, extendsCycle: deriveCycleYears(probe) > deriveCycleYears(others), fits: true };
    }
  }
  const fallback = getDefaultTypicalDates(cropId, baseYear, region);
  return { ...fallback, extendsCycle: false, fits: false };
}

export interface RestGap {
  from: string;
  to: string;
  days: number;
  /** "4 Jan to 31 May" */
  span: string;
  /** "about 5 months" */
  length: string;
}

export function describeLength(days: number): string {
  if (days >= 45) return `about ${plural(Math.round(days / 30), "month")}`;
  if (days >= 14) return `about ${plural(Math.round(days / 7), "week")}`;
  return plural(days, "day");
}

/** Stretches inside the cycle when no crop is in the ground, ignoring short turnaround gaps. */
export function restGaps(slots: RotationSlot[], cycleYears: 1 | 2 | 3 | 4): { gaps: RestGap[]; coveredShare: number } {
  const valid = slots.filter((s) => isDate(s.plantDate) && isDate(s.harvestDate) && s.harvestDate >= s.plantDate);
  if (valid.length === 0) return { gaps: [], coveredShare: 0 };
  const structure = rotationStructure({ slots: valid, cycleYears });
  return {
    coveredShare: structure.coveredShare,
    gaps: structure.gaps
      .filter((g) => g.days >= MIN_GAP_DAYS)
      .map((g) => ({ from: g.from, to: g.to, days: g.days, span: formatSpan(g.from, g.to), length: describeLength(g.days) })),
  };
}

export interface RibbonBar {
  slot: RotationSlot;
  left: number;
  width: number;
  /** The crop was planted in an earlier calendar year, so its left edge is a cut, not a planting. */
  cutLeft: boolean;
  /** The crop is harvested in a later calendar year, so its right edge is a cut, not a harvest. */
  cutRight: boolean;
}

export interface RibbonLane {
  /** "Each year", "Year 1", "Year 2" */
  label: string;
  /** Bars packed into rows so crops that share days stack instead of hiding each other. */
  rows: RibbonBar[][];
}

/**
 * One lane per year of the cycle. A crop that runs past December carries on at the start of the
 * next lane, and after the last lane it wraps to the first, because the cycle repeats.
 */
export function ribbonLanes(slots: RotationSlot[], cycleYears: 1 | 2 | 3 | 4): RibbonLane[] {
  const valid = slots.filter((s) => isDate(s.plantDate) && isDate(s.harvestDate) && s.harvestDate >= s.plantDate);
  const firstYear = valid.length ? Math.min(...valid.map((s) => Number(s.plantDate.slice(0, 4)))) : new Date().getFullYear();
  const lanes: RibbonBar[][] = Array.from({ length: cycleYears }, () => []);

  for (const slot of valid) {
    const y0 = Number(slot.plantDate.slice(0, 4));
    const y1 = Number(slot.harvestDate.slice(0, 4));
    for (let y = y0; y <= y1; y++) {
      const seg = segmentYear(y, slot.plantDate, slot.harvestDate);
      if (!seg) continue;
      const lane = (((y - firstYear) % cycleYears) + cycleYears) % cycleYears;
      lanes[lane].push({ slot, left: seg.left, width: seg.width, cutLeft: y > y0, cutRight: y < y1 });
    }
  }

  return lanes.map((bars, i) => {
    const rows: RibbonBar[][] = [];
    for (const bar of [...bars].sort((a, b) => a.left - b.left)) {
      const row = rows.find((r) => r[r.length - 1].left + r[r.length - 1].width <= bar.left + 1e-6);
      if (row) row.push(bar);
      else rows.push([bar]);
    }
    return { label: cycleYears === 1 ? "Each year" : `Year ${i + 1}`, rows };
  });
}

export interface RotationReading {
  /** "Rice, then Green gram" */
  sequence: string;
  /** "Repeats every year" */
  cycle: string;
  overlaps: Overlap[];
  gaps: RestGap[];
  coveredShare: number;
}

/** Everything the summary card says, in one pass. */
export function readRotation(slots: RotationSlot[]): RotationReading {
  const ordered = sortByPlanting(slots);
  const cycleYears = deriveCycleYears(slots);
  const { gaps, coveredShare } = restGaps(slots, cycleYears);
  return {
    sequence: ordered.map(shortSlotName).join(", then "),
    cycle: cycleYears === 1 ? "Repeats every year" : `Repeats every ${cycleYears} years`,
    overlaps: findOverlaps(slots),
    gaps,
    coveredShare,
  };
}
