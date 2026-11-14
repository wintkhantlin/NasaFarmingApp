import { getCropById } from "../data/crops";
import type { Rotation } from "../types";
import { daysBetween } from "./season";

/**
 * Directly checkable rotation descriptors. These describe the plan; they do not predict soil
 * carbon, nitrogen credits, pest pressure or yield.
 */

export interface RotationGap {
  /** ISO dates, both inclusive. The interval has no planned crop. */
  from: string;
  to: string;
  days: number;
  /** Months (1 to 12) touched by the gap, for overlaying rainy periods. */
  months: number[];
}

export interface RotationStructure {
  cycleDays: number;
  coveredDays: number;
  coveredShare: number;
  gaps: RotationGap[];
  distinctFamilies: number;
  legumeSlots: number;
  cropSlots: number;
  legumeShare: number | null;
  /** Longest run of the same crop family in cycle order, wrapping around the cycle. */
  longestSameFamilyRun: number;
  coverSlots: number;
}

const addDays = (iso: string, d: number) => {
  const [y, m, dd] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, dd + d)).toISOString().slice(0, 10);
};

function monthsBetween(from: string, to: string): number[] {
  const out = new Set<number>();
  for (let t = Date.parse(from); t <= Date.parse(to); t += 86_400_000) out.add(new Date(t).getUTCMonth() + 1);
  return [...out];
}

export function rotationStructure(rotation: Pick<Rotation, "slots" | "cycleYears">): RotationStructure {
  const slots = [...rotation.slots].sort((a, b) => a.plantDate.localeCompare(b.plantDate));
  const cycleDays = rotation.cycleYears * 365;
  if (slots.length === 0) {
    return { cycleDays, coveredDays: 0, coveredShare: 0, gaps: [], distinctFamilies: 0, legumeSlots: 0, cropSlots: 0, legumeShare: null, longestSameFamilyRun: 0, coverSlots: 0 };
  }
  const cycleStart = slots[0].plantDate;
  const cycleEnd = addDays(cycleStart, cycleDays - 1);

  // covered days: union of slot intervals inside the cycle (fallow slots do not cover)
  const intervals = slots
    .filter((s) => s.kind !== "fallow")
    .map((s) => [Math.max(daysBetween(cycleStart, s.plantDate), 0), Math.min(daysBetween(cycleStart, s.harvestDate), cycleDays - 1)] as [number, number])
    .filter(([a, b]) => b >= a)
    .sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const iv of intervals) {
    const last = merged[merged.length - 1];
    if (last && iv[0] <= last[1] + 1) last[1] = Math.max(last[1], iv[1]);
    else merged.push([iv[0], iv[1]]);
  }
  const covered = merged.reduce((s, [a, b]) => s + (b - a + 1), 0);

  const gaps: RotationGap[] = [];
  let cursor = 0;
  for (const [a, b] of merged) {
    if (a > cursor) gaps.push(makeGap(cycleStart, cursor, a - 1));
    cursor = b + 1;
  }
  if (cursor <= cycleDays - 1) gaps.push(makeGap(cycleStart, cursor, cycleDays - 1));
  void cycleEnd;

  const cropSlots = slots.filter((s) => s.kind !== "fallow");
  const crops = cropSlots.map((s) => (s.cropId ? getCropById(s.cropId) : undefined));
  const families = crops.map((c) => c?.family ?? null);
  const legume = crops.filter((c) => c?.group === "legume" || (c?.group === "cover" && c.family === "Fabaceae")).length;

  let longest = 0;
  if (families.length > 0) {
    // runs wrap: the last crop is followed by the first
    const n = families.length;
    let run = 0;
    for (let i = 0; i < n * 2; i++) {
      const cur = families[i % n];
      const prev = families[(i - 1 + n) % n];
      run = i > 0 && cur !== null && cur === prev ? run + 1 : 1;
      longest = Math.max(longest, Math.min(run, n));
    }
  }
  return {
    cycleDays,
    coveredDays: covered,
    coveredShare: covered / cycleDays,
    gaps,
    distinctFamilies: new Set(families.filter((f): f is string => f !== null)).size,
    legumeSlots: legume,
    cropSlots: cropSlots.length,
    legumeShare: cropSlots.length ? legume / cropSlots.length : null,
    longestSameFamilyRun: longest,
    coverSlots: slots.filter((s) => s.kind === "cover").length,
  };

  function makeGap(start: string, a: number, b: number): RotationGap {
    const from = addDays(start, a);
    const to = addDays(start, b);
    return { from, to, days: b - a + 1, months: monthsBetween(from, to) };
  }
}
