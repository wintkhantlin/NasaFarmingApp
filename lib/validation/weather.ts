/**
 * Weather validation: NASA POWER daily point data against GHCN-Daily station records.
 *
 * The question is not "is POWER accurate?" in general but "is it good enough for the decisions the
 * engine makes with it?": crop heat-limit days, cold nights, wet days and monthly rain totals.
 * Grades use the acceptance rules in ACCEPTANCE below. They are this project's rules, stated up front so
 * they can be argued with, not an international standard.
 */

import type { DailyWeather } from "../nasa/power";
import type { GhcnDaily, GhcnStation } from "./ghcn";
import {
  cleanPairs,
  continuousScores,
  eventScores,
  laggedPairs,
  pearson,
  type ContinuousScores,
  type EventScores,
  type Pair,
} from "./metrics";

/** Myanmar's three farming seasons: hot (Mar–May), monsoon (Jun–Oct), cool (Nov–Feb). */
export type Season = "hot" | "monsoon" | "cool";
export const SEASONS: Season[] = ["hot", "monsoon", "cool"];

export function seasonOf(isoDate: string): Season {
  const m = Number(isoDate.slice(5, 7));
  if (m >= 3 && m <= 5) return "hot";
  if (m >= 6 && m <= 10) return "monsoon";
  return "cool";
}

export type Grade = "good" | "usable-with-care" | "poor" | "insufficient-data";

/** Acceptance rules. Change them here and in docs/validation/WEATHER_VALIDATION.md together. */
export const ACCEPTANCE = {
  /** Daily max/min temperature: |bias| and RMSE in °C. */
  temperature: { good: { bias: 1, rmse: 2 }, usable: { bias: 2, rmse: 3.5 }, minPairs: 365 },
  /** Monthly rain totals: |relative bias| and correlation. */
  monthlyRain: { good: { relBias: 0.15, r: 0.85 }, usable: { relBias: 0.3, r: 0.7 }, minMonths: 24 },
  /** Threshold-day detection (heat, cold): probability of detection and false alarm ratio. */
  thresholdDays: { good: { pod: 0.7, far: 0.3 }, usable: { pod: 0.5, far: 0.5 }, minEvents: 20 },
  /** A month counts only if at least this share of its days has a station reading. */
  monthCompleteness: 0.9,
  wetDayMm: 1,
} as const;

/** Thresholds the crop catalog actually uses (heatFlowerC 32–38 °C, coldC 15 °C). */
export const HEAT_LIMITS_C = [32, 35, 38] as const;
export const COLD_LIMITS_C = [15] as const;

export interface GradedScores extends ContinuousScores {
  grade: Grade;
  gradeReason: string;
}

export interface ThresholdCheck extends EventScores {
  thresholdC: number;
  kind: "heat" | "cold";
  observedEvents: number;
  grade: Grade;
  gradeReason: string;
}

export interface TemperatureReport {
  variable: "tmax" | "tmin";
  daily: GradedScores;
  bySeason: Record<Season, ContinuousScores>;
  thresholds: ThresholdCheck[];
}

export interface RainReport {
  daily: ContinuousScores;
  /** Daily correlation with POWER shifted by -1, 0, +1 days. */
  lagR: Record<"-1" | "0" | "1", number | null>;
  /** The lag with the best daily correlation; the wet-day scores use it. */
  bestLag: -1 | 0 | 1;
  wetDays: EventScores;
  monthly: GradedScores;
  monthlyBySeason: Record<Season, ContinuousScores>;
  monthsCompared: number;
  /** Share of station days (any element reported) that also have a rain reading. */
  rainCoverage: number | null;
  /**
   * True when the station mostly leaves dry days blank instead of writing 0 (common in Myanmar's SYNOP-
   * derived GHCN records). Then daily bias and false alarms are not meaningful: the dry days that would
   * expose false alarms are missing, and the remaining days are mostly wet.
   */
  wetDaysOnly: boolean;
}

/** Below this rain coverage the record is treated as wet-days-only. */
export const MIN_RAIN_COVERAGE = 0.6;

