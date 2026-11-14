import type { Crop, RegionId, RotationSlot, Sourced } from "../types";
import type { ResolvedRegion } from "../data/regions";
import type { DailyRecord } from "./climate";
import type { EffectiveSoil } from "./data";
import type { SeasonWindow } from "./season";
import { MIN_VALID_SHARE } from "./rain";

/**
 * Crop suitability. Each check is one of: preferred, tolerated, outside, unknown.
 * "Unknown" is a real answer: a missing decisive input never passes. ECOCROP's annual rainfall range
 * is broad ecology and is deliberately not compared with a single season's rain (see water.ts).
 */

export type FitLevel = "preferred" | "tolerated" | "outside" | "unknown";

export interface FitCheck {
  id: "temperature" | "sowing-window" | "ph" | "texture" | "drainage" | "salinity";
  label: string;
  level: FitLevel;
  /** A decisive check decides the overall result when unknown. */
  decisive: boolean;
  detail: string;
  /** Where the rule and the input came from. */
  ruleSource: Pick<Sourced<unknown>, "ref" | "scope"> | null;
  inputSource: string | null;
}

export interface Suitability {
  cropId: string;
  overall: FitLevel;
  checks: FitCheck[];
  /** Short reasons the overall result is not "preferred" or "tolerated". */
  blockers: string[];
}

const mmdd = (iso: string) => iso.slice(5);

/** Is `d` (MM-DD) inside a window that may cross the new year? */
export function inMonthDayWindow(d: string, from: string, to: string): boolean {
  return from <= to ? d >= from && d <= to : d >= from || d <= to;
}

export function meanTemperature(records: DailyRecord[], windows: SeasonWindow[]): { meanC: number | null; seasons: number } {
  const byDate = new Map(records.map((r) => [r.date, r]));
  const means: number[] = [];
  for (const w of windows) {
    let sum = 0;
    let n = 0;
    let expected = 0;
    for (let t = Date.parse(w.from); t <= Date.parse(w.to); t += 86_400_000) {
      expected++;
      const rec = byDate.get(new Date(t).toISOString().slice(0, 10));
      if (rec?.tmeanC != null) {
        sum += rec.tmeanC;
        n++;
      }
    }
    if (expected > 0 && n / expected >= MIN_VALID_SHARE) means.push(sum / n);
  }
  return { meanC: means.length ? means.reduce((a, b) => a + b, 0) / means.length : null, seasons: means.length };
}

function rangeFit(v: number, opt: [number, number], abs: [number, number]): FitLevel {
  if (v >= opt[0] && v <= opt[1]) return "preferred";
  if (v >= abs[0] && v <= abs[1]) return "tolerated";
  return "outside";
}

const order: Record<FitLevel, number> = { preferred: 0, tolerated: 1, unknown: 2, outside: 3 };

