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
  /** Ks applied to today's demand, evaluated on post-wetting storage. 1 when stress is switched off. */
  stressCoefficient: number;
  residualMm: number;
}

/** Depletion fraction p before stress begins: the FAO-56 default for a crop without a tabulated value. */
export const DEFAULT_DEPLETION_FRACTION = 0.5;

/**
 * Transpiration reduction coefficient Ks from the water a crop can actually reach today (Section 4.2, v3.1).
 * `accessibleMm` is storage AFTER today's rain and irrigation, B = min(C, S + P + I), because wetting happens
 * before extraction. Ks = 1 while B >= (1 - p) C, falls linearly to 0 as B -> 0. `p = null` switches stress
 * off (potential rate all the way down), which is the v3.0 behaviour and is only used to show the difference.
 */
export function postWettingKs(accessibleMm: number, capacityMm: number, p: number | null): number {
  if (p === null) return 1;
  if (!(accessibleMm > 0)) return 0;
  const threshold = (1 - Math.min(1, Math.max(0, p))) * capacityMm;
  if (threshold <= 0 || accessibleMm >= threshold) return 1;
  return accessibleMm / threshold;
}

/**
 * A single daily soil water balance step adhering to the wetting-before-ET convention (FAO-56 / Section 4.2).
 *   Q = max(0, S + P + I - C),  B = S + P + I - Q,  Ks = Ks(B),  E* = Ks ETc,  A = min(E*, B),  S' = B - A,  U = ETc - A.
 * Residual = (S' - S) - (P + I - Q - A) is conserved to the 1e-9 mm tolerance.
 */
export function dailySoilWaterStep(
  initialStorageMm: number,
  capacityMm: number,
  rainMm: number,
  demandMm: number,
  irrigationMm = 0,
  depletionFraction: number | null = DEFAULT_DEPLETION_FRACTION,
): DailyWaterStepResult {
  const c = Math.max(0, capacityMm);
  const s = Math.min(c, Math.max(0, initialStorageMm));
  const p = Math.max(0, rainMm) + Math.max(0, irrigationMm);
  const e = Math.max(0, demandMm);

  const drainage = Math.max(0, s + p - c);
  const accessible = s + p - drainage;
  const ks = postWettingKs(accessible, c, depletionFraction);
  const actualEt = Math.min(ks * e, accessible);
  const endStorage = accessible - actualEt;
  const unmet = e - actualEt;
  const deltaS = endStorage - s;
  const residual = deltaS - (p - drainage - actualEt);

  return {
    endStorageMm: endStorage,
    drainageMm: drainage,
    actualEtMm: actualEt,
    unmetDemandMm: unmet,
    stressCoefficient: ks,
    residualMm: Math.abs(residual) < 1e-9 ? 0 : residual,
  };
}

/**
 * Stripped-down bucket model testing the order of operations and rainfall timing (Section 4.2).
 * Q = max(0, S + P - C), B = S + P - Q, A = min(Ks E, B), S' = B - A, U = E - A.
 */
