import type { ResolvedRegion } from "../data/regions";
import type { Field, SoilObservation, TextureClass } from "../types";
import type { ImergDay } from "../nasa/imerg";
import type { SmapDay } from "../nasa/appeears/results";
import type { ObservationSummary } from "../nasa/derive/ndvi";
import type { SlopeStats } from "../nasa/derive/slope";
import { completeYears, type DailyRecord } from "./climate";
import type { DayValue } from "./rain";

/** The shared study baseline from the handoff: complete years where coverage permits. */
export const BASELINE = { startYear: 2016, endYear: 2025 } as const;

export type SourceStatus = "ok" | "unconfigured" | "unavailable" | "pending" | "not-requested";

export interface PowerInfo {
  status: SourceStatus;
  version: string | null;
  fillValue: number;
  timeStandard: string | null;
  sources: string[];
  retrievedAt: string | null;
  start: string | null;
  end: string | null;
  elevationM: number | null;
  units: Partial<Record<string, string>>;
}

export interface ImergInfo {
  status: SourceStatus;
  granules: number;
  partialDays: number;
  retrievedAt: string | null;
  start: string | null;
  end: string | null;
}

export interface RemoteInfo {
  status: SourceStatus;
  retrievedAt: string | null;
  start: string | null;
  end: string | null;
}

export type SoilValueSource = "farmer" | "soilgrids";

export interface EffectiveSoil {
  ph: { value: number; from: SoilValueSource; note: string } | null;
  texture: { value: TextureClass; from: SoilValueSource; note: string } | null;
  organicCarbonGKg: { value: number; from: SoilValueSource; note: string } | null;
  drainage: { value: string; note: string } | null;
  salinityDsM: { value: number; note: string } | null;
  awcMmPerM: { value: number; note: string } | null;
  rootDepthM: { value: number; note: string } | null;
  /** Dated measurements the farmer gave, kept so the report can list them. */
  observations: SoilObservation[];
  soilGridsAvailable: boolean;
}

export interface EngineData {
  field: Field;
  region: ResolvedRegion;
  latitude: number;
  elevationM: number;
  /** POWER daily records, UTC days. May be empty when POWER was not reachable. */
  records: DailyRecord[];
  power: PowerInfo;
  /** IMERG daily values for the field's 0.1 degree cell, if retrieved. */
  imerg: ImergDay[];
  imergInfo: ImergInfo;
  /** Regional soil moisture, if retrieved. 9 km: context only. */
  smap: SmapDay[];
  smapInfo: RemoteInfo;
  hls: ObservationSummary[];
  hlsInfo: RemoteInfo;
  slope: SlopeStats | null;
  srtmInfo: RemoteInfo;
  soil: EffectiveSoil;
}

export interface RainSeries {
  days: DayValue[];
  /** Days taken from IMERG, days taken from POWER as a recorded fallback, days with neither. */
  fromR: number;
  fromP: number;
  missing: number;
  primary: "R" | "P" | "none";
}

/**
 * One rainfall series for the engine. IMERG is primary for days where it has a value and a full-day
 * sample count; POWER fills the rest and every fallback day is counted. The two are never averaged:
 * they are not independent ground truth and averaging would hide their disagreement.
 */
/** IMERG is used only when it covers at least this share of the baseline days. A patchy mix is not used. */
export const IMERG_MIN_COVERAGE = 0.95;

export function buildRainSeries(records: DailyRecord[], imerg: ImergDay[]): RainSeries {
  const usable = imerg.filter((d) => d.precipMm !== null && !d.partialSampling);
  const baselineDays = records.filter((r) => r.year >= BASELINE.startYear && r.year <= BASELINE.endYear).length;
  const covered = usable.filter((d) => Number(d.date.slice(0, 4)) >= BASELINE.startYear && Number(d.date.slice(0, 4)) <= BASELINE.endYear).length;
  const enough = baselineDays > 0 && covered / baselineDays >= IMERG_MIN_COVERAGE;
  const r = new Map((enough ? usable : []).map((d) => [d.date, d.precipMm as number]));
  let fromR = 0;
  let fromP = 0;
  let missing = 0;
  const days: DayValue[] = records.map((rec) => {
    const rv = r.get(rec.date);
    if (rv !== undefined) {
      fromR++;
      return { date: rec.date, mm: rv };
    }
    if (rec.rainMm !== null) {
      fromP++;
      return { date: rec.date, mm: rec.rainMm };
    }
    missing++;
    return { date: rec.date, mm: null };
  });
  const primary = fromR > 0 && fromR >= fromP ? "R" : fromP > 0 || fromR > 0 ? "P" : "none";
  return { days, fromR, fromP, missing, primary };
}

/** Years inside the baseline that have a full record of rain. */
export function baselineYears(records: DailyRecord[]): number[] {
  return completeYears(records).filter((y) => y >= BASELINE.startYear && y <= BASELINE.endYear);
}

/** Records restricted to the baseline years. */
export function baselineRecords(records: DailyRecord[]): DailyRecord[] {
  return records.filter((r) => r.year >= BASELINE.startYear && r.year <= BASELINE.endYear + 1);
}
