import type { DailyWeather } from "../nasa/power";
import { dayOfYear, hargreavesEt0, penmanMonteithEt0 } from "./et0";

/** Climate statistics for a field, computed from the daily weather record. */

export interface DailyRecord {
  date: string;
  year: number;
  month: number; // 1 to 12
  doy: number;
  tmaxC: number | null;
  tminC: number | null;
  tmeanC: number | null;
  rainMm: number | null;
  et0Mm: number | null;
  rootWetness: number | null; // 0 to 1
  /** Daily mean relative humidity at 2 m, %. POWER RH2M. */
  rhPct?: number | null;
  /** Wind speed at 2 m, m/s. POWER WS2M. */
  wind2?: number | null;
  /** Incoming shortwave radiation, MJ/m2/day. Not net radiation. POWER ALLSKY_SFC_SW_DWN. */
  swMj?: number | null;
  /** Surface pressure, kPa. POWER PS. */
  psKpa?: number | null;
}

/**
 * Reference ET0 for one day, the same rule as `dailyEt0` in water.ts: FAO-56 Penman-Monteith when
 * humidity, wind and radiation are all present, Hargreaves from temperature alone otherwise.
 */
function et0For(w: DailyWeather, doy: number, tmax: number | null, tmin: number | null, tmean: number | null, rh: number | null, u2: number | null, rs: number | null, ps: number | null): number | null {
  if (tmax === null || tmin === null) return null;
  if (rh !== null && u2 !== null && rs !== null) {
    return penmanMonteithEt0({ latDeg: w.latitude, doy, elevationM: w.elevationM ?? 0, tmaxC: tmax, tminC: tmin, tmeanC: tmean ?? undefined, rhMeanPct: rh, u2, rsMj: rs, pressureKpa: ps ?? undefined });
  }
  return hargreavesEt0(w.latitude, doy, tmax, tmin);
}

export function toDailyRecords(w: DailyWeather): DailyRecord[] {
  const s = w.series;
  return w.dates.map((date, i) => {
    const [y, m] = date.split("-").map(Number);
    const doy = dayOfYear(date);
    const tmax = s.T2M_MAX?.[i] ?? null;
    const tmin = s.T2M_MIN?.[i] ?? null;
    const t2m = s.T2M?.[i] ?? null;
    const rh = s.RH2M?.[i] ?? null;
    const wind2 = s.WS2M?.[i] ?? null;
    const sw = s.ALLSKY_SFC_SW_DWN?.[i] ?? null;
    const ps = s.PS?.[i] ?? null;
    return {
      date,
      year: y,
      month: m,
      doy,
      tmaxC: tmax,
      tminC: tmin,
      tmeanC: t2m ?? (tmax !== null && tmin !== null ? (tmax + tmin) / 2 : null),
      rainMm: s.PRECTOTCORR?.[i] ?? null,
      et0Mm: et0For(w, doy, tmax, tmin, t2m, rh, wind2, sw, ps),
      rootWetness: s.GWETROOT?.[i] ?? null,
      rhPct: rh,
      wind2,
      swMj: sw,
      psKpa: ps,
    };
  });
}

/** Linear-interpolated percentile of an ascending array, p from 0 to 1. */
export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return Number.NaN;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : Number.NaN);

function groupBy<T, K>(items: T[], key: (t: T) => K): Map<K, T[]> {
  const m = new Map<K, T[]>();
  for (const it of items) {
    const k = key(it);
    const list = m.get(k);
    if (list) list.push(it);
    else m.set(k, [it]);
  }
  return m;
}

/** Calendar years with at least 355 days of rain data. Partial years would bias totals. */
export function completeYears(records: DailyRecord[]): number[] {
  const out: number[] = [];
  for (const [year, days] of groupBy(records, (r) => r.year)) {
    if (days.filter((d) => d.rainMm !== null).length >= 355) out.push(year);
  }
  return out.sort((a, b) => a - b);
}

export function annualRainfall(records: DailyRecord[]): Array<{ year: number; mm: number }> {
  const complete = new Set(completeYears(records));
  return [...groupBy(records, (r) => r.year)]
    .filter(([y]) => complete.has(y))
    .map(([year, days]) => ({ year, mm: days.reduce((s, d) => s + (d.rainMm ?? 0), 0) }))
    .sort((a, b) => a.year - b.year);
}

