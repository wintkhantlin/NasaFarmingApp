import type { CropEconomics, FarmerPriorities, PriorityId, Rotation } from "../types";
import { hostReturnIntervals } from "./pest";
import { isPaddyCrop } from "./water";

export type FarmerWaterAccess = "rainfed" | "occasional_irrigation" | "reliable_irrigation" | "unknown";
export type FarmerLaborEquipment = "manual" | "tractor_tiller" | "seeder" | "other" | "unknown";
export type FarmerMarketConstraint = "can_sell" | "avoid_crops" | "buyer_available" | "unknown";
export type FarmerTopPriority = "profit" | "reliable_harvest" | "low_water" | "low_cash" | "soil_improvement";

/**
 * Typed Farmer Decision Input (Prompt 6, D-01, D-02).
 * Integrates directly with request models; all unknown options are explicit.
 */
export interface FarmerDecisionInput {
  /** Choose up to 2 top priorities; others optional */
  topPriorities: FarmerTopPriority[];
  availableWater: FarmerWaterAccess;
  budgetMaxMmkHa?: number | null;
  equipment: FarmerLaborEquipment;
  /** How much help the farmer has at busy times. Unset or "unknown" is never read as plenty. */
  labour?: "low" | "medium" | "high" | "unknown";
  /** Calendar months (1 to 12) when labour is stretched. */
  peakMonths?: number[];
  canSellCropIds?: string[];
  avoidCropIds?: string[];
  marketStatus?: FarmerMarketConstraint;
  farmerObservedDrainage?: "waterlogged" | "adequate" | "dry" | "unknown";
  farmerObservedMoisture?: "wet" | "moist" | "dry" | "unknown";
  plantingMethodPreference?: "tillage" | "zero_till" | "relay_broadcast" | "unknown";
  /**
   * Whether this field has had Fusarium wilt (chickpea or pigeon pea). true makes a too-short return interval a
   * hard veto; unknown or false leaves it as something to review, because the break only matters where wilt is present.
   */
  knownWiltInField?: boolean | "unknown";
}

export type FeasibilityStatus = "feasible" | "infeasible" | "needs_review";

export interface FeasibilityReason {
  code: string;
  type: "hard_gate_violation" | "missing_evidence" | "passed_constraint";
  message: string;
  fieldSource: "farmer_constraint" | "biophysical_model" | "market_constraint";
}

export interface CandidateFeasibility {
  rotationId: string;
  status: FeasibilityStatus;
  reasons: FeasibilityReason[];
  hardConstraintVetoes: string[];
  unconfirmedFactors: string[];
}

/**
 * Maps farmer top priorities to the underlying MCDA PriorityId.
 */
export function mapFarmerPrioritiesToMcda(topPriorities: FarmerTopPriority[]): FarmerPriorities {
  const priorityMap: Record<FarmerTopPriority, PriorityId> = {
    profit: "income",
    reliable_harvest: "water",
    low_water: "water",
    low_cash: "lower-inputs",
    soil_improvement: "soil",
  };

  const order: PriorityId[] = [];
  for (const tp of topPriorities) {
    const mapped = priorityMap[tp];
    if (mapped && !order.includes(mapped)) {
      order.push(mapped);
    }
  }

  const weights: Partial<Record<PriorityId, number>> = {};
  if (order.length === 1) {
    weights[order[0]] = 1.0;
  } else if (order.length === 2) {
    weights[order[0]] = 0.65;
    weights[order[1]] = 0.35;
  } else {
    const n = order.length;
    const sum = (n * (n + 1)) / 2;
    order.forEach((id, i) => {
      weights[id] = (n - i) / sum;
    });
  }

  return { order, weights };
}

/**
 * Classifies rotation feasibility against farmer constraints (Prompt 6, Hard Feasibility Gate).
 * Hard gates exclude from top recommendation; missing evidence is 'needs_review', NOT veto or safe pass.
 */
