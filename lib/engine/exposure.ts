import type { Crop, StageId } from "../types";
import type { DailyRecord } from "./climate";
import { MIN_VALID_SHARE } from "./rain";
import type { SeasonWindow } from "./season";

/**
 * Heat and cold exposure, stage by stage, from NASA POWER daily AIR temperature (T2M_MAX, T2M_MIN).
 * Land-surface temperature (ECOSTRESS) is a different quantity and is never used for these tests.
 * A stage without a sourced threshold gives `unknown`, not "no exposure".
 */

export interface StageExposure {
  stage: StageId;
  /** Threshold used, or null when the library has none for this stage. */
  heatThresholdC: number | null;
  coldThresholdC: number | null;
  excessRainThresholdMm: number | null;
  heatDays: number | null;
  coldDays: number | null;
  excessRainDays: number | null;
  validDays: number;
  expectedDays: number;
}

export interface SeasonExposure {
  year: number;
  evaluable: boolean;
  stages: StageExposure[];
}

export interface ExposureSummary {
  eligibleSeasons: number;
  seasons: SeasonExposure[];
  /** Advisory notice clarifying that exposures represent observational risk, not deterministic loss. */
  advisoryNotice: string;
  /** Per stage: number of eligible seasons with at least one exceedance. Null when the stage has no threshold. */
  byStage: Array<{
    stage: StageId;
    label: string;
    heatThresholdC: number | null;
    coldThresholdC: number | null;
    excessRainThresholdMm: number | null;
    seasonsWithHeat: number | null;
    seasonsWithCold: number | null;
    seasonsWithExcessRain: number | null;
    thresholdScope: string | null;
    thresholdRef: string | null;
  }>;
}

export function exposureForCrop(crop: Crop, windows: SeasonWindow[], records: DailyRecord[]): ExposureSummary {
  const byDate = new Map(records.map((r) => [r.date, r]));
  const stageDefs = crop.profile?.stages ?? [];
  const seasons: SeasonExposure[] = windows.map((w) => {
    let evaluable = true;
    const stages: StageExposure[] = w.stages.map((sw) => {
      const def = stageDefs.find((s) => s.id === sw.id);
      const heatT = def?.heatC?.value ?? null;
      const coldT = def?.coldC?.value ?? null;
      const rainT = def?.excessRainMm?.value ?? null;
      let valid = 0;
      let expected = 0;
      let heat = 0;
      let cold = 0;
      let rainExcess = 0;
      for (let t = Date.parse(sw.from); t <= Date.parse(sw.to); t += 86_400_000) {
        expected++;
        const rec = byDate.get(new Date(t).toISOString().slice(0, 10));
        if (!rec || rec.tmaxC === null || rec.tminC === null) continue;
        valid++;
        if (heatT !== null && rec.tmaxC > heatT) heat++;
        if (coldT !== null && rec.tminC < coldT) cold++;
        if (rainT !== null && rec.rainMm !== null && rec.rainMm > rainT) rainExcess++;
      }
      if (expected === 0 || valid / expected < MIN_VALID_SHARE) evaluable = false;
      return {
        stage: sw.id,
        heatThresholdC: heatT,
        coldThresholdC: coldT,
        excessRainThresholdMm: rainT,
        heatDays: heatT === null ? null : heat,
        coldDays: coldT === null ? null : cold,
        excessRainDays: rainT === null ? null : rainExcess,
        validDays: valid,
        expectedDays: expected,
      };
    });
    return { year: w.year, evaluable, stages };
  });
  const eligible = seasons.filter((s) => s.evaluable);
  const byStage = (["ini", "dev", "mid", "late"] as const).map((id) => {
    const def = stageDefs.find((s) => s.id === id);
    const heatT = def?.heatC?.value ?? null;
    const coldT = def?.coldC?.value ?? null;
    const rainT = def?.excessRainMm?.value ?? null;
    const rows = eligible.map((s) => s.stages.find((x) => x.stage === id)).filter((x): x is StageExposure => Boolean(x));
    return {
      stage: id,
      label: def?.label ?? id,
      heatThresholdC: heatT,
      coldThresholdC: coldT,
      excessRainThresholdMm: rainT,
      seasonsWithHeat: heatT === null ? null : rows.filter((r) => (r.heatDays ?? 0) > 0).length,
      seasonsWithCold: coldT === null ? null : rows.filter((r) => (r.coldDays ?? 0) > 0).length,
      seasonsWithExcessRain: rainT === null ? null : rows.filter((r) => (r.excessRainDays ?? 0) > 0).length,
      thresholdScope: def?.heatC?.scope ?? def?.coldC?.scope ?? def?.excessRainMm?.scope ?? null,
      thresholdRef: def?.heatC?.ref ?? def?.coldC?.ref ?? def?.excessRainMm?.ref ?? null,
    };
  });
  return {
    eligibleSeasons: eligible.length,
    seasons,
    advisoryNotice:
      "Stage-aware temperature and rainfall thresholds reflect documented observational risk factors (e.g. flowering heat sterility or pod fungal disease), not deterministic yield predictions or automatic unsuitability.",
    byStage,
  };
}
