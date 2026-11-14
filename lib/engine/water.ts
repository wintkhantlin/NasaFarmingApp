import type { Crop } from "../types";
import type { DailyRecord } from "./climate";
import { hargreavesEt0, penmanMonteithEt0 } from "./et0";
import { MIN_VALID_SHARE, spread, type DayValue, type Spread } from "./rain";
import type { SeasonWindow } from "./season";

/**
 * Water-use comparison. ETc = Kc(stage) x ETo. These are potential crop evapotranspiration under
 * standard conditions, not observed water use and not an irrigation instruction. The difference
 * ETc - rain is a screening number ("rainfall versus estimated crop demand"): runoff, stored soil
 * water, drainage and irrigation are not in it. A root-zone balance needs soil inputs and is
 * `unknown` without them.
 */

export interface DailyEt0 {
  date: string;
  mm: number | null;
  method: "penman-monteith" | "hargreaves" | "none";
}

/** ETo per day. Penman-Monteith when humidity, wind, radiation and pressure are present; else Hargreaves, labelled. */
export function dailyEt0(records: DailyRecord[], latDeg: number, elevationM: number): DailyEt0[] {
  return records.map((r) => {
    if (r.tmaxC === null || r.tminC === null) return { date: r.date, mm: null, method: "none" };
    if (r.rhPct != null && r.wind2 != null && r.swMj != null) {
      const mm = penmanMonteithEt0({
        latDeg,
        doy: r.doy,
        elevationM,
        tmaxC: r.tmaxC,
        tminC: r.tminC,
        tmeanC: r.tmeanC ?? undefined,
        rhMeanPct: r.rhPct,
        u2: r.wind2,
        rsMj: r.swMj,
        pressureKpa: r.psKpa ?? undefined,
      });
      return { date: r.date, mm, method: "penman-monteith" };
    }
    return { date: r.date, mm: hargreavesEt0(latDeg, r.doy, r.tmaxC, r.tminC), method: "hargreaves" };
  });
}

export interface SeasonWater {
  year: number;
  evaluable: boolean;
  etoMm: number | null;
  etcMm: number | null;
  rainMm: number | null;
  /** max(0, ETc - rain). A screening metric, not irrigation need. */
  rainShortfallMm: number | null;
  /** True when part of the window used Hargreaves instead of Penman-Monteith. */
  usedFallbackEt0: boolean;
}

export interface WaterSummary {
  eligibleSeasons: number;
  seasons: SeasonWater[];
  etc: Spread;
  rain: Spread;
  shortfall: Spread;
  methodNote: string;
}

export function waterForCrop(crop: Crop, windows: SeasonWindow[], et0: DailyEt0[], rain: DayValue[]): WaterSummary {
  const e = new Map(et0.map((d) => [d.date, d]));
  const r = new Map(rain.map((d) => [d.date, d.mm]));
  const stageKc = (id: string) => crop.profile?.stages.find((s) => s.id === id)?.kc.value ?? crop.kc.mid;

  const seasons: SeasonWater[] = windows.map((w) => {
    let eto = 0;
    let etc = 0;
    let rainSum = 0;
    let expected = 0;
    let validEt = 0;
    let validRain = 0;
    let fallback = false;
    for (const st of w.stages) {
      const kc = stageKc(st.id);
      for (let t = Date.parse(st.from); t <= Date.parse(st.to); t += 86_400_000) {
        expected++;
        const iso = new Date(t).toISOString().slice(0, 10);
        const day = e.get(iso);
        if (day && day.mm !== null) {
          validEt++;
          eto += day.mm;
          etc += kc * day.mm;
          if (day.method === "hargreaves") fallback = true;
        }
        const rv = r.get(iso);
        if (rv !== undefined && rv !== null) {
          validRain++;
          rainSum += rv;
        }
      }
    }
    const evaluable = expected > 0 && validEt / expected >= MIN_VALID_SHARE && validRain / expected >= MIN_VALID_SHARE;
    return {
      year: w.year,
      evaluable,
      etoMm: evaluable ? eto : null,
      etcMm: evaluable ? etc : null,
      rainMm: evaluable ? rainSum : null,
      rainShortfallMm: evaluable ? Math.max(0, etc - rainSum) : null,
      usedFallbackEt0: fallback,
    };
  });
  const ok = seasons.filter((s) => s.evaluable);
  return {
    eligibleSeasons: ok.length,
    seasons,
    etc: spread(ok.map((s) => s.etcMm)),
    rain: spread(ok.map((s) => s.rainMm)),
    shortfall: spread(ok.map((s) => s.rainShortfallMm)),
    methodNote:
      "ETc = Kc x ETo per stage. ETo is FAO-56 Penman-Monteith from NASA POWER (mean-RH approximation for vapour pressure), " +
      "or Hargreaves where a day lacked an input. Shortfall = max(0, ETc - rain) and ignores runoff, stored water and irrigation.",
  };
}