export function assessSuitability(input: {
  crop: Crop;
  region: ResolvedRegion;
  slot: Pick<RotationSlot, "plantDate" | "harvestDate">;
  windows: SeasonWindow[];
  records: DailyRecord[];
  soil: EffectiveSoil;
}): Suitability {
  const { crop, region, slot, windows, records, soil } = input;
  const p = crop.profile;
  const checks: FitCheck[] = [];

  // Temperature: the mean air temperature of the crop window, compared with the ECOCROP range.
  const temp = meanTemperature(records, windows);
  if (p && temp.meanC !== null) {
    const level = rangeFit(temp.meanC, [p.tempC.optMin.value, p.tempC.optMax.value], [p.tempC.absMin.value, p.tempC.absMax.value]);
    checks.push({
      id: "temperature",
      label: "Air temperature in the crop window",
      level,
      decisive: true,
      detail: `Mean ${temp.meanC.toFixed(1)} °C over ${temp.seasons} seasons; preferred ${p.tempC.optMin.value} to ${p.tempC.optMax.value} °C, tolerated ${p.tempC.absMin.value} to ${p.tempC.absMax.value} °C.`,
      ruleSource: p.tempC.optMin,
      inputSource: "NASA POWER daily air temperature",
    });
  } else {
    checks.push({
      id: "temperature",
      label: "Air temperature in the crop window",
      level: "unknown",
      decisive: true,
      detail: p ? "No complete seasons of temperature data." : "No sourced temperature range for this crop.",
      ruleSource: p ? p.tempC.optMin : null,
      inputSource: null,
    });
  }

  // Sowing window: the planned date against the regional calendar.
  const cal = p && region !== "unsupported" ? p.regionalCalendars[region as RegionId] : undefined;
  if (cal) {
    const inside = inMonthDayWindow(mmdd(slot.plantDate), cal.sowWindow[0], cal.sowWindow[1]);
    checks.push({
      id: "sowing-window",
      label: "Sowing date",
      level: inside ? "preferred" : "outside",
      decisive: true,
      detail: inside
        ? `Sowing on ${mmdd(slot.plantDate)} is inside the usual ${cal.sowWindow[0]} to ${cal.sowWindow[1]} window.`
        : `Sowing on ${mmdd(slot.plantDate)} is outside the usual ${cal.sowWindow[0]} to ${cal.sowWindow[1]} window.`,
      ruleSource: { ref: cal.ref, scope: cal.scope },
      inputSource: "Your rotation dates",
    });
  } else {
    checks.push({
      id: "sowing-window",
      label: "Sowing date",
      level: "unknown",
      decisive: true,
      detail: "No usual sowing window is recorded for this crop in this region.",
      ruleSource: null,
      inputSource: null,
    });
  }

  // pH
  if (p && soil.ph) {
    checks.push({
      id: "ph",
      label: "Soil pH",
      level: rangeFit(soil.ph.value, [p.ph.optMin.value, p.ph.optMax.value], [p.ph.absMin.value, p.ph.absMax.value]),
      decisive: true,
      detail: `pH ${soil.ph.value.toFixed(1)} (${soil.ph.note}); preferred ${p.ph.optMin.value} to ${p.ph.optMax.value}, tolerated ${p.ph.absMin.value} to ${p.ph.absMax.value}.`,
      ruleSource: p.ph.optMin,
      inputSource: soil.ph.from === "farmer" ? "Your soil value" : "ISRIC SoilGrids (not a soil test)",
    });
  } else {
    checks.push({
      id: "ph",
      label: "Soil pH",
      level: "unknown",
      decisive: true,
      detail: "No pH value for this field. A soil test would settle it.",
      ruleSource: p ? p.ph.optMin : null,
      inputSource: null,
    });
  }

  // Texture (supporting)
  if (soil.texture) {
    const ok = crop.soil.textures.includes(soil.texture.value);
    checks.push({
      id: "texture",
      label: "Soil texture",
      level: ok ? "preferred" : "tolerated",
      decisive: false,
      detail: ok ? `${soil.texture.value} is a listed texture for this crop.` : `${soil.texture.value} is not in this crop's listed textures; check drainage and water holding.`,
      ruleSource: { ref: crop.sources[0]?.ref ?? "Crop library", scope: "analyst-assumption" },
      inputSource: soil.texture.from === "farmer" ? "Your soil value" : "ISRIC SoilGrids (not a soil test)",
    });
  } else {
    checks.push({ id: "texture", label: "Soil texture", level: "unknown", decisive: false, detail: "No texture value for this field.", ruleSource: null, inputSource: null });
  }

  // Drainage and salinity need an observation; neither comes from the soil map we use.
  if (soil.drainage) {
    const ok = crop.soil.drainage.some((d) => soil.drainage?.value.toLowerCase().includes(d));
    checks.push({
      id: "drainage",
      label: "Drainage",
      level: ok ? "preferred" : "tolerated",
      decisive: false,
      detail: ok ? `${soil.drainage.value} drainage matches this crop.` : `${soil.drainage.value} drainage is not the crop's usual match; watch for waterlogging or drought.`,
      ruleSource: { ref: crop.sources[0]?.ref ?? "Crop library", scope: "analyst-assumption" },
      inputSource: "Your soil value",
    });
  } else {
    checks.push({ id: "drainage", label: "Drainage", level: "unknown", decisive: false, detail: "Drainage has not been recorded.", ruleSource: null, inputSource: null });
  }
  if (soil.salinityDsM) {
    const tol = crop.soil.salinityTolerance;
    const limit = tol >= 4 ? 8 : tol === 3 ? 6 : tol === 2 ? 4 : 2;
    checks.push({
      id: "salinity",
      label: "Salinity",
      level: soil.salinityDsM.value <= limit ? "preferred" : "outside",
      decisive: false,
      detail: `${soil.salinityDsM.value} dS/m against a rough limit of ${limit} dS/m for this crop's tolerance class.`,
      ruleSource: { ref: "Salinity limit derived from the library's 1 to 5 tolerance class", scope: "analyst-assumption" },
      inputSource: "Your soil value",
    });
  } else {
    checks.push({ id: "salinity", label: "Salinity", level: "unknown", decisive: false, detail: "Salinity has not been recorded.", ruleSource: null, inputSource: null });
  }

  const blockers: string[] = [];
  for (const c of checks) {
    if (c.level === "outside") blockers.push(c.detail);
    else if (c.level === "unknown" && c.decisive) blockers.push(`${c.label}: not known yet. ${c.detail}`);
  }
  const decisive = checks.filter((c) => c.decisive);
  let overall: FitLevel;
  if (checks.some((c) => c.level === "outside" && c.decisive)) overall = "outside";
  else if (decisive.some((c) => c.level === "unknown")) overall = "unknown";
  else overall = checks.filter((c) => c.level !== "unknown").reduce<FitLevel>((worst, c) => (order[c.level] > order[worst] ? c.level : worst), "preferred");
  return { cropId: crop.id, overall, checks, blockers };
}
