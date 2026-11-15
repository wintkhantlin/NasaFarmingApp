import { getCropById, getRealWorldCropEconomics } from "../data/crops";
import type { CropEconomics, Rotation } from "../types";

/**
 * Economic comparison from local ranges the farmer (or a cited local source) entered.
 * Supports water-sensitive yield scenarios (Prompt 5, E-01), cost partitioning (fixed vs variable),
 * and break-even analysis without fabricated precision.
 */

export interface SlotMargin {
  slotId: string;
  cropId: string | null;
  name: string;
  /** MMK per hectare, as a range. Null when any of yield, price or cost is missing. */
  marginMmkHa: [number, number] | null;
  missing: string[];
  source: string | null;
}

export interface EconomicsAssessment {
  slots: SlotMargin[];
  /** Whole-cycle margin per hectare, only when every crop slot is known. */
  cycleMarginMmkHa: [number, number] | null;
  areaHa: number | null;
  cycleMarginMmk: [number, number] | null;
  unknownSlots: number;
  /** Annualized margin per ha over the whole repeating cycle: margin * 365.2425 / occupiedCycleDays. */
  annualizedMarginMmkHa?: [number, number] | null;
  occupiedCycleDays?: number;
}

/**
 * Sourced FAO-33 / FAO-66 crop yield response factors (Ky) for water deficit.
 * Only documented crops with calibrated full-season response factors are listed.
 * Crops without calibrated species Ky (e.g. black gram, green gram) are omitted so
 * yield response is reported as UNQUANTIFIED rather than guessing an uncalibrated number.
 */
export const FAO_CROP_WATER_RESPONSE_KY: Record<string, { ky: number; ref: string }> = {
  rice: { ky: 1.0, ref: "FAO Irrigation and Drainage Paper 33 (Doorenbos & Kassam 1979) Table 24" },
  maize: { ky: 1.25, ref: "FAO Irrigation and Drainage Paper 33 & FAO 66 (Steduto et al. 2012)" },
  soybean: { ky: 0.85, ref: "FAO Irrigation and Drainage Paper 33 Table 24" },
  groundnut: { ky: 0.70, ref: "FAO Irrigation and Drainage Paper 33 Table 24" },
  sunflower: { ky: 0.95, ref: "FAO Irrigation and Drainage Paper 33 Table 24" },
  "pigeon-pea": { ky: 0.85, ref: "FAO Irrigation and Drainage Paper 33 (grain legume proxy)" },
  chickpea: { ky: 0.85, ref: "FAO Irrigation and Drainage Paper 33 Table 24" },
};

export interface WaterYieldResponse {
  status: "quantified" | "unquantified";
  phi: number; // Yield adjustment factor [0, 1]
  ky: number | null;
  kySource: string | null;
  etaSumMm: number | null;
  etmSumMm: number | null;
  deficitFraction: number | null; // 1 - sum(ETa)/sum(ETm)
  adjustedYieldKgHa?: [number, number];
  unquantifiedReason?: string;
  notes: string[];
}

/**
 * Calculates water-limited yield response via FAO-33 / FAO-66:
 *   phi = clamp(1 - Ky * (1 - ETa / ETm), 0, 1)
 *   Y_adj = Y_base * phi
 *
 * Strict rules (Prompt 5, E-01):
 * 1. Requires sourced, species-calibrated Ky. If absent, marks UNQUANTIFIED (does NOT invent Ky=1.15).
 * 2. If water stress is already included in baseline empirical yield, suppresses secondary discount.
 * 3. ETa and ETm must refer to the same crop and time window.
 */