export interface DailyWaterStepResult {
  endStorageMm: number;
  drainageMm: number;
  actualEtMm: number;
  unmetDemandMm: number;
  residualMm: number;
}

/**
 * A single daily soil water balance step adhering to the wetting-before-ET convention (FAO-56 / Section H1).
 * Residual = (S' - S) - (P + I - Drainage - ActualET), which is strictly conserved (0 mm).
 */
export function dailySoilWaterStep(
  initialStorageMm: number,
  capacityMm: number,
  rainMm: number,
  demandMm: number,
  irrigationMm = 0,
): DailyWaterStepResult {
  const c = Math.max(0, capacityMm);
  const s = Math.min(c, Math.max(0, initialStorageMm));
  const p = Math.max(0, rainMm) + Math.max(0, irrigationMm);
  const e = Math.max(0, demandMm);

  const drainage = Math.max(0, s + p - c);
  const accessible = s + p - drainage;
  const actualEt = Math.min(e, accessible);
  const endStorage = accessible - actualEt;
  const unmet = e - actualEt;
  const deltaS = endStorage - s;
  const residual = deltaS - (p - drainage - actualEt);

  return {
    endStorageMm: endStorage,
    drainageMm: drainage,
    actualEtMm: actualEt,
    unmetDemandMm: unmet,
    residualMm: Math.abs(residual) < 1e-9 ? 0 : residual,
  };
}

/**
 * Stripped-down bucket model testing the order of operations and rainfall timing (Section H1).
 * Q = max(0, S + P - C), B = S + P - Q, A = min(E, B), S' = B - A, U = E - A.
 */
export function timingBucketModel(
  capacityMm: number,
  initialStorageMm: number,
  demandPerDayMm: number,
  rainHistoryMm: number[],
) {
  let s = initialStorageMm;
  const endStorage: number[] = [];
  let totalDrainage = 0;
  let totalUnmet = 0;
  let totalActualEt = 0;
  const totalRain = rainHistoryMm.reduce((a, b) => a + b, 0);

  for (const p of rainHistoryMm) {
    const res = dailySoilWaterStep(s, capacityMm, p, demandPerDayMm, 0);
    endStorage.push(res.endStorageMm);
    totalDrainage += res.drainageMm;
    totalUnmet += res.unmetDemandMm;
    totalActualEt += res.actualEtMm;
    s = res.endStorageMm;
  }

  const conservationResidual = (initialStorageMm + totalRain) - (totalDrainage + totalActualEt + s);

  return {
    endStorage,
    totalDrainageMm: totalDrainage,
    totalUnmetDemandMm: totalUnmet,
    totalActualEtMm: totalActualEt,
    conservationResidualMm: Math.abs(conservationResidual) < 1e-9 ? 0 : conservationResidual,
  };
}

/**
 * Convert irrigation depth into a pumping decision (Section H2).
 * V_gross = 10 * a * D / eta, h = V_gross / q.
 */
export function pumpingDecision(input: {
  netDepthMm: number;
  areaHa: number;
  efficiency: number;
  pumpRateM3H: number;
  hoursAvailable?: number;
}): {
  grossVolumeM3: number;
  requiredPumpHours: number;
  maxNetDepthMm: number | null;
  shortfallMm: number | null;
} {
  const { netDepthMm, areaHa, efficiency, pumpRateM3H, hoursAvailable } = input;
  if (efficiency <= 0 || efficiency > 1) {
    throw new Error("Delivery efficiency must be between 0 (exclusive) and 1 (inclusive).");
  }
  if (pumpRateM3H <= 0 || areaHa <= 0) {
    throw new Error("Pump rate and area must be positive numbers.");
  }

  const grossVolumeM3 = (10 * areaHa * netDepthMm) / efficiency;
  const requiredPumpHours = grossVolumeM3 / pumpRateM3H;

  let maxNetDepthMm: number | null = null;
  let shortfallMm: number | null = null;
  if (hoursAvailable !== undefined) {
    maxNetDepthMm = (hoursAvailable * pumpRateM3H * efficiency) / (10 * areaHa);
    shortfallMm = Math.max(0, netDepthMm - maxNetDepthMm);
  }

  return {
    grossVolumeM3,
    requiredPumpHours,
    maxNetDepthMm,
    shortfallMm,
  };
}

/**
 * FAO-56 crop water stress coefficient Ks (Chapter 8).
 * Dr <= RAW => Ks = 1, else Ks = (TAW - Dr) / (TAW - RAW), bounded to [0, 1].
 */
export function fao56StressCoefficient(tawMm: number, rawMm: number, depletionMm: number): number {
  if (tawMm <= 0 || rawMm >= tawMm) return 0;
  if (depletionMm <= rawMm) return 1;
  const ks = (tawMm - depletionMm) / (tawMm - rawMm);
  return Math.max(0, Math.min(1, ks));
}