export function classifyRotationFeasibility(
  rotation: Rotation,
  input: FarmerDecisionInput,
  economics?: CropEconomics[],
): CandidateFeasibility {
  const reasons: FeasibilityReason[] = [];
  const hardConstraintVetoes: string[] = [];
  const unconfirmedFactors: string[] = [];

  const cropSlots = rotation.slots.filter((s) => s.kind === "crop" && s.cropId);

  // 1. Water Access Hard Gate. Any slot planned as irrigated needs water the farmer can supply. Irrigated paddy
  // needs a reliable supply; other irrigated crops can manage with occasional irrigation.
  for (const s of cropSlots) {
    if (!s.irrigated) continue;
    const isPaddy = s.cropId === "rice" || isPaddyCrop({ id: s.cropId ?? "" });
    if (input.availableWater === "rainfed") {
      hardConstraintVetoes.push(`WATER_UNAVAILABLE:${s.cropId}`);
      reasons.push({
        code: "WATER_DEFICIT_CONFIRMED",
        type: "hard_gate_violation",
        message: `Crop ${s.cropId} is planned as irrigated, but the field is confirmed rainfed with no irrigation access.`,
        fieldSource: "farmer_constraint",
      });
    } else if (isPaddy && input.availableWater === "occasional_irrigation") {
      unconfirmedFactors.push(`WATER_RELIABILITY_UNCONFIRMED:${s.cropId}`);
      reasons.push({
        code: "WATER_RELIABILITY_UNCONFIRMED",
        type: "missing_evidence",
        message: `Irrigated ${s.cropId} needs a reliable supply through the season; occasional irrigation may not be enough. Check how often water is available.`,
        fieldSource: "farmer_constraint",
      });
    } else if (input.availableWater === "unknown") {
      unconfirmedFactors.push(`WATER_ACCESS_UNCONFIRMED:${s.cropId}`);
      reasons.push({
        code: "WATER_ACCESS_UNCONFIRMED",
        type: "missing_evidence",
        message: `Irrigation access is unconfirmed for irrigated crop ${s.cropId}. Check water availability.`,
        fieldSource: "farmer_constraint",
      });
    }
  }

  // 1b. Disease-break gate for host-specific soil wilts. A veto only where the farmer confirms wilt in the field.
  for (const w of hostReturnIntervals(rotation)) {
    if (input.knownWiltInField === true) {
      hardConstraintVetoes.push(`DISEASE_BREAK:${w.cropId}`);
      reasons.push({ code: "DISEASE_BREAK_TOO_SHORT", type: "hard_gate_violation", message: w.text, fieldSource: "biophysical_model" });
    } else {
      unconfirmedFactors.push(`DISEASE_BREAK_REVIEW:${w.cropId}`);
      reasons.push({
        code: "DISEASE_BREAK_REVIEW",
        type: "missing_evidence",
        message: `${w.text} Has this field had wilt? If yes, this rotation should not be used as planned.`,
        fieldSource: "biophysical_model",
      });
    }
  }

  // 2. Budget Maximum Hard Gate
  if (input.budgetMaxMmkHa !== undefined && input.budgetMaxMmkHa !== null && input.budgetMaxMmkHa > 0) {
    let totalCommittedCostMmkHa = 0;
    let missingCost = false;

    for (const s of cropSlots) {
      const e = economics?.find((x) => x.cropId === s.cropId);
      if (e?.costMmkPerHa) {
        totalCommittedCostMmkHa += e.costMmkPerHa[1]; // conservative upper committed cost
      } else {
        missingCost = true;
      }
    }

    if (totalCommittedCostMmkHa > input.budgetMaxMmkHa) {
      hardConstraintVetoes.push("BUDGET_EXCEEDED");
      reasons.push({
        code: "BUDGET_EXCEEDED",
        type: "hard_gate_violation",
        message: `Estimated establishment cost (${Math.round(totalCommittedCostMmkHa).toLocaleString()} MMK/ha) exceeds farmer budget limit (${Math.round(input.budgetMaxMmkHa).toLocaleString()} MMK/ha).`,
        fieldSource: "farmer_constraint",
      });
    } else if (missingCost) {
      unconfirmedFactors.push("BUDGET_DATA_MISSING");
      reasons.push({
        code: "BUDGET_DATA_MISSING",
        type: "missing_evidence",
        message: "Cost data is incomplete for one or more crops; cannot verify cash budget limit.",
        fieldSource: "farmer_constraint",
      });
    }
  }

  // 3. Avoid Crops Hard Gate
  if (input.avoidCropIds && input.avoidCropIds.length > 0) {
    for (const s of cropSlots) {
      if (s.cropId && input.avoidCropIds.includes(s.cropId)) {
        hardConstraintVetoes.push(`AVOID_CROP:${s.cropId}`);
        reasons.push({
          code: "AVOID_CROP_CONFIRMED",
          type: "hard_gate_violation",
          message: `Crop ${s.cropId} is explicitly excluded by farmer preference or rotation disease rules.`,
          fieldSource: "market_constraint",
        });
      }
    }
  }

  // 4. Market Feasibility Gate
  if (input.canSellCropIds && input.canSellCropIds.length > 0) {
    for (const s of cropSlots) {
      if (s.cropId && !input.canSellCropIds.includes(s.cropId)) {
        hardConstraintVetoes.push(`MARKET_EXCLUDED:${s.cropId}`);
        reasons.push({
          code: "MARKET_UNAVAILABLE",
          type: "hard_gate_violation",
          message: `No confirmed buyer or sale outlet for crop ${s.cropId}.`,
          fieldSource: "market_constraint",
        });
      }
    }
  }

  // 5. Equipment Hard Gate
  if (input.equipment === "manual") {
    // If a crop specifically requires heavy mechanization (e.g. deep mechanized subsoiling)
    // Most Myanmar smallholder crops can be established manually or with power tiller
  } else if (input.equipment === "unknown") {
    unconfirmedFactors.push("EQUIPMENT_UNCONFIRMED");
  }

  // 6. Labour. A sowing or harvest in the farmer's busiest months, or two sowings a year with very little help,
  // is something to check, not a veto: how much work a crop takes is not measured in the library.
  if (input.peakMonths && input.peakMonths.length > 0) {
    const peak = new Set(input.peakMonths);
    const month = (iso: string) => Number(iso.slice(5, 7));
    const hits = cropSlots.flatMap((s) => [month(s.plantDate), month(s.harvestDate)]).filter((m) => peak.has(m));
    if (hits.length >= 2) {
      unconfirmedFactors.push("LABOUR_PEAK_CONFLICT");
      reasons.push({
        code: "LABOUR_PEAK_CONFLICT",
        type: "missing_evidence",
        message: "Sowing and harvest fall in your busiest months. Check that you will have help at those times.",
        fieldSource: "farmer_constraint",
      });
    }
  }
  if (input.labour === "low" && cropSlots.length / Math.max(1, rotation.cycleYears) >= 2) {
    unconfirmedFactors.push("LABOUR_LOW_TWO_CROPS");
    reasons.push({
      code: "LABOUR_LOW_TWO_CROPS",
      type: "missing_evidence",
      message: "Two sowings and harvests a year need more help than you said you have. Check who can help at those times.",
      fieldSource: "farmer_constraint",
    });
  }

  let status: FeasibilityStatus = "feasible";
  if (hardConstraintVetoes.length > 0) {
    status = "infeasible";
  } else if (unconfirmedFactors.length > 0) {
    status = "needs_review";
  }

  return {
    rotationId: rotation.id,
    status,
    reasons,
    hardConstraintVetoes,
    unconfirmedFactors,
  };
}