export function evaluateWaterYieldResponse(input: {
  cropId: string;
  baseYieldKgHa: [number, number];
  etaSumMm: number | null;
  etmSumMm: number | null;
  isWaterStressInBase?: boolean;
}): WaterYieldResponse {
  const { cropId, baseYieldKgHa, etaSumMm, etmSumMm, isWaterStressInBase } = input;

  if (isWaterStressInBase) {
    return {
      status: "unquantified",
      phi: 1.0,
      ky: null,
      kySource: null,
      etaSumMm,
      etmSumMm,
      deficitFraction: null,
      adjustedYieldKgHa: baseYieldKgHa,
      unquantifiedReason: "Base yield already reflects rainfed / ambient water conditions. Secondary water-deficit penalty suppressed to prevent double-counting.",
      notes: ["Yield baseline is an empirical rainfed observation; no secondary ET penalty applied."],
    };
  }

  if (etaSumMm == null || etmSumMm == null || !(etmSumMm > 0)) {
    return {
      status: "unquantified",
      phi: 1.0,
      ky: null,
      kySource: null,
      etaSumMm,
      etmSumMm,
      deficitFraction: null,
      adjustedYieldKgHa: baseYieldKgHa,
      unquantifiedReason: "Crop actual evapotranspiration (ETa) or potential demand (ETm) is incomplete or unavailable.",
      notes: ["Water-limited yield cannot be quantified without complete ETa and ETm series."],
    };
  }

  const kyEntry = FAO_CROP_WATER_RESPONSE_KY[cropId];
  if (!kyEntry) {
    return {
      status: "unquantified",
      phi: 1.0,
      ky: null,
      kySource: null,
      etaSumMm,
      etmSumMm,
      deficitFraction: Number(Math.max(0, 1 - etaSumMm / etmSumMm).toFixed(3)),
      adjustedYieldKgHa: baseYieldKgHa,
      unquantifiedReason: `Crop '${cropId}' lacks a standardized, species-calibrated FAO Ky water response factor. Water deficit is tracked as a physical risk rather than an invented yield penalty.`,
      notes: ["Showing water stress as an observational risk indicator; uncalibrated yield discount omitted."],
    };
  }

  const deficit = Math.max(0, Math.min(1, 1 - etaSumMm / etmSumMm));
  const rawPhi = 1 - kyEntry.ky * deficit;
  const phi = Math.max(0, Math.min(1, rawPhi));
  const adjustedYield: [number, number] = [
    Math.round(baseYieldKgHa[0] * phi),
    Math.round(baseYieldKgHa[1] * phi),
  ];

  return {
    status: "quantified",
    phi: Number(phi.toFixed(3)),
    ky: kyEntry.ky,
    kySource: kyEntry.ref,
    etaSumMm: Number(etaSumMm.toFixed(1)),
    etmSumMm: Number(etmSumMm.toFixed(1)),
    deficitFraction: Number(deficit.toFixed(3)),
    adjustedYieldKgHa: adjustedYield,
    notes: [
      `Water stress response calculated via FAO-33 (Ky = ${kyEntry.ky}): relative yield factor phi = ${phi.toFixed(2)}.`,
      `Adjusted yield: ${adjustedYield[0]}–${adjustedYield[1]} kg/ha (from base ${baseYieldKgHa[0]}–${baseYieldKgHa[1]} kg/ha).`,
    ],
  };
}

export interface BreakEvenResult {
  breakEvenYieldKgHa: number | null;
  viable: boolean;
  netUnitMarginMmkKg: number;
  note: string;
}

/**
 * Break-even yield calculation: FixedAndOtherCosts / (PricePerKg - VariableCostPerKg).
 * Defined ONLY when (Price - VariableCost) > 0.
 * If commodity price is less than or equal to variable harvest/handling costs, returns null and viable: false.
 * NEVER replaces denominator with max(1, ...).
 */
export function calculateBreakEvenYield(
  fixedCostsMmkHa: number,
  priceMmkPerKg: number,
  variableCostMmkPerKg = 0,
): BreakEvenResult {
  const netUnitMargin = priceMmkPerKg - variableCostMmkPerKg;
  if (netUnitMargin <= 0) {
    return {
      breakEvenYieldKgHa: null,
      viable: false,
      netUnitMarginMmkKg: netUnitMargin,
      note: "Not economically viable at these prices: variable harvest and transport cost per kg meets or exceeds sale price.",
    };
  }

  const bep = fixedCostsMmkHa / netUnitMargin;
  return {
    breakEvenYieldKgHa: Math.round(bep),
    viable: true,
    netUnitMarginMmkKg: netUnitMargin,
    note: `Break-even yield is ${Math.round(bep)} kg/ha at net unit price of ${Math.round(netUnitMargin)} MMK/kg.`,
  };
}

export interface CostPartition {
  /** Pre-harvest committed costs (land prep, seed, base fertilizer, sowing labor, herbicide), MMK/ha. */
  fixedMmkHa: number;
  /** Variable harvest, threshing, bagging and transport costs, MMK/kg. */
  variableMmkPerKg: number;
  /** Irrigation pumping fuel / electricity if modeled, MMK/ha. */
  irrigationMmkHa?: number;
}

