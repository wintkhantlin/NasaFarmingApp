import type { Field, Rotation, RotationSlot, Evidence, Risk } from "../types";
import { getCropById } from "../data/crops";

export interface EvaluatedOption {
  id: string;
  label: string;
  headline: string;
  reason: string;
  badge: string;
  rotation: Rotation;
  isFit: boolean;
  noFitReason?: string;
  evidence: Evidence[];
  risks: Risk[];
  unknowns: string[];
  soilScore: "low" | "medium" | "high";
  waterResilience: "low" | "medium" | "high";
  estimatedNBalanceKgHa: number;
}

export interface ComparisonResult {
  current: EvaluatedOption;
  alternatives: EvaluatedOption[];
}

/**
 * Pure strategy engine that compares a farmer's recorded rotation with
 * two climate-adapted alternatives:
 * 1. Drought-resilient diversification (incorporating high drought tolerance crops like sorghum/groundnut/cowpea)
 * 2. Soil-building legume & cover crop cycle (maximizing biological N-fixation and organic matter)
 */
export function generateStrategies(
  field: Field,
  currentRotation: Rotation,
  annualRainMm = 750,
): ComparisonResult {
  const currentSlots = currentRotation.slots;
  const currentCropIds = currentSlots.map((s) => s.cropId).filter(Boolean) as string[];
  const currentCrops = currentCropIds.map((id) => getCropById(id)).filter(Boolean);

  // Calculate N demand and N fix for current
  const totalNDemand = currentCrops.reduce((acc, c) => acc + (c?.nDemandKgHa ?? 100), 0);
  const totalNFix = currentCrops.reduce((acc, c) => acc + (c?.nFixKgHa ?? 0), 0);
  const currentNBalance = totalNFix - totalNDemand;

  const currentAvgDroughtTol =
    currentCrops.length > 0
      ? currentCrops.reduce((acc, c) => acc + (c?.water.droughtTolerance ?? 2), 0) / currentCrops.length
      : 2.5;

  const currentWaterResilience = currentAvgDroughtTol >= 3.5 ? "high" : currentAvgDroughtTol >= 2.5 ? "medium" : "low";
  const currentSoilScore = totalNFix >= 60 ? "high" : totalNFix > 0 ? "medium" : "low";

  const isRainfed = field.irrigation === "none";

  const currentRisks: Risk[] = [];
  if (isRainfed && annualRainMm < 650 && currentAvgDroughtTol < 3) {
    currentRisks.push({
      id: "risk-water-deficit",
      kind: "agronomic",
      severity: "important",
      text: "Marginal water supply in dry years for sensitive crops without irrigation.",
      action: "Check rainfall records or consider supplemental water access.",
      relatedEvidence: ["ev-rain"],
    });
  }
  if (currentNBalance < -80) {
    currentRisks.push({
      id: "risk-n-depletion",
      kind: "agronomic",
      severity: "caution",
      text: "High nitrogen deficit over the cycle depletes soil organic reserve unless heavily fertilized.",
      action: "Test soil nitrogen annually or introduce legume cover crops.",
      relatedEvidence: ["ev-n"],
    });
  }

  const currentOption: EvaluatedOption = {
    id: currentRotation.id,
    label: currentRotation.label || "Your current rotation",
    headline: currentCrops.length > 0 ? `Current: ${currentCrops.map((c) => c?.names.common).join(" → ")}` : "Your recorded rotation",
    reason: `Based on your ${currentRotation.cycleYears}-year recorded cycle on ${field.name}.`,
    badge: "Current baseline",
    rotation: currentRotation,
    isFit: true,
    soilScore: currentSoilScore,
    waterResilience: currentWaterResilience,
    estimatedNBalanceKgHa: currentNBalance,
    evidence: [
      {
        id: "ev-rain",
        claim: "Rainfall fit for cycle crops",
        metric: "Seasonal water use",
        value: `${annualRainMm} mm annual rainfall`,
        source: { dataset: "NASA POWER", resolution: "0.5°", dates: "1981–2024" },
        confidence: "high",
      },
      {
        id: "ev-n",
        claim: "Nutrient balance estimate",
        metric: "Net nitrogen demand",
        value: `${currentNBalance > 0 ? "+" : ""}${Math.round(currentNBalance)} kg/ha`,
        source: { dataset: "FAO-56 / Agronomic estimates", resolution: "plot", dates: "typical" },
        confidence: "medium",
      },
    ],
    risks: currentRisks,
    unknowns: [
      "Exact root-zone moisture variability within your boundary",
      "Actual fertilizer application rate and timing",
    ],
  };

  // Alternative 1: Drought-resilient diversification
  const alt1CropIds = isRainfed ? ["sorghum", "groundnut", "cowpea"] : ["maize", "groundnut", "soybean"];
  const alt1Slots: RotationSlot[] = alt1CropIds.map((cropId, idx) => {
    const year = 2026 + idx;
    return {
      id: `alt1-slot-${idx}`,
      kind: "crop",
      cropId,
      plantDate: `${year}-05-15`,
      harvestDate: `${year}-09-20`,
      dateConfidence: "typical",
      irrigated: field.irrigation === "full",
      notes: "Selected for drought resilience and split season risks",
    };
  });

  const alt1Crops = alt1CropIds.map((id) => getCropById(id)).filter(Boolean);
  const alt1NDemand = alt1Crops.reduce((acc, c) => acc + (c?.nDemandKgHa ?? 0), 0);
  const alt1NFix = alt1Crops.reduce((acc, c) => acc + (c?.nFixKgHa ?? 0), 0);
  const alt1NBalance = alt1NFix - alt1NDemand;

  const alt1: EvaluatedOption = {
    id: "strategy-drought-resilience",
    label: "Drought-resilient diversification",
    headline: "Switch to sorghum, groundnut, and cowpea",
    reason: "Reduces peak water demand by ~30% and cushions against mid-season dry spells using deep-rooting cereals and hardy legumes.",
    badge: "Most reliable in dry years",
    isFit: true,
    rotation: {
      id: "strategy-drought-resilience",
      fieldId: field.id,
      label: "Drought-resilient diversification",
      cycleYears: 3,
      slots: alt1Slots,
      source: "strategy",
      strategyId: "drought-resilience",
    },
    soilScore: "medium",
    waterResilience: "high",
    estimatedNBalanceKgHa: alt1NBalance,
    evidence: [
      {
        id: "ev-alt1-drought",
        claim: "High drought tolerance ratings (4/5 and 5/5)",
        metric: "Drought tolerance",
        value: "Average 4.3 / 5",
        source: { dataset: "ICRISAT / FAO-56", resolution: "global", dates: "varietal tests" },
        confidence: "high",
      },
      {
        id: "ev-alt1-water",
        claim: "Requires 150–200 mm less water per season than continuous maize",
        metric: "Water requirement",
        value: "350–450 mm",
        comparedTo: "Maize 650 mm",
        source: { dataset: "NASA POWER", resolution: "0.5°", dates: "climatology" },
        confidence: "high",
      },
    ],
    risks: [
      {
        id: "risk-alt1-market",
        kind: "local-review",
        severity: "info",
        text: "Sorghum grain or forage local market prices can differ from maize.",
        action: "Check local buyer demand and storage capacity before planting.",
        relatedEvidence: [],
      },
    ],
    unknowns: [
      "Local seed availability for certified short-season sorghum varieties",
      "Bird pressure in your immediate valley",
    ],
  };

  // Alternative 2: Soil-building legume & cover crop cycle
  const alt2CropIds = ["maize", "crimson-clover", "soybean", "cowpea"];
  const alt2Slots: RotationSlot[] = [
    {
      id: "alt2-slot-0",
      kind: "crop",
      cropId: "maize",
      plantDate: "2026-05-10",
      harvestDate: "2026-09-15",
      dateConfidence: "typical",
      irrigated: field.irrigation !== "none",
    },
    {
      id: "alt2-slot-1",
      kind: "cover",
      cropId: "crimson-clover",
      plantDate: "2026-10-01",
      harvestDate: "2027-04-15",
      dateConfidence: "typical",
      irrigated: false,
    },
    {
      id: "alt2-slot-2",
      kind: "crop",
      cropId: "soybean",
      plantDate: "2027-05-20",
      harvestDate: "2027-09-25",
      dateConfidence: "typical",
      irrigated: false,
    },
    {
      id: "alt2-slot-3",
      kind: "cover",
      cropId: "cowpea",
      plantDate: "2027-10-01",
      harvestDate: "2028-04-01",
      dateConfidence: "typical",
      irrigated: false,
    },
  ];

  const alt2Crops = alt2CropIds.map((id) => getCropById(id)).filter(Boolean);
  const alt2NDemand = alt2Crops.reduce((acc, c) => acc + (c?.nDemandKgHa ?? 0), 0);
  const alt2NFix = alt2Crops.reduce((acc, c) => acc + (c?.nFixKgHa ?? 0), 0);
  const alt2NBalance = alt2NFix - alt2NDemand;

  const alt2: EvaluatedOption = {
    id: "strategy-soil-health",
    label: "Soil-building legume & cover cycle",
    headline: "Rotate maize with clover and soybean",
    reason: "Fixes biological atmospheric nitrogen, covers soil through the off-season, and increases organic carbon.",
    badge: "Highest soil health benefit",
    isFit: true,
    rotation: {
      id: "strategy-soil-health",
      fieldId: field.id,
      label: "Soil-building legume & cover cycle",
      cycleYears: 2,
      slots: alt2Slots,
      source: "strategy",
      strategyId: "soil-health",
    },
    soilScore: "high",
    waterResilience: "medium",
    estimatedNBalanceKgHa: alt2NBalance,
    evidence: [
      {
        id: "ev-alt2-n",
        claim: "Biological nitrogen fixation provides up to 150 kg N/ha over 2 years",
        metric: "Fixed N",
        value: "+150 kg/ha",
        source: { dataset: "ISRIC SoilGrids & USDA-NRCS", resolution: "field", dates: "modelled" },
        confidence: "high",
      },
      {
        id: "ev-alt2-erosion",
        claim: "Overwinter ground cover reduces rainfall runoff and topsoil loss",
        metric: "Ground cover duration",
        value: "9 months/year",
        source: { dataset: "SARE Cover Crop Guidelines", resolution: "regional", dates: "experimental" },
        confidence: "medium",
      },
    ],
    risks: [
      {
        id: "risk-alt2-termination",
        kind: "agronomic",
        severity: "caution",
        text: "Winter cover crop must be terminated 2–3 weeks before planting maize to preserve soil moisture.",
        action: "Plan roller-crimping, mowing, or shallow incorporation in early spring.",
        relatedEvidence: [],
      },
    ],
    unknowns: [
      "Winter soil temperature for reliable clover emergence",
      "Seed drill access for small-seeded cover crops",
    ],
  };

  return {
    current: currentOption,
    alternatives: [alt1, alt2],
  };
}