/**
 * Ponded water balance for irrigated paddy (Section 3 & B).
 * Tracks bund ponding depth, bund spill/overflow, seepage & percolation, and crop evapotranspiration.
 */
export function paddyWaterBalance(input: {
  initialPondMm: number;
  maxBundMm: number;
  rainMm: number;
  irrigationMm: number;
  etcMm: number;
  seepagePercolationMmDay: number;
}): {
  endPondMm: number;
  spillMm: number;
  actualEtMm: number;
  actualSeepagePercolationMm: number;
  residualMm: number;
} {
  const { initialPondMm, maxBundMm, rainMm, irrigationMm, etcMm, seepagePercolationMmDay } = input;
  const inflow = Math.max(0, rainMm) + Math.max(0, irrigationMm);
  const pondBeforeLosses = Math.max(0, initialPondMm) + inflow;

  const spill = Math.max(0, pondBeforeLosses - maxBundMm);
  const retainedPond = pondBeforeLosses - spill;

  const potentialLoss = Math.max(0, etcMm) + Math.max(0, seepagePercolationMmDay);
  const actualTotalLoss = Math.min(retainedPond, potentialLoss);

  // Divide actual loss proportionally between ET and SP if water is limiting
  const etFraction = potentialLoss > 0 ? Math.max(0, etcMm) / potentialLoss : 0;
  const actualEt = actualTotalLoss * etFraction;
  const actualSP = actualTotalLoss * (1 - etFraction);

  const endPond = retainedPond - actualTotalLoss;
  const deltaPond = endPond - initialPondMm;
  const residual = deltaPond - (inflow - spill - actualEt - actualSP);

  return {
    endPondMm: endPond,
    spillMm: spill,
    actualEtMm: actualEt,
    actualSeepagePercolationMm: actualSP,
    residualMm: Math.abs(residual) < 1e-9 ? 0 : residual,
  };
}

export interface RootZoneInput {
  /** mm of water the soil holds per metre of soil, from a soil test or soil map the farmer trusts. */
  awcMmPerM: number | null;
  rootDepthM: number | null;
  /** Depletion at planting, mm (0 = field capacity). Must be supplied by the farmer or an observation. */
  initialDepletionMm: number | null;
  irrigationMm: number | null;
}

export type RootZoneResult =
  | { status: "unknown"; missing: string[] }
  | { status: "ok"; tawMm: number; daysBeyondHalfTaw: number; endDepletionMm: number; assumptions: string[] };

/**
 * A simple FAO-56 style daily depletion balance for one window. It refuses to run without available
 * water capacity, root depth and an initial depletion: those are never defaulted. Runoff is not
 * modelled (rain above field capacity drains), and "half of total available water" is an analyst
 * threshold for the stress-day count, not a crop-specific depletion fraction.
 */
export function rootZoneBalance(
  input: RootZoneInput,
  window: { from: string; to: string },
  etcByDate: Map<string, number>,
  rain: Map<string, number | null>,
): RootZoneResult {
  const missing: string[] = [];
  if (input.awcMmPerM === null) missing.push("available water capacity");
  if (input.rootDepthM === null) missing.push("effective rooting depth");
  if (input.initialDepletionMm === null) missing.push("soil moisture at planting");
  if (input.irrigationMm === null) missing.push("irrigation amount (enter 0 if none)");
  if (missing.length) return { status: "unknown", missing };

  const taw = (input.awcMmPerM as number) * (input.rootDepthM as number);
  let dr = Math.min(taw, Math.max(0, input.initialDepletionMm as number));
  const days = Math.round((Date.parse(window.to) - Date.parse(window.from)) / 86_400_000) + 1;
  const irrPerDay = (input.irrigationMm as number) / Math.max(1, days);
  let beyond = 0;
  for (let t = Date.parse(window.from); t <= Date.parse(window.to); t += 86_400_000) {
    const iso = new Date(t).toISOString().slice(0, 10);
    const p = rain.get(iso) ?? 0; // a missing rain day contributes nothing here; coverage is reported elsewhere
    const etc = etcByDate.get(iso) ?? 0;
    dr = dr - p - irrPerDay + etc;
    if (dr < 0) dr = 0; // deep percolation of the excess
    if (dr > taw) dr = taw;
    if (dr > 0.5 * taw) beyond++;
  }
  return {
    status: "ok",
    tawMm: taw,
    daysBeyondHalfTaw: beyond,
    endDepletionMm: dr,
    assumptions: [
      "No runoff is modelled; rain above field capacity drains.",
      "Irrigation is spread evenly over the window.",
      "Stress days use half of total available water as an analyst threshold.",
      "No capillary rise or groundwater.",
    ],
  };
}