export interface StationReport {
  station: GhcnStation;
  powerCell: { lat: number; lon: number; elevationM: number | null };
  /** POWER cell elevation minus station elevation. At ~6.5 °C/km this explains part of any temperature bias. */
  elevationDiffM: number | null;
  period: { start: string; end: string };
  qcRejected: GhcnDaily["qcRejected"];
  tmax: TemperatureReport;
  tmin: TemperatureReport;
  rain: RainReport;
}

const sig = (x: number) => Number(x.toFixed(2));

export function gradeTemperature(s: ContinuousScores): { grade: Grade; gradeReason: string } {
  const a = ACCEPTANCE.temperature;
  if (s.n < a.minPairs || s.bias === null || s.rmse === null)
    return { grade: "insufficient-data", gradeReason: `${s.n} paired days, need ${a.minPairs}` };
  const b = Math.abs(s.bias);
  const why = `bias ${sig(s.bias)} °C, RMSE ${sig(s.rmse)} °C`;
  if (b <= a.good.bias && s.rmse <= a.good.rmse) return { grade: "good", gradeReason: why };
  if (b <= a.usable.bias && s.rmse <= a.usable.rmse) return { grade: "usable-with-care", gradeReason: why };
  return { grade: "poor", gradeReason: why };
}

export function gradeMonthlyRain(s: ContinuousScores): { grade: Grade; gradeReason: string } {
  const a = ACCEPTANCE.monthlyRain;
  if (s.n < a.minMonths || s.relBias === null || s.r === null)
    return { grade: "insufficient-data", gradeReason: `${s.n} complete months, need ${a.minMonths}` };
  const b = Math.abs(s.relBias);
  const why = `relative bias ${Math.round(s.relBias * 100)}%, r ${sig(s.r)}`;
  if (b <= a.good.relBias && s.r >= a.good.r) return { grade: "good", gradeReason: why };
  if (b <= a.usable.relBias && s.r >= a.usable.r) return { grade: "usable-with-care", gradeReason: why };
  return { grade: "poor", gradeReason: why };
}

export function gradeThreshold(e: EventScores): { grade: Grade; gradeReason: string } {
  const a = ACCEPTANCE.thresholdDays;
  const events = e.hits + e.misses;
  if (events < a.minEvents || e.pod === null)
    return { grade: "insufficient-data", gradeReason: `${events} observed days past the limit, need ${a.minEvents}` };
  const far = e.far ?? 0;
  const why = `detects ${Math.round(e.pod * 100)}% of observed days, ${Math.round(far * 100)}% of flagged days are false alarms`;
  if (e.pod >= a.good.pod && far <= a.good.far) return { grade: "good", gradeReason: why };
  if (e.pod >= a.usable.pod && far <= a.usable.far) return { grade: "usable-with-care", gradeReason: why };
  return { grade: "poor", gradeReason: why };
}

/** Station values lined up on the POWER dates (null where the station has no QC-passed reading). */
export function alignStation(dates: string[], values: Map<string, number>): Array<number | null> {
  return dates.map((d) => values.get(d) ?? null);
}

function pairsBySeason(dates: string[], obs: Array<number | null>, model: Array<number | null>): Record<Season, ContinuousScores> {
  const out = {} as Record<Season, ContinuousScores>;
  for (const s of SEASONS) {
    const o = dates.map((d, i) => (seasonOf(d) === s ? obs[i] : null));
    out[s] = continuousScores(cleanPairs(o, model));
  }
  return out;
}

export function temperatureReport(
  variable: "tmax" | "tmin",
  dates: string[],
  obs: Array<number | null>,
  model: Array<number | null>,
): TemperatureReport {
  const pairs = cleanPairs(obs, model);
  const daily = continuousScores(pairs);
  const limits = variable === "tmax" ? HEAT_LIMITS_C : COLD_LIMITS_C;
  const kind = variable === "tmax" ? "heat" : "cold";
  const thresholds = limits.map((t): ThresholdCheck => {
    // Same comparison as the engine: heat is tmax > limit, cold is tmin < limit.
    const e = eventScores(pairs, kind === "heat" ? (v) => v > t : (v) => v < t);
    return { ...e, thresholdC: t, kind, observedEvents: e.hits + e.misses, ...gradeThreshold(e) };
  });
  return { variable, daily: { ...daily, ...gradeTemperature(daily) }, bySeason: pairsBySeason(dates, obs, model), thresholds };
}

