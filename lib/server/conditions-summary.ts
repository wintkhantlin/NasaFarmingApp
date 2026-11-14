import { completeYears, monthlyNormals, toDailyRecords } from "../engine/climate";
import { BASELINE, buildRainSeries } from "../engine/data";
import { dailyEt0 } from "../engine/water";
import type { ImergDay } from "../nasa/imerg";
import type { DailyWeather } from "../nasa/power";

const round1 = (n: number) => Math.round(n * 10) / 10;

export interface ConditionsSummary {
  monthlyRainMm: number[];
  monthlyTmaxC: number[];
  monthlyTminC: number[];
  /** Reference ET0 per month, mm: FAO-56 Penman-Monteith, Hargreaves only on days missing its inputs. */
  monthlyEt0Mm: number[];
  annualRainMm: number;
  /** Which series the rainfall chart uses: the same choice the comparison makes. */
  rainSource: "imerg" | "power";
  rainDays: { imerg: number; power: number; missing: number };
  /** Mean POWER GWETROOT over complete years, % of saturation. Undefined when POWER did not return it. */
  rootWetnessPct?: number;
  completeYears: number;
}

/**
 * Monthly summary of the baseline years for the Conditions screen. Uses the same rainfall series
 * (`buildRainSeries`) and the same ET0 method (`dailyEt0`) as `compareRotations`, and averages every
 * monthly figure over the same complete years, so the screens cannot disagree.
 */
export function summariseConditions(weather: DailyWeather, imerg: ImergDay[]): ConditionsSummary {
  const records = toDailyRecords(weather).filter((r) => r.year >= BASELINE.startYear && r.year <= BASELINE.endYear);
  const complete = new Set(completeYears(records));
  const nYears = complete.size || 1;
  const rain = buildRainSeries(records, imerg);
  const rainByDate = new Map(rain.days.map((d) => [d.date, d.mm]));
  const et0 = dailyEt0(records, weather.latitude, weather.elevationM ?? 0);

  const rainByMonth = Array.from({ length: 12 }, () => 0);
  const et0ByMonth = Array.from({ length: 12 }, () => 0);
  for (const r of records) {
    if (!complete.has(r.year)) continue;
    const mm = rainByDate.get(r.date);
    if (mm != null) rainByMonth[r.month - 1] += mm / nYears;
  }
  for (const d of et0) {
    if (d.mm === null || !complete.has(Number(d.date.slice(0, 4)))) continue;
    et0ByMonth[Number(d.date.slice(5, 7)) - 1] += d.mm / nYears;
  }

  const wet = records.filter((r) => complete.has(r.year) && r.rootWetness !== null).map((r) => r.rootWetness as number);
  const normals = monthlyNormals(records);
  const monthlyRainMm = rainByMonth.map(Math.round);
  return {
    monthlyRainMm,
    monthlyTmaxC: normals.map((n) => round1(n.tmaxC)),
    monthlyTminC: normals.map((n) => round1(n.tminC)),
    monthlyEt0Mm: et0ByMonth.map(Math.round),
    annualRainMm: monthlyRainMm.reduce((a, b) => a + b, 0),
    rainSource: rain.primary === "R" ? "imerg" : "power",
    rainDays: { imerg: rain.fromR, power: rain.fromP, missing: rain.missing },
    rootWetnessPct: wet.length ? Math.round((wet.reduce((a, b) => a + b, 0) / wet.length) * 100) : undefined,
    completeYears: complete.size,
  };
}