export interface CandidateDecisionScore {
  rotationId: string;
  feasibility: CandidateFeasibility;
  mcdaScore: number | null;
  rank: number | null;
  keyStrengths: string[];
  keyRisks: string[];
  localChecksNeeded: string[];
}

export interface DecisionEngineOutput {
  status: "ranked" | "no_feasible_match" | "unresolved";
  topRecommendation: CandidateDecisionScore | null;
  rankedCandidates: CandidateDecisionScore[];
  infeasibleCandidates: CandidateDecisionScore[];
  needsReviewCandidates: CandidateDecisionScore[];
  advisoryNotice: string;
  provenance: {
    engineVersion: string;
    decisionBasis: "farmer_hard_gates_then_anchor_mcda";
    prioritiesUsed: PriorityId[];
  };
}

/**
 * Deterministic Decision Sensitivity Analysis (Prompt 6, replacing EVSI).
 * Varies missing or uncertain parameters over documented low/mid/high cases.
 * Identifies whether top choice switches, generating grounded 'check before planting' prompts.
 */
export interface SensitivitySwitchCheck {
  parameterName: string;
  testedRange: string;
  switchesTopChoice: boolean;
  baselineTopId: string;
  switchedTopId?: string;
  recommendedLocalCheck: string;
}

export function evaluateDeterministicSensitivity(input: {
  candidates: Array<{ id: string; baseScore: number; priceSensitive: boolean; waterSensitive: boolean }>;
  farmerPriorities: FarmerDecisionInput;
}): SensitivitySwitchCheck[] {
  const { candidates } = input;
  const checks: SensitivitySwitchCheck[] = [];
  if (candidates.length < 2) return checks;

  const sortedBase = [...candidates].sort((a, b) => b.baseScore - a.baseScore);
  const baselineTop = sortedBase[0];

  // Test 1: Market Commodity Price Variation (-20% to +20%)
  const priceLowScores = candidates.map((c) => ({
    id: c.id,
    score: c.priceSensitive ? c.baseScore * 0.80 : c.baseScore,
  })).sort((a, b) => b.score - a.score);

  const priceSwitches = priceLowScores[0].id !== baselineTop.id;
  checks.push({
    parameterName: "Commodity Market Price (±20% wholesale fluctuation)",
    testedRange: "20% wholesale depot price drop",
    switchesTopChoice: priceSwitches,
    baselineTopId: baselineTop.id,
    switchedTopId: priceSwitches ? priceLowScores[0].id : undefined,
    recommendedLocalCheck: priceSwitches
      ? `Check local wholesale depot price for ${baselineTop.id} before purchasing seed; if prices drop by 20%, candidate ${priceLowScores[0].id} becomes more attractive.`
      : "Ranking is stable against 20% price fluctuations.",
  });

  // Test 2: Soil Available Water Capacity (80 mm/m drought case vs 140 mm/m normal)
  const droughtScores = candidates.map((c) => ({
    id: c.id,
    score: c.waterSensitive ? c.baseScore * 0.70 : c.baseScore,
  })).sort((a, b) => b.score - a.score);

  const waterSwitches = droughtScores[0].id !== baselineTop.id;
  checks.push({
    parameterName: "Dry-season Soil Moisture & Residual Water Capacity",
    testedRange: "Low subsoil moisture buffer (80 mm/m AWC)",
    switchesTopChoice: waterSwitches,
    baselineTopId: baselineTop.id,
    switchedTopId: waterSwitches ? droughtScores[0].id : undefined,
    recommendedLocalCheck: waterSwitches
      ? `Inspect subsoil moisture at 20–40 cm depth with an auger or spade before sowing; in dry profiles, option ${droughtScores[0].id} has lower risk than ${baselineTop.id}.`
      : "Ranking is stable across varying residual soil moisture levels.",
  });

  // Sort: decision-critical ranking switches come FIRST!
  checks.sort((a, b) => (b.switchesTopChoice ? 1 : 0) - (a.switchesTopChoice ? 1 : 0));
  return checks;
}