export function timingBucketModel(
  capacityMm: number,
  initialStorageMm: number,
  demandPerDayMm: number,
  rainHistoryMm: number[],
  depletionFraction: number | null = DEFAULT_DEPLETION_FRACTION,
) {
  let s = initialStorageMm;
  const endStorage: number[] = [];
  let totalDrainage = 0;
  let totalUnmet = 0;
  let totalActualEt = 0;
  const totalRain = rainHistoryMm.reduce((a, b) => a + b, 0);

  for (const p of rainHistoryMm) {
    const res = dailySoilWaterStep(s, capacityMm, p, demandPerDayMm, 0, depletionFraction);
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

// ---- Two-zone soil column (Section 4.2.1, v3.1) ------------------------------------------------------

/**
 * One fixed soil column of depth Zmax = max over the rotation of the crops' rooting depths, split at the
 * current root depth Zr(t) into an active root zone and a sub-root buffer. Changing crop or stage moves the
 * split, never the total, so water is conserved across a rotation instead of appearing or vanishing when
 * the rooting depth changes.
 */
export interface TwoZoneState {
  /** Water in the active root zone, mm, within [0, AWC Zr]. */
  rootMm: number;
  /** Water below the roots but inside the column, mm, within [0, AWC (Zmax - Zr)]. */
  subMm: number;
}

export interface TwoZoneColumn {
  awcMmPerM: number;
  /** Current effective rooting depth Zr, m. */
  rootDepthM: number;
  /** Fixed column depth Zmax, m. Never smaller than `rootDepthM`. */
  maxDepthM: number;
}

export const twoZoneCapacities = (c: TwoZoneColumn) => {
  const zmax = Math.max(c.maxDepthM, c.rootDepthM);
  return { rootMm: c.awcMmPerM * c.rootDepthM, subMm: c.awcMmPerM * (zmax - c.rootDepthM) };
};

export interface TwoZoneStepResult extends Omit<DailyWaterStepResult, "endStorageMm" | "drainageMm"> {
  state: TwoZoneState;
  /** Water that left the root zone downwards and entered the sub-root buffer. */
  rootDrainageMm: number;
  /** Water that left the whole column. This is the only loss besides actual ET. */
  deepDrainageMm: number;
}

/**
 * One day on the two-zone column. Gravitational drainage cascades:
 *   Q_root = max(0, S_root + P + I - C_r),  Q_deep = max(0, S_sub + Q_root - C_sub).
 * Ks and extraction use the root zone only: B = S_root + P + I - Q_root, A = min(Ks ETc, B).
 * Column conservation: (S_root' + S_sub') - (S_root + S_sub) = P + I - Q_deep - A.
 */
export function twoZoneStep(
  state: TwoZoneState,
  column: TwoZoneColumn,
  rainMm: number,
  demandMm: number,
  irrigationMm = 0,
  depletionFraction: number | null = DEFAULT_DEPLETION_FRACTION,
): TwoZoneStepResult {
  const cap = twoZoneCapacities(column);
  const sRoot = Math.min(cap.rootMm, Math.max(0, state.rootMm));
  const sSub = Math.min(cap.subMm, Math.max(0, state.subMm));
  const inflow = Math.max(0, rainMm) + Math.max(0, irrigationMm);
  const e = Math.max(0, demandMm);

  const qRoot = Math.max(0, sRoot + inflow - cap.rootMm);
  const qDeep = Math.max(0, sSub + qRoot - cap.subMm);
  const accessible = sRoot + inflow - qRoot;
  const ks = postWettingKs(accessible, cap.rootMm, depletionFraction);
  const actualEt = Math.min(ks * e, accessible);
  const next: TwoZoneState = { rootMm: accessible - actualEt, subMm: sSub + qRoot - qDeep };
  const residual = next.rootMm + next.subMm - (sRoot + sSub) - (inflow - qDeep - actualEt);

  return {
    state: next,
    rootDrainageMm: qRoot,
    deepDrainageMm: qDeep,
    actualEtMm: actualEt,
    unmetDemandMm: e - actualEt,
    stressCoefficient: ks,
    residualMm: Math.abs(residual) < 1e-9 ? 0 : residual,
  };
}

/**
 * Moves the split between root zone and sub-root buffer when the rooting depth changes from `fromZr` to `toZr`
 * (a stage or crop transition) inside a column of fixed depth `zmax`. The total never changes:
 *   deeper roots (dZ > 0): S_root+ = S_root + S_sub dZ / (Zmax - Zr),
 *   shallower roots:       S_root+ = S_root Zr' / Zr,
 *   S_sub+ = (S_root + S_sub) - S_root+.
 * Water is assumed evenly spread within each zone, so a deepening root captures its share of the buffer.
 */
export function redistributeAtRootChange(state: TwoZoneState, fromZr: number, toZr: number, zmax: number): TwoZoneState {
  const total = state.rootMm + state.subMm;
  const dz = toZr - fromZr;
  let root: number;
  if (dz > 0) {
    const room = Math.max(zmax, toZr) - fromZr;
    root = state.rootMm + (room > 0 ? state.subMm * (dz / room) : 0);
  } else {
    root = fromZr > 0 ? state.rootMm * (toZr / fromZr) : 0;
  }
  return { rootMm: root, subMm: total - root };
}

/**
 * Hand-over from bunded paddy (Section 4.3) to an upland crop. A paddy that still holds ponded water at
 * harvest leaves the profile saturated, so the upland column starts at field capacity in both zones and the
 * pond is booked as surface drainage before sowing. With no pond left, the caller keeps the state it has.
 */
export function uplandStartAfterPaddy(
  pondAtHarvestMm: number,
  column: TwoZoneColumn,
): { state: TwoZoneState; surfaceDrainageMm: number } | null {
  if (!(pondAtHarvestMm > 0)) return null;
  const cap = twoZoneCapacities(column);
  return { state: { rootMm: cap.rootMm, subMm: cap.subMm }, surfaceDrainageMm: pondAtHarvestMm };
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

/** Rice is the one crop in the library grown in a bunded, ponded field (Section 4.3). */
export const isPaddyCrop = (crop: { id: string }) => crop.id === "rice";

export interface PaddyInput {
  bundMm: number | null;
  seepagePercolationMmDay: number | null;
  irrigationMm: number | null;
  /** Pond depth at sowing, mm. Nursery or puddled fields start with water; 0 when none is known to stand. */
  initialPondMm?: number;
}

export type PaddyResult =
  | { status: "unknown"; missing: string[] }
  | {
      status: "ok";
      /** Season totals, mm. */
      actualEtMm: number;
      unmetEtMm: number;
      seepagePercolationMm: number;
      spillMm: number;
      /** Days the pond was empty at the end of the day. */
      dryPondDays: number;
      endPondMm: number;
      conservationResidualMm: number;
      assumptions: string[];
    };

/**
 * Daily ponded balance across one paddy window (Section 4.3), built on paddyWaterBalance. It refuses to run
 * without the bund height, the seepage-and-percolation rate and the irrigation amount: none is defaulted.
 */
export function paddySeasonBalance(
  input: PaddyInput,
  window: { from: string; to: string },
  etcByDate: Map<string, number>,
  rain: Map<string, number | null>,
): PaddyResult {
  const missing: string[] = [];
  if (input.bundMm === null) missing.push("bund height");
  if (input.seepagePercolationMmDay === null) missing.push("seepage and percolation rate");
  if (input.irrigationMm === null) missing.push("irrigation amount (enter 0 if none)");
  if (missing.length) return { status: "unknown", missing };
  const days = Math.round((Date.parse(window.to) - Date.parse(window.from)) / 86_400_000) + 1;
  const irrPerDay = (input.irrigationMm as number) / Math.max(1, days);
  let pond = input.initialPondMm ?? 0;
  let et = 0, unmet = 0, sp = 0, spill = 0, dry = 0, worst = 0;
  for (let t = Date.parse(window.from); t <= Date.parse(window.to); t += 86_400_000) {
    const iso = new Date(t).toISOString().slice(0, 10);
    const etc = etcByDate.get(iso) ?? 0;
    const r = paddyWaterBalance({
      initialPondMm: pond,
      maxBundMm: input.bundMm as number,
      rainMm: rain.get(iso) ?? 0,
      irrigationMm: irrPerDay,
      etcMm: etc,
      seepagePercolationMmDay: input.seepagePercolationMmDay as number,
    });
    pond = r.endPondMm;
    et += r.actualEtMm;
    unmet += Math.max(0, etc - r.actualEtMm);
    sp += r.actualSeepagePercolationMm;
    spill += r.spillMm;
    if (pond <= 1e-9) dry++;
    if (Math.abs(r.residualMm) > Math.abs(worst)) worst = r.residualMm;
  }
  return {
    status: "ok",
    actualEtMm: et,
    unmetEtMm: unmet,
    seepagePercolationMm: sp,
    spillMm: spill,
    dryPondDays: dry,
    endPondMm: pond,
    conservationResidualMm: worst,
    assumptions: [
      "Surface water only: there is no separate store for water in saturated soil, so this screens rice and does not model the paddy soil.",
      "Irrigation is spread evenly over the window.",
      "Seepage and percolation are one constant rate the farmer entered.",
    ],
  };
}

export interface RootZoneInput {
  /** mm of water the soil holds per metre of soil, from a soil test or soil map the farmer trusts. */
  awcMmPerM: number | null;
  rootDepthM: number | null;
  /**
   * Depth of the fixed soil column, m: the deepest rooting among the crops of the rotation. Omit when only
   * one rooting depth is involved; the column then ends at the roots and there is no sub-root buffer.
   */
  maxRootDepthM?: number | null;
  /** Depletion at planting, mm (0 = field capacity). Must be supplied by the farmer or an observation. */
  initialDepletionMm: number | null;
  irrigationMm: number | null;
  /** Depletion fraction p; the FAO-56 default when a crop has no tabulated value. */
  depletionFraction?: number;
}

export type RootZoneResult =
  | { status: "unknown"; missing: string[] }
  | {
      status: "ok";
      tawMm: number;
      /** Days the root zone was drier than p of its capacity at the end of the day. */
      daysBeyondHalfTaw: number;
      endDepletionMm: number;
      /** Season totals: water the crop could not get, and mean Ks over the window. */
      actualEtMm: number;
      unmetDemandMm: number;
      meanStressCoefficient: number;
      deepDrainageMm: number;
      /** Largest daily mass-balance residual; 0 within the 1e-9 mm tolerance. */
      conservationResidualMm: number;
      assumptions: string[];
    };

/**
 * A FAO-56 style daily balance for one window on the two-zone column. It refuses to run without available
 * water capacity, root depth and an initial depletion: those are never defaulted. Each day wets first, then
 * Ks (from post-wetting storage) throttles the crop's demand before extraction. Runoff is not modelled
 * (rain above field capacity drains), and p is the FAO-56 default, not a crop-specific value.
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

  const p = input.depletionFraction ?? DEFAULT_DEPLETION_FRACTION;
  const zr = input.rootDepthM as number;
  const column: TwoZoneColumn = { awcMmPerM: input.awcMmPerM as number, rootDepthM: zr, maxDepthM: Math.max(input.maxRootDepthM ?? zr, zr) };
  const cap = twoZoneCapacities(column);
  const rootStart = cap.rootMm - Math.min(cap.rootMm, Math.max(0, input.initialDepletionMm as number));
  // The buffer starts as wet, relatively, as the root zone does. It is a recorded assumption, not an observation.
  let state: TwoZoneState = { rootMm: rootStart, subMm: cap.rootMm > 0 ? cap.subMm * (rootStart / cap.rootMm) : 0 };

  const days = Math.round((Date.parse(window.to) - Date.parse(window.from)) / 86_400_000) + 1;
  const irrPerDay = (input.irrigationMm as number) / Math.max(1, days);
  let beyond = 0;
  let actualEt = 0;
  let unmet = 0;
  let deep = 0;
  let ksSum = 0;
  let n = 0;
  let worstResidual = 0;
  for (let t = Date.parse(window.from); t <= Date.parse(window.to); t += 86_400_000) {
    const iso = new Date(t).toISOString().slice(0, 10);
    const pRain = rain.get(iso) ?? 0; // a missing rain day contributes nothing here; coverage is reported elsewhere
    const etc = etcByDate.get(iso) ?? 0;
    const r = twoZoneStep(state, column, pRain, etc, irrPerDay, p);
    state = r.state;
    actualEt += r.actualEtMm;
    unmet += r.unmetDemandMm;
    deep += r.deepDrainageMm;
    ksSum += r.stressCoefficient;
    n++;
    if (Math.abs(r.residualMm) > Math.abs(worstResidual)) worstResidual = r.residualMm;
    if (cap.rootMm - state.rootMm > p * cap.rootMm) beyond++;
  }
  return {
    status: "ok",
    tawMm: cap.rootMm,
    daysBeyondHalfTaw: beyond,
    endDepletionMm: cap.rootMm - state.rootMm,
    actualEtMm: actualEt,
    unmetDemandMm: unmet,
    meanStressCoefficient: n > 0 ? ksSum / n : 1,
    deepDrainageMm: deep,
    conservationResidualMm: worstResidual,
    assumptions: [
      "No runoff is modelled; rain above field capacity drains.",
      "Irrigation is spread evenly over the window.",
      `Crop water use is throttled by the stress coefficient from soil water after wetting, with p = ${p} (FAO-56 default, not crop-specific).`,
      ...(cap.subMm > 0 ? ["Water below the roots starts as wet, in proportion, as the root zone. Drainage from the root zone refills it before anything leaves the column."] : []),
      "No capillary rise or groundwater.",
    ],
  };
}