export interface ScenarioGrossMargin {
  illustrativeEstimate: true;
  yieldKgHa: [number, number];
  grossRevenueMmkHa: [number, number];
  fixedCostsMmkHa: number;
  variableCostsMmkHa: [number, number];
  irrigationCostsMmkHa: number;
  committedCashAtRiskMmkHa: number;
  grossMarginMmkHa: [number, number];
  breakEvenYieldKgHa: number | null;
  viable: boolean;
  notes: string[];
}

/**
 * Evaluates consistent gross margin scenario envelope:
 *   Margin_j = Y_j * (Price_j - VariableCostPerKg) - FixedCost - IrrigationCost
 * Cash-at-risk is strictly the committed pre-harvest expenditure, NOT a verified maximum loss.
 */
export function calculateScenarioGrossMargin(input: {
  yieldKgHa: [number, number];
  priceMmkPerKg: [number, number];
  costPartition: CostPartition;
  irrigationCostMmkHa?: number;
}): ScenarioGrossMargin {
  const [yMin, yMax] = input.yieldKgHa;
  const [pMin, pMax] = input.priceMmkPerKg;
  const fixed = input.costPartition.fixedMmkHa;
  const vKg = input.costPartition.variableMmkPerKg;
  const irr = input.irrigationCostMmkHa ?? input.costPartition.irrigationMmkHa ?? 0;

  const committedCashAtRisk = fixed + irr;

  // Envelope bounds
  const revMin = yMin * pMin;
  const revMax = yMax * pMax;

  const varCostMin = yMin * vKg;
  const varCostMax = yMax * vKg;

  const marginMin = yMin * (pMin - vKg) - fixed - irr;
  const marginMax = yMax * (pMax - vKg) - fixed - irr;

  // Midpoint price for break-even
  const pMid = (pMin + pMax) / 2;
  const bep = calculateBreakEvenYield(fixed + irr, pMid, vKg);

  return {
    illustrativeEstimate: true,
    yieldKgHa: [yMin, yMax],
    grossRevenueMmkHa: [Math.round(revMin), Math.round(revMax)],
    fixedCostsMmkHa: Math.round(fixed),
    variableCostsMmkHa: [Math.round(varCostMin), Math.round(varCostMax)],
    irrigationCostsMmkHa: Math.round(irr),
    committedCashAtRiskMmkHa: Math.round(committedCashAtRisk),
    grossMarginMmkHa: [Math.round(marginMin), Math.round(marginMax)],
    breakEvenYieldKgHa: bep.breakEvenYieldKgHa,
    viable: bep.viable,
    notes: [
      "Illustrative gross margin estimate before family labor, equipment depreciation, and land rent unless entered.",
      `Committed cash-at-risk: ${Math.round(committedCashAtRisk).toLocaleString()} MMK/ha (pre-harvest establishment + irrigation).`,
      bep.note,
    ],
  };
}

/**
 * Annualize a whole-cycle margin: margin * 365.2425 / cycle days. The cycle runs from the first planting to the
 * next planting of the first crop, so fallow and idle days between crops are INCLUDED; dividing by the days a
 * crop was in the field would credit the farmer with income for idle land. The name `occupiedCycleDays` is
 * historical: the field is "occupied" by the rotation for the whole cycle.
 * Using exact days prevents whole-year integer rounding discontinuities (e.g. 547 days vs 548 days).
 */
export function annualizeMargin(
  marginMmkHa: [number, number] | null,
  occupiedCycleDays: number,
): [number, number] | null {
  if (!marginMmkHa || occupiedCycleDays <= 0) return null;
  const factor = 365.2425 / occupiedCycleDays;
  return [marginMmkHa[0] * factor, marginMmkHa[1] * factor];
}

/**
 * Break-even price calculation: variable costs / saleable yield.
 * Defined only for positive yield.
 */
export function breakEvenPrice(costMmkPerHa: number, yieldKgHa: number): number | null {
  if (yieldKgHa <= 0) return null;
  return costMmkPerHa / yieldKgHa;
}