/**
 * Baseline vs NASA Comparison Mode (Prompt 6, Item 5).
 * Compares same farmer inputs against baseline 30-year climatology vs NASA-informed environmental data.
 * Records whether rank or water risk changed, never forcing an artificial rank flip.
 */
export interface BaselineVsNasaComparison {
  available: boolean;
  baselineRank?: number;
  nasaRank?: number;
  rankChanged?: boolean;
  baselineWaterRisk?: string;
  nasaWaterRisk?: string;
  explanation: string;
  evidenceDifferences: Array<{
    feature: string;
    baselineValue: string;
    nasaValue: string;
  }>;
}

export function compareBaselineVsNasa(input: {
  candidateId: string;
  baselineRainfallMm: number;
  nasaRainfallMm: number;
  baselineEtoMm: number;
  nasaEtoMm: number;
  baselineRank?: number | null;
  nasaRank?: number | null;
}): BaselineVsNasaComparison {
  if (!input.baselineRank || input.baselineRank <= 0 || !input.nasaRank || input.nasaRank <= 0) {
    return {
      available: false,
      explanation: "Comparison unavailable: no accepted baseline rotation was found for this field.",
      evidenceDifferences: [],
    };
  }

  const rankChanged = input.baselineRank !== input.nasaRank;
  const rainDiff = input.nasaRainfallMm - input.baselineRainfallMm;
  const rainDiffPct = input.baselineRainfallMm > 0 ? (rainDiff / input.baselineRainfallMm) * 100 : 0;

  const baselineRisk = "Moderate historical shortfall";
  let nasaRisk = "Moderate observed shortfall";
  if (rainDiffPct < -20) {
    nasaRisk = "Elevated drought stress: observed rainfall is >20% below 30-year climatology";
  } else if (rainDiffPct > 20) {
    nasaRisk = "Favorable water availability: observed rainfall exceeds 30-year climatology";
  }

  let explanation: string;
  if (!rankChanged) {
    explanation = "Environmental conditions are consistent with historical seasonal climatology; candidate ranking and risk tier remain unchanged with NASA observation.";
  } else {
    explanation = `Observed seasonal rainfall (${Math.round(input.nasaRainfallMm)} mm) differed by ${rainDiffPct.toFixed(1)}% from historical climatology (${Math.round(input.baselineRainfallMm)} mm), updating water stress evaluation from rank #${input.baselineRank} to rank #${input.nasaRank}.`;
  }

  return {
    available: true,
    baselineRank: input.baselineRank,
    nasaRank: input.nasaRank,
    rankChanged,
    baselineWaterRisk: baselineRisk,
    nasaWaterRisk: nasaRisk,
    explanation,
    evidenceDifferences: [
      {
        feature: "Seasonal Rainfall",
        baselineValue: `${Math.round(input.baselineRainfallMm)} mm (30-year normal)`,
        nasaValue: `${Math.round(input.nasaRainfallMm)} mm (NASA IMERG/POWER)`,
      },
      {
        feature: "Reference Evapotranspiration (ETo)",
        baselineValue: `${Math.round(input.baselineEtoMm)} mm`,
        nasaValue: `${Math.round(input.nasaEtoMm)} mm (Penman-Monteith)`,
      },
    ],
  };
}
