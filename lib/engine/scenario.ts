import { hargreavesEt0 } from "./et0";
import type { EngineData } from "./data";
import type { Irrigation } from "../types";

/** Season irrigation depth assumed when the farmer has not entered one. Shared by the engine and the what-if. */
export const ASSUMED_IRRIGATION_MM = { supplemental: 150, full: 350 } as const;

/**
 * A test applied to the past record. Everything is an even, simple change so the farmer can say it back:
 * "20% less rain", "rain arrives 15 days later", "2 °C hotter", "with a pump".
 */
export interface Scenario {
  /** Percent change to every day's rain. */
  rainPct: number;
  /** Degrees added to every day's temperature. */
  tempC: number;
  /** Days later that all rain arrives. Totals are kept; only the timing moves. */
  delayDays: number;
  /** A water supply to test instead of the one recorded. null keeps what the farmer said. */
  irrigation: Irrigation | null;
}

export const NO_SCENARIO: Scenario = { rainPct: 0, tempC: 0, delayDays: 0, irrigation: null };

export const RAIN_RANGE = { min: -40, max: 40, step: 5 } as const;
export const TEMP_RANGE = { min: -2, max: 3, step: 0.5 } as const;
export const DELAY_RANGE = { min: 0, max: 30, step: 5 } as const;

export const isNeutral = (s: Scenario) => s.rainPct === 0 && s.tempC === 0 && s.delayDays === 0 && s.irrigation === null;

/** True when a change to the weather itself is tested (not only the water supply). */
export const changesWeather = (s: Scenario) => s.rainPct !== 0 || s.tempC !== 0 || s.delayDays !== 0;

export interface ScenarioPreset {
  id: string;
  /** What changes. A partial scenario, so presets never touch the water supply. */
  change: Pick<Scenario, "rainPct" | "tempC" | "delayDays">;
}

/** One-tap tests for the questions farmers ask most. Values sit on the slider steps. */
export const PRESETS: readonly ScenarioPreset[] = [
  { id: "dry", change: { rainPct: -25, tempC: 0, delayDays: 0 } },
  { id: "late", change: { rainPct: 0, tempC: 0, delayDays: 15 } },
  { id: "hot", change: { rainPct: 0, tempC: 2, delayDays: 0 } },
  { id: "harsh", change: { rainPct: -20, tempC: 1.5, delayDays: 10 } },
  { id: "wet", change: { rainPct: 25, tempC: 0, delayDays: 0 } },
];

/** The preset that exactly matches the weather part of a scenario, if any. */
export function matchingPreset(s: Scenario): ScenarioPreset | null {
  return PRESETS.find((p) => p.change.rainPct === s.rainPct && p.change.tempC === s.tempC && p.change.delayDays === s.delayDays) ?? null;
}

const DAY_MS = 86_400_000;
const shiftIso = (iso: string, days: number) => new Date(Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);

/**
 * Moves a daily value later by `days`, by calendar date. A day whose source falls before the record starts
 * had a dry season behind it, so it gets 0 rather than a gap. A source day that is missing stays missing.
 */
function delayed<T extends { date: string }>(rows: T[], days: number, get: (r: T) => number | null, set: (r: T, v: number | null) => T): T[] {
  if (days === 0 || rows.length === 0) return rows;
  const byDate = new Map(rows.map((r) => [r.date.slice(0, 10), get(r)]));
  const first = rows.reduce((m, r) => (r.date < m ? r.date : m), rows[0].date).slice(0, 10);
  return rows.map((r) => {
    const src = shiftIso(r.date, -days);
    const v = byDate.get(src);
    return set(r, v !== undefined ? v : src < first ? 0 : null);
  });
}

const scaled = (v: number | null, k: number) => (v === null ? null : v * k);

function weatherShifted(data: EngineData, s: Scenario): Pick<EngineData, "records" | "imerg"> {
  const k = 1 + s.rainPct / 100;
  const sh = (v: number | null) => (v === null ? null : v + s.tempC);
  const records = delayed(data.records, s.delayDays, (r) => r.rainMm, (r, v) => ({ ...r, rainMm: v })).map((r) => {
    const tmaxC = sh(r.tmaxC);
    const tminC = sh(r.tminC);
    return {
      ...r,
      tmaxC,
      tminC,
      tmeanC: sh(r.tmeanC),
      rainMm: scaled(r.rainMm, k),
      et0Mm: s.tempC !== 0 && tmaxC !== null && tminC !== null ? hargreavesEt0(data.latitude, r.doy, tmaxC, tminC) : r.et0Mm,
    };
  });
  const imerg = delayed(data.imerg, s.delayDays, (d) => d.precipMm, (d, v) => ({ ...d, precipMm: v })).map((d) =>
    d.precipMm === null ? d : { ...d, precipMm: d.precipMm * k },
  );

  return { records, imerg };
}

/**
 * An even change on every replayed day. Nothing else changes: missing days stay missing,
 * and yield and money are not recalculated (that needs a calibrated response model).
 */
export function applyScenario(data: EngineData, s: Scenario): EngineData {
  if (isNeutral(s)) return data;
  const weather = changesWeather(s) ? weatherShifted(data, s) : { records: data.records, imerg: data.imerg };
  const out: EngineData = { ...data, ...weather };
  if (s.irrigation === null) return out;
  return {
    ...out,
    field: {
      ...data.field,
      irrigation: s.irrigation,
      constraints: {
        ...data.field.constraints,
        irrigation: {
          access: s.irrigation,
          amountMm: data.field.constraints?.irrigation?.amountMm ?? ASSUMED_IRRIGATION_MM[s.irrigation === "supplemental" ? "supplemental" : "full"],
        },
      },
    },
  };
}