export function economicsFor(
  rotation: Pick<Rotation, "slots" | "cycleYears"> & { cycleDays?: number },
  economics: CropEconomics[] | undefined,
  areaHa: number | null,
  opts?: { fallbackToRealWorld?: boolean },
): EconomicsAssessment {
  const slots: SlotMargin[] = rotation.slots
    .filter((s) => s.kind !== "fallow")
    .map((s) => {
      const crop = s.cropId ? getCropById(s.cropId) : undefined;
      let e = economics?.find((x) => x.cropId === s.cropId);
      if (!e && opts?.fallbackToRealWorld && s.cropId) {
        e = getRealWorldCropEconomics(s.cropId);
      }
      const missing: string[] = [];
      if (!e?.yieldKgHa) missing.push("yield range");
      if (!e?.priceMmkPerKg) missing.push("price range");
      if (!e?.costMmkPerHa) missing.push("cost range");
      const margin: [number, number] | null =
        e?.yieldKgHa && e.priceMmkPerKg && e.costMmkPerHa
          ? [e.yieldKgHa[0] * e.priceMmkPerKg[0] - e.costMmkPerHa[1], e.yieldKgHa[1] * e.priceMmkPerKg[1] - e.costMmkPerHa[0]]
          : null;
      return { slotId: s.id, cropId: s.cropId ?? null, name: crop?.names.common ?? "Crop", marginMmkHa: margin, missing, source: e?.source ?? null };
    });
  const known = slots.filter((s) => s.marginMmkHa);
  const cycle: [number, number] | null =
    slots.length > 0 && known.length === slots.length
      ? [known.reduce((a, s) => a + (s.marginMmkHa as [number, number])[0], 0), known.reduce((a, s) => a + (s.marginMmkHa as [number, number])[1], 0)]
      : null;

  const occupiedCycleDays = rotation.cycleDays ?? rotation.cycleYears * 365;
  const annualized = annualizeMargin(cycle, occupiedCycleDays);

  return {
    slots,
    cycleMarginMmkHa: cycle,
    areaHa,
    cycleMarginMmk: cycle && areaHa ? [cycle[0] * areaHa, cycle[1] * areaHa] : null,
    unknownSlots: slots.length - known.length,
    annualizedMarginMmkHa: annualized,
    occupiedCycleDays,
  };
}

/**
 * The usual rotation in each region, used as a fixed reference point for the income score. Scoring income
 * against a fixed benchmark, rather than against whichever options happen to be compared, means adding or
 * removing an option never changes another option's income score.
 */
export const REGIONAL_INCOME_BENCHMARK: Record<"ayeyarwady" | "magway" | "shan", { crops: string[]; label: string }> = {
  ayeyarwady: { crops: ["rice", "black-gram"], label: "monsoon rice then black gram" },
  magway: { crops: ["sesame", "green-gram"], label: "sesame then green gram" },
  shan: { crops: ["maize", "soybean"], label: "maize then soybean" },
};

export interface IncomeAnchor {
  /** MMK per ha per year that earns full credit: the benchmark rotation's midpoint margin. */
  target: number;
  /** Break-even. A loss scores zero. */
  limit: 0;
  scope: "analyst-assumption";
  ref: string;
}

/**
 * Income anchor for a region: 0 at break-even, full credit at the midpoint margin of the region's usual rotation,
 * computed from the benchmark price, yield and cost table (not the farmer's own numbers, so it stays fixed).
 * Null when the region has no benchmark or the table lacks a crop.
 */
export function incomeAnchorFor(region: string): IncomeAnchor | null {
  const bench = REGIONAL_INCOME_BENCHMARK[region as keyof typeof REGIONAL_INCOME_BENCHMARK];
  if (!bench) return null;
  const slots = bench.crops.map((cropId, i) => ({ id: `bench-${i}`, kind: "crop" as const, cropId, plantDate: "2026-01-01", harvestDate: "2026-01-02", dateConfidence: "typical" as const, irrigated: false }));
  const e = economicsFor({ slots, cycleYears: 1 }, undefined, null, { fallbackToRealWorld: true });
  const m = e.annualizedMarginMmkHa;
  if (!m) return null;
  const target = Math.round((m[0] + m[1]) / 2);
  if (target <= 0) return null;
  return {
    target,
    limit: 0,
    scope: "analyst-assumption",
    ref: `Full credit at the midpoint margin of the usual ${bench.label} rotation (${target.toLocaleString("en-US")} MMK/ha/yr from the benchmark price, yield and cost table); zero at break-even. Options above the benchmark all score full credit, and their margins are still shown side by side.`,
  };
}