function daysInMonth(ym: string): number {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Monthly totals over paired days, keeping only months where the station covers enough of the month. */
export function monthlyTotals(dates: string[], obs: Array<number | null>, model: Array<number | null>): Array<Pair & { month: string }> {
  const acc = new Map<string, { o: number; m: number; n: number }>();
  for (let i = 0; i < dates.length; i++) {
    const o = obs[i];
    const m = model[i];
    if (o === null || m === null) continue;
    const ym = dates[i].slice(0, 7);
    const a = acc.get(ym) ?? { o: 0, m: 0, n: 0 };
    a.o += o;
    a.m += m;
    a.n++;
    acc.set(ym, a);
  }
  const out: Array<Pair & { month: string }> = [];
  for (const [month, a] of [...acc.entries()].sort()) {
    if (a.n / daysInMonth(month) < ACCEPTANCE.monthCompleteness) continue;
    out.push({ month, obs: a.o, model: a.m });
  }
  return out;
}

export function rainReport(
  dates: string[],
  obs: Array<number | null>,
  model: Array<number | null>,
  /** Number of dates where the station reported anything. Defaults to the dates that have rain. */
  stationDays?: number,
): RainReport {
  const rainDays = obs.filter((v) => v !== null).length;
  const denom = stationDays ?? rainDays;
  const rainCoverage = denom === 0 ? null : rainDays / denom;
  const lagR = {
    "-1": pearson(laggedPairs(obs, model, -1)),
    "0": pearson(laggedPairs(obs, model, 0)),
    "1": pearson(laggedPairs(obs, model, 1)),
  };
  let bestLag: -1 | 0 | 1 = 0;
  for (const l of [-1, 1] as const) {
    if ((lagR[String(l) as "-1" | "1"] ?? -Infinity) > (lagR[String(bestLag) as "0"] ?? -Infinity)) bestLag = l;
  }
  const wetDays = eventScores(laggedPairs(obs, model, bestLag), (v) => v >= ACCEPTANCE.wetDayMm);
  const months = monthlyTotals(dates, obs, model);
  const monthly = continuousScores(months);
  const monthlyBySeason = {} as Record<Season, ContinuousScores>;
  for (const s of SEASONS) monthlyBySeason[s] = continuousScores(months.filter((p) => seasonOf(`${p.month}-01`) === s));
  return {
    daily: continuousScores(cleanPairs(obs, model)),
    lagR,
    bestLag,
    wetDays,
    monthly: { ...monthly, ...gradeMonthlyRain(monthly) },
    monthlyBySeason,
    monthsCompared: months.length,
    rainCoverage,
    wetDaysOnly: rainCoverage !== null && rainCoverage < MIN_RAIN_COVERAGE,
  };
}

export function stationReport(station: GhcnStation, ghcn: GhcnDaily, power: DailyWeather): StationReport {
  const { dates, series } = power;
  const tmaxModel = series.T2M_MAX ?? dates.map(() => null);
  const tminModel = series.T2M_MIN ?? dates.map(() => null);
  const rainModel = series.PRECTOTCORR ?? dates.map(() => null);
  const stationDays = dates.filter((d) => ghcn.prcp.has(d) || ghcn.tmax.has(d) || ghcn.tmin.has(d)).length;
  return {
    station,
    powerCell: { lat: power.latitude, lon: power.longitude, elevationM: power.elevationM },
    elevationDiffM: power.elevationM === null ? null : Math.round(power.elevationM - station.elevationM),
    period: { start: dates[0], end: dates[dates.length - 1] },
    qcRejected: ghcn.qcRejected,
    tmax: temperatureReport("tmax", dates, alignStation(dates, ghcn.tmax), tmaxModel),
    tmin: temperatureReport("tmin", dates, alignStation(dates, ghcn.tmin), tminModel),
    rain: rainReport(dates, alignStation(dates, ghcn.prcp), rainModel, stationDays),
  };
}
