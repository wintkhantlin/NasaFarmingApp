import { hargreavesEt0 } from "./et0";
import type { EngineData } from "./data";

/** Season irrigation depth assumed when the farmer has not entered one. Shared by the engine and the what-if. */
export const ASSUMED_IRRIGATION_MM = { supplemental: 150, full: 350 } as const;

export interface Scenario {
  rainPct: number;
  tempC: number;
}

export const NO_SCENARIO: Scenario = { rainPct: 0, tempC: 0 };
export const isNeutral = (s: Scenario) => s.rainPct === 0 && s.tempC === 0;

/** An even shift on every replayed day. Timing, missing days and everything else stay as they were. */
export function applyScenario(data: EngineData, s: Scenario): EngineData {
  if (isNeutral(s)) return data;
  const k = 1 + s.rainPct / 100;
  const sh = (v: number | null) => (v === null ? null : v + s.tempC);
  return {
    ...data,
    records: data.records.map((r) => {
      const tmaxC = sh(r.tmaxC);
      const tminC = sh(r.tminC);
      return {
        ...r,
        tmaxC,
        tminC,
        tmeanC: sh(r.tmeanC),
        rainMm: r.rainMm === null ? null : r.rainMm * k,
        et0Mm: tmaxC !== null && tminC !== null ? hargreavesEt0(data.latitude, r.doy, tmaxC, tminC) : r.et0Mm,
      };
    }),
    imerg: data.imerg.map((d) => (d.precipMm === null ? d : { ...d, precipMm: d.precipMm * k })),
  };
}