export interface MonthlyNormal {
  month: number;
  tmaxC: number;
  tminC: number;
  tmeanC: number;
  /** Mean monthly rainfall total across complete years. */
  rainMm: number;
  /** Mean monthly reference evapotranspiration total. */
  et0Mm: number;
  /** rain divided by et0; above 0.5 is the usual "enough water to grow" line. */
  rainOverEt0: number;
}

export function monthlyNormals(records: DailyRecord[]): MonthlyNormal[] {
  const complete = new Set(completeYears(records));
  const rows = records.filter((r) => complete.has(r.year));
  const nYears = complete.size || 1;
  return Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const days = rows.filter((r) => r.month === month);
    const num = (pick: (r: DailyRecord) => number | null) =>
      days.map(pick).filter((v): v is number => v !== null);
    const rainMm = num((r) => r.rainMm).reduce((a, b) => a + b, 0) / nYears;
    const et0Mm = num((r) => r.et0Mm).reduce((a, b) => a + b, 0) / nYears;
    return {
      month,
      tmaxC: mean(num((r) => r.tmaxC)),
      tminC: mean(num((r) => r.tminC)),
      tmeanC: mean(num((r) => r.tmeanC)),
      rainMm,
      et0Mm,
      rainOverEt0: et0Mm > 0 ? rainMm / et0Mm : Number.POSITIVE_INFINITY,
    };
  });
}

export interface WetSeason {
  startMonth: number;
  endMonth: number;
  months: number[];
}

/**
 * Runs of consecutive months that are warm enough and wet enough to grow a
 * crop on rain alone. The year is treated as a circle, so a season from
 * November to February is one season.
 */
export function wetSeasons(
  normals: MonthlyNormal[],
  opts: { minMeanTempC?: number; minRainOverEt0?: number } = {},
): WetSeason[] {
  const minT = opts.minMeanTempC ?? 8;
  const minR = opts.minRainOverEt0 ?? 0.5;
  const ok = normals.map((n) => n.tmeanC >= minT && n.rainOverEt0 >= minR);
  if (ok.every(Boolean)) {
    const all = normals.map((n) => n.month);
    return [{ startMonth: 1, endMonth: 12, months: all }];
  }
  if (!ok.some(Boolean)) return [];
  // Start scanning just after a failing month so no run is cut at the year boundary.
  const firstBad = ok.findIndex((v) => !v);
  const seasons: WetSeason[] = [];
  let run: number[] = [];
  for (let k = 1; k <= 12; k++) {
    const idx = (firstBad + k) % 12;
    if (ok[idx]) run.push(idx + 1);
    else if (run.length) {
      seasons.push({ startMonth: run[0], endMonth: run[run.length - 1], months: run });
      run = [];
    }
  }
  if (run.length) seasons.push({ startMonth: run[0], endMonth: run[run.length - 1], months: run });
  return seasons;
}

export interface FrostStats {
  /** Seasons in the record with enough data. */
  years: number;
  /** Seasons in which the minimum temperature reached the threshold at least once. */
  frostYears: number;
  /** Day of the year of the last spring frost: the median, and the day by which 90% of years were done. */
  lastSpringFrost: { median: number; p90: number } | null;
  /** Day of the year of the first autumn frost: the median, and the day by which 10% of years had begun. */
  firstAutumnFrost: { median: number; p10: number } | null;
  /** Number of days between last spring and first autumn frost, median. */
  frostFreeDays: number | null;
}

/**
 * Frost dates. Winter is split in two so the year does not cut it: in the
 * southern hemisphere dates are shifted by half a year first, and the day
 * numbers returned are in that shifted calendar. Use `shiftedDoyToLabel`.
 */
