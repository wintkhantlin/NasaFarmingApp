import type { DailyRecord } from "./climate";

/**
 * Rainfall statistics for a window. Missing days are missing: they never count as dry, and a window
 * with too few valid days is not evaluable. Thresholds are named parameters so a source or an
 * identified analyst assumption is attached to every one of them.
 */

export interface NamedThreshold {
  value: number;
  unit: string;
  scope: "analyst-assumption" | "fao56" | "ecocrop-reference" | "local-validated";
  ref: string;
}

/** A day below this is "dry". It matches the existing `dryspells()` function. */
export const DRY_DAY_MM: NamedThreshold = {
  value: 1,
  unit: "mm/day",
  scope: "analyst-assumption",
  ref: "Common agro-meteorological convention for a dry day; not tuned for Myanmar.",
};

/** A day at or above this is "heavy rain". */
export const HEAVY_RAIN_MM: NamedThreshold = {
  value: 50,
  unit: "mm/day",
  scope: "analyst-assumption",
  ref: "Analyst choice; the Myanmar meteorological service may use another value.",
};

/** A season needs at least this share of days with data to be evaluated. */
export const MIN_VALID_SHARE = 0.9;

export interface DayValue {
  date: string;
  mm: number | null;
}

export interface WindowRain {
  /** null when the window is not evaluable. */
  totalMm: number | null;
  /** Days with a value. */
  validDays: number;
  expectedDays: number;
  /** Longest run of consecutive dry days (valid values only). Null when not evaluable. */
  longestDryDays: number | null;
  heavyRainDays: number | null;
  evaluable: boolean;
}

const inWindow = (d: string, from: string, to: string) => d >= from && d <= to;

export function windowRain(
  days: DayValue[],
  from: string,
  to: string,
  opts: { dryMm?: number; heavyMm?: number; minValidShare?: number } = {},
): WindowRain {
  const dry = opts.dryMm ?? DRY_DAY_MM.value;
  const heavy = opts.heavyMm ?? HEAVY_RAIN_MM.value;
  const minShare = opts.minValidShare ?? MIN_VALID_SHARE;
  const expectedDays = Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1;
  const rows = days.filter((d) => inWindow(d.date, from, to)).sort((a, b) => a.date.localeCompare(b.date));
  const valid = rows.filter((r) => r.mm !== null);
  if (expectedDays <= 0 || valid.length / expectedDays < minShare) {
    return { totalMm: null, validDays: valid.length, expectedDays, longestDryDays: null, heavyRainDays: null, evaluable: false };
  }
  let run = 0;
  let best = 0;
  let heavyDays = 0;
  let total = 0;
  for (const r of rows) {
    if (r.mm === null) {
      run = 0; // a missing day ends the run; it is not a dry day
      continue;
    }
    total += r.mm;
    if (r.mm < dry) {
      run++;
      if (run > best) best = run;
    } else run = 0;
    if (r.mm >= heavy) heavyDays++;
  }
  return { totalMm: total, validDays: valid.length, expectedDays, longestDryDays: best, heavyRainDays: heavyDays, evaluable: true };
}

export const recordsToRain = (records: DailyRecord[]): DayValue[] => records.map((r) => ({ date: r.date, mm: r.rainMm }));

export function percentileOf(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const idx = (s.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return s[lo] + (s[hi] - s[lo]) * (idx - lo);
}

export interface RainfallSourceComparison {
  seasonTotalA_ClimatologyMm: number | null;
  seasonTotalB_PowerMm: number | null;
  seasonTotalC_ImergMm: number | null;
  departureMm_B_minus_A: number | null;
  productSensitivityMm_C_minus_B: number | null;
  timingRedistributedMm: number[] | null;
}

/**
 * Compares seasonal rainfall across:
 * (A) historical daily rainfall climatology,
 * (B) actual daily POWER rainfall, and
 * (C) actual daily IMERG (Section 28 / Priority 2).
 * B - A tests seasonal departure and timing together; C - B tests product sensitivity.
 */
export function compareRainfallSources(
  climatologyDays: DayValue[],
  powerDays: DayValue[],
  imergDays: DayValue[],
  from: string,
  to: string,
): RainfallSourceComparison {
  const rainA = windowRain(climatologyDays, from, to);
  const rainB = windowRain(powerDays, from, to);
  const rainC = windowRain(imergDays, from, to);

  const totalA = rainA.totalMm;
  const totalB = rainB.totalMm;
  const totalC = rainC.totalMm;

  const departureBA = totalB !== null && totalA !== null ? totalB - totalA : null;
  const sensitivityCB = totalC !== null && totalB !== null ? totalC - totalB : null;

  // Redistribute observed B season total according to baseline A daily proportions
  let timingRedistributed: number[] | null = null;
  if (totalB !== null && totalA !== null && totalA > 0) {
    const inWindowA = climatologyDays.filter((d) => d.date >= from && d.date <= to && d.mm !== null);
    timingRedistributed = inWindowA.map((d) => ((d.mm ?? 0) / totalA) * totalB);
  }

  return {
    seasonTotalA_ClimatologyMm: totalA,
    seasonTotalB_PowerMm: totalB,
    seasonTotalC_ImergMm: totalC,
    departureMm_B_minus_A: departureBA,
    productSensitivityMm_C_minus_B: sensitivityCB,
    timingRedistributedMm: timingRedistributed,
  };
}

export interface Spread {
  n: number;
  p10: number | null;
  p50: number | null;
  p90: number | null;
}

export function spread(values: Array<number | null>): Spread {
  const v = values.filter((x): x is number => x !== null);
  return { n: v.length, p10: percentileOf(v, 0.1), p50: percentileOf(v, 0.5), p90: percentileOf(v, 0.9) };
}