export function frostStats(records: DailyRecord[], latDeg: number, thresholdC = 0): FrostStats {
  const south = latDeg < 0;
  const shift = (r: DailyRecord) => (south ? ((r.doy + 182) % 365) + 1 : r.doy);
  const seasonYear = (r: DailyRecord) => (south && r.doy > 182 ? r.year + 1 : r.year);
  const SPLIT = 200; // shifted day number that separates spring from autumn

  const lastSpring: number[] = [];
  const firstAutumn: number[] = [];
  const free: number[] = [];
  let years = 0;
  let frostYears = 0;

  for (const [, days] of groupBy(records, seasonYear)) {
    if (days.filter((d) => d.tminC !== null).length < 350) continue;
    years++;
    const frosts = days.filter((d) => d.tminC !== null && d.tminC <= thresholdC).map(shift);
    if (frosts.length === 0) continue;
    frostYears++;
    const spring = frosts.filter((d) => d <= SPLIT);
    const autumn = frosts.filter((d) => d > SPLIT);
    const ls = spring.length ? Math.max(...spring) : null;
    const fa = autumn.length ? Math.min(...autumn) : null;
    if (ls !== null) lastSpring.push(ls);
    if (fa !== null) firstAutumn.push(fa);
    if (ls !== null && fa !== null) free.push(fa - ls);
  }

  const asc = (xs: number[]) => [...xs].sort((a, b) => a - b);
  const ls = asc(lastSpring);
  const fa = asc(firstAutumn);
  return {
    years,
    frostYears,
    lastSpringFrost: ls.length ? { median: percentile(ls, 0.5), p90: percentile(ls, 0.9) } : null,
    firstAutumnFrost: fa.length ? { median: percentile(fa, 0.5), p10: percentile(fa, 0.1) } : null,
    frostFreeDays: free.length ? percentile(asc(free), 0.5) : null,
  };
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const CUM_DAYS = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];

/** "24 Apr" for a day number in a non-leap year. For southern fields pass the shifted number back through `unshiftDoy`. */
export function doyToLabel(doy: number): string {
  const d = Math.min(365, Math.max(1, Math.round(doy)));
  let m = 11;
  while (m > 0 && CUM_DAYS[m] >= d) m--;
  return `${d - CUM_DAYS[m]} ${MONTH_NAMES[m]}`;
}

export const unshiftDoy = (shifted: number) => ((Math.round(shifted) + 181) % 365) + 1;

export interface DrySpellStats {
  years: number;
  /** Longest run of days below the rain threshold in a year: median and 90th percentile. */
  longestDays: { median: number; p90: number };
}

export function dryspells(records: DailyRecord[], thresholdMm = 1): DrySpellStats {
  const complete = new Set(completeYears(records));
  const longest: number[] = [];
  for (const [year, days] of groupBy(records, (r) => r.year)) {
    if (!complete.has(year)) continue;
    let run = 0;
    let best = 0;
    for (const d of days) {
      if (d.rainMm !== null && d.rainMm < thresholdMm) {
        run++;
        if (run > best) best = run;
      } else run = 0; // a wet day, or a missing value, ends the run
    }
    longest.push(best);
  }
  longest.sort((a, b) => a - b);
  return {
    years: longest.length,
    longestDays: { median: percentile(longest, 0.5), p90: percentile(longest, 0.9) },
  };
}

/** Mean number of days per year with a maximum temperature above the threshold. */
export function hotDaysPerYear(records: DailyRecord[], thresholdC = 35): number {
  const complete = new Set(completeYears(records));
  const rows = records.filter((r) => complete.has(r.year));
  if (complete.size === 0) return Number.NaN;
  return rows.filter((r) => r.tmaxC !== null && r.tmaxC > thresholdC).length / complete.size;
}

/**
 * Daily Growing Degree Days (GDD). Clamps BOTH Tmax and Tmin to [baseC, upperC]
 * (McMaster and Wilhelm, 1997 convention) before taking the mean, preventing
 * asymmetrical overshoot when Tmin exceeds the ceiling.
 * GDD = (clamped Tmax + clamped Tmin) / 2 - baseC.
 */
export function dailyGdd(tmaxC: number, tminC: number, baseC: number, upperC: number): number {
  const boundedMax = Math.min(upperC, Math.max(baseC, tmaxC));
  const boundedMin = Math.min(upperC, Math.max(baseC, tminC));
  return Math.max(0, (boundedMax + boundedMin) / 2 - baseC);
}

/**
 * Accumulates GDD across daily records for a given date window.
 */
export function windowGdd(records: DailyRecord[], fromIso: string, toIso: string, baseC: number, upperC: number): number | null {
  const windowDays = records.filter((r) => r.date >= fromIso && r.date <= toIso);
  if (windowDays.length === 0) return null;
  let total = 0;
  for (const d of windowDays) {
    if (d.tmaxC === null || d.tminC === null) return null;
    total += dailyGdd(d.tmaxC, d.tminC, baseC, upperC);
  }
  return total;
}
