import { describe, it, expect } from "vitest";
import { REAL_WORLD_CROP_ECONOMICS } from "../../lib/data/crops/real-world-economics";
import { rankRotations, type McdaInput, anchorUtility, relativeUtility } from "../../lib/engine/mcda";
import type { PriorityId, FarmerPriorities } from "../../lib/types";

export interface CandidateCrop {
  id: string;
  name: string;
  family: string;
  group: "cereal" | "legume" | "oilseed" | "cover";
  cycleDays: number;
  seasonMmOpt: number;
  seasonMmMin: number;
  droughtTolerance: number;
  waterlogTolerance: number;
  kcMid: number;
  nFixKgHa: number;
  nDemandKgHa: number;
  ky: number | null;
  optTemp: [number, number];
  absTemp: [number, number];
  preferredDrainage: string[];
}

export const ABLATION_CROPS: Record<string, CandidateCrop> = {
  rice: {
    id: "rice",
    name: "Paddy Rice",
    family: "Poaceae",
    group: "cereal",
    cycleDays: 135,
    seasonMmOpt: 1100,
    seasonMmMin: 700,
    droughtTolerance: 1,
    waterlogTolerance: 5,
    kcMid: 1.20,
    nFixKgHa: 0,
    nDemandKgHa: 90,
    ky: 1.0,
    optTemp: [20, 30],
    absTemp: [10, 36],
    preferredDrainage: ["poor", "moderate"],
  },
  "black-gram": {
    id: "black-gram",
    name: "Black Gram",
    family: "Fabaceae",
    group: "legume",
    cycleDays: 85,
    seasonMmOpt: 350,
    seasonMmMin: 250,
    droughtTolerance: 3,
    waterlogTolerance: 2,
    kcMid: 1.15,
    nFixKgHa: 40,
    nDemandKgHa: 30,
    ky: 0.85,
    optTemp: [22, 35],
    absTemp: [8, 40],
    preferredDrainage: ["moderate", "good", "excessive"],
  },
  "green-gram": {
    id: "green-gram",
    name: "Green Gram",
    family: "Fabaceae",
    group: "legume",
    cycleDays: 70,
    seasonMmOpt: 350,
    seasonMmMin: 250,
    droughtTolerance: 3,
    waterlogTolerance: 2,
    kcMid: 1.15,
    nFixKgHa: 50,
    nDemandKgHa: 30,
    ky: 0.85,
    optTemp: [21, 36],
    absTemp: [8, 40],
    preferredDrainage: ["good", "excessive"],
  },
  sesame: {
    id: "sesame",
    name: "Sesame",
    family: "Pedaliaceae",
    group: "oilseed",
    cycleDays: 95,
    seasonMmOpt: 450,
    seasonMmMin: 300,
    droughtTolerance: 4,
    waterlogTolerance: 1,
    kcMid: 1.10,
    nFixKgHa: 0,
    nDemandKgHa: 60,
    ky: 0.80,
    optTemp: [24, 32],
    absTemp: [10, 40],
    preferredDrainage: ["good", "excessive"],
  },
  groundnut: {
    id: "groundnut",
    name: "Groundnut",
    family: "Fabaceae",
    group: "legume",
    cycleDays: 115,
    seasonMmOpt: 500,
    seasonMmMin: 350,
    droughtTolerance: 4,
    waterlogTolerance: 1,
    kcMid: 1.15,
    nFixKgHa: 80,
    nDemandKgHa: 40,
    ky: 0.70,
    optTemp: [22, 32],
    absTemp: [10, 38],
    preferredDrainage: ["good", "excessive"],
  },
  chickpea: {
    id: "chickpea",
    name: "Chickpea",
    family: "Fabaceae",
    group: "legume",
    cycleDays: 105,
    seasonMmOpt: 300,
    seasonMmMin: 200,
    droughtTolerance: 4,
    waterlogTolerance: 1,
    kcMid: 1.00,
    nFixKgHa: 50,
    nDemandKgHa: 30,
    ky: 0.85,
    optTemp: [15, 28],
    absTemp: [5, 35],
    preferredDrainage: ["good", "moderate"],
  },
  "pigeon-pea": {
    id: "pigeon-pea",
    name: "Pigeon Pea",
    family: "Fabaceae",
    group: "legume",
    cycleDays: 180,
    seasonMmOpt: 600,
    seasonMmMin: 400,
    droughtTolerance: 4,
    waterlogTolerance: 2,
    kcMid: 1.15,
    nFixKgHa: 70,
    nDemandKgHa: 40,
    ky: 0.85,
    optTemp: [20, 32],
    absTemp: [10, 40],
    preferredDrainage: ["good", "moderate"],
  },
  sunflower: {
    id: "sunflower",
    name: "Sunflower",
    family: "Asteraceae",
    group: "oilseed",
    cycleDays: 95,
    seasonMmOpt: 450,
    seasonMmMin: 300,
    droughtTolerance: 4,
    waterlogTolerance: 2,
    kcMid: 1.10,
    nFixKgHa: 0,
    nDemandKgHa: 70,
    ky: 0.95,
    optTemp: [18, 30],
    absTemp: [8, 38],
    preferredDrainage: ["moderate", "good"],
  },
  fallow: {
    id: "fallow",
    name: "Fallow",
    family: "None",
    group: "cover",
    cycleDays: 90,
    seasonMmOpt: 0,
    seasonMmMin: 0,
    droughtTolerance: 5,
    waterlogTolerance: 5,
    kcMid: 0.2,
    nFixKgHa: 0,
    nDemandKgHa: 0,
    ky: null,
    optTemp: [-10, 60],
    absTemp: [-20, 70],
    preferredDrainage: ["poor", "moderate", "good", "excessive"],
  },
};

export interface RotationSequence {
  id: string;
  name: string;
  region: "ayeyarwady" | "magway";
  crops: string[];
  irrigatedSlots: boolean[];
  cycleDays: number;
}

export const ROTATION_CANDIDATES: RotationSequence[] = [
  // Ayeyarwady Delta
  {
    id: "ay-rice-black-gram",
    name: "Monsoon Rice -> Black Gram",
    region: "ayeyarwady",
    crops: ["rice", "black-gram"],
    irrigatedSlots: [false, false],
    cycleDays: 365,
  },
  {
    id: "ay-rice-green-gram",
    name: "Monsoon Rice -> Green Gram",
    region: "ayeyarwady",
    crops: ["rice", "green-gram"],
    irrigatedSlots: [false, false],
    cycleDays: 365,
  },
  {
    id: "ay-rice-irrigated-rice",
    name: "Monsoon Rice -> Summer Rice",
    region: "ayeyarwady",
    crops: ["rice", "rice"],
    irrigatedSlots: [false, true],
    cycleDays: 365,
  },
  {
    id: "ay-rice-sunflower",
    name: "Monsoon Rice -> Sunflower",
    region: "ayeyarwady",
    crops: ["rice", "sunflower"],
    irrigatedSlots: [false, false],
    cycleDays: 365,
  },
  {
    id: "ay-rice-fallow",
    name: "Monsoon Rice -> Fallow",
    region: "ayeyarwady",
    crops: ["rice", "fallow"],
    irrigatedSlots: [false, false],
    cycleDays: 365,
  },

  // Central Dry Zone (Magway)
  {
    id: "mg-sesame-green-gram",
    name: "Early Sesame -> Green Gram",
    region: "magway",
    crops: ["sesame", "green-gram"],
    irrigatedSlots: [false, false],
    cycleDays: 365,
  },
  {
    id: "mg-groundnut-chickpea",
    name: "Groundnut -> Chickpea",
    region: "magway",
    crops: ["groundnut", "chickpea"],
    irrigatedSlots: [false, false],
    cycleDays: 365,
  },
  {
    id: "mg-pigeon-pea-sesame",
    name: "Pigeon Pea (Long) -> Sesame",
    region: "magway",
    crops: ["pigeon-pea", "sesame"],
    irrigatedSlots: [false, false],
    cycleDays: 730,
  },
  {
    id: "mg-groundnut-green-gram",
    name: "Groundnut -> Green Gram",
    region: "magway",
    crops: ["groundnut", "green-gram"],
    irrigatedSlots: [false, false],
    cycleDays: 365,
  },
  {
    id: "mg-sesame-fallow",
    name: "Early Sesame -> Fallow",
    region: "magway",
    crops: ["sesame", "fallow"],
    irrigatedSlots: [false, false],
    cycleDays: 365,
  },
];

export interface ClimateCondition {
  name: string;
  seasonRainMm: Record<string, number>;
  seasonEt0Mm: Record<string, number>;
  tempMeanC: Record<string, number>;
  tempMaxC: Record<string, number>;
  soilDrainage: "poor" | "moderate" | "well";
  waterloggingEvent: boolean;
  availableIrrigation: "none" | "reliable";
}

function calculateRotationEconomics(
  rot: RotationSequence,
  yieldFactors: Record<string, number> = {}
): { grossMarginMmkHa: number; totalCostMmkHa: number; netRevenueMmkHa: number } {
  let totalRevenue = 0;
  let totalCost = 0;

  for (const cropId of rot.crops) {
    if (cropId === "fallow") continue;
    const econ = REAL_WORLD_CROP_ECONOMICS[cropId] ?? {
      priceMmkPerKg: [1200, 1600],
      yieldKgHa: [1500, 2500],
      costMmkPerHa: [500000, 800000],
    };

    const phi = yieldFactors[cropId] ?? 1.0;
    const yieldKgHa = econ.yieldKgHa ?? [1500, 2500];
    const priceMmk = econ.priceMmkPerKg ?? [1200, 1600];
    const costMmk = econ.costMmkPerHa ?? [500000, 800000];
    const midYield = ((yieldKgHa[0] + yieldKgHa[1]) / 2) * phi;
    const midPrice = (priceMmk[0] + priceMmk[1]) / 2;
    const midCost = (costMmk[0] + costMmk[1]) / 2;

    totalRevenue += midYield * midPrice;
    totalCost += midCost;
  }

  const cycleYears = rot.cycleDays / 365;
  const annualMargin = (totalRevenue - totalCost) / cycleYears;
  const annualCost = totalCost / cycleYears;

  return {
    grossMarginMmkHa: Math.round(annualMargin),
    totalCostMmkHa: Math.round(annualCost),
    netRevenueMmkHa: Math.round(totalRevenue / cycleYears),
  };
}

function calculateEnvironmentalMetrics(
  rot: RotationSequence,
  climate: ClimateCondition,
  withNasa: boolean
): {
  waterShortfallMm: number;
  legumeShare: number;
  coverShare: number;
  nDemandKgHa: number;
  feasible: boolean;
  blockReason?: string;
  yieldFactors: Record<string, number>;
} {
  let totalShortfall = 0;
  let legumeCount = 0;
  let nonFallowCount = 0;
  let totalCropDays = 0;
  let totalNDemand = 0;
  let feasible = true;
  let blockReason: string | undefined;
  const yieldFactors: Record<string, number> = {};

  for (let i = 0; i < rot.crops.length; i++) {
    const cropId = rot.crops[i];
    const isIrrigated = rot.irrigatedSlots[i];
    const crop = ABLATION_CROPS[cropId];

    if (cropId === "fallow") {
      yieldFactors[cropId] = 1.0;
      continue;
    }

    nonFallowCount++;
    if (crop.group === "legume") legumeCount++;
    totalCropDays += crop.cycleDays;
    totalNDemand += crop.nDemandKgHa;

    if (isIrrigated && climate.availableIrrigation === "none") {
      feasible = false;
      blockReason = `Crop ${crop.name} requires dry-season irrigation, which is confirmed unavailable.`;
    }

    if (climate.waterloggingEvent && crop.waterlogTolerance <= 1) {
      feasible = false;
      blockReason = `Crop ${crop.name} suffered total root asphyxiation/wilt from severe waterlogging event (tolerance ${crop.waterlogTolerance}/5).`;
    }

    const meanTemp = climate.tempMeanC[cropId] ?? 28;
    if (meanTemp < crop.absTemp[0] || meanTemp > crop.absTemp[1]) {
      feasible = false;
      blockReason = `Mean temperature ${meanTemp}°C outside absolute range [${crop.absTemp.join(", ")}] for ${crop.name}.`;
    }

    if (withNasa) {
      const rain = climate.seasonRainMm[cropId] ?? 400;
      const et0 = climate.seasonEt0Mm[cropId] ?? 450;
      const etc = crop.kcMid * et0;
      const shortfall = isIrrigated ? 0 : Math.max(0, etc - rain);
      totalShortfall += shortfall;

      const waterRatio = isIrrigated ? 1.0 : Math.min(1.0, rain / etc);
      const ky = crop.ky ?? 0.85;
      const phi = Math.max(0.1, Math.min(1.0, 1.0 - ky * (1.0 - waterRatio)));
      yieldFactors[cropId] = Number(phi.toFixed(3));
    } else {
      const heuristicShortfall = isIrrigated ? 0 : cropId === "rice" ? 50 : 120;
      totalShortfall += heuristicShortfall;
      yieldFactors[cropId] = 1.0;
    }
  }

  const cycleYears = rot.cycleDays / 365;
  return {
    waterShortfallMm: Math.round(totalShortfall / cycleYears),
    legumeShare: nonFallowCount > 0 ? legumeCount / nonFallowCount : 0,
    coverShare: Math.min(1.0, totalCropDays / rot.cycleDays),
    nDemandKgHa: Math.round(totalNDemand / cycleYears),
    feasible,
    blockReason,
    yieldFactors,
  };
}

export interface AblationRunResult {
  config: "A" | "B" | "C" | "D" | "E";
  configName: string;
  rotationId: string;
  rotationName: string;
  rank: number;
  feasible: boolean;
  score: number | null;
  grossMarginMmkHa: number;
  waterShortfallMm: number;
  legumeShare: number;
  coverShare: number;
  blockReason?: string;
}

export function runAblation(
  rotations: RotationSequence[],
  climate: ClimateCondition,
  priorities: FarmerPriorities,
  config: "A" | "B" | "C" | "D" | "E",
  customWaterAnchorLimit?: number
): AblationRunResult[] {
  const evaluated = rotations.map((rot) => {
    switch (config) {
      case "A": {
        const econ = calculateRotationEconomics(rot);
        return {
          rot,
          feasible: true,
          metrics: {
            "income-margin": econ.grossMarginMmkHa,
          },
          econ,
          env: { waterShortfallMm: 0, legumeShare: 0, coverShare: 0, nDemandKgHa: 0 },
        };
      }
      case "B": {
        const env = calculateEnvironmentalMetrics(rot, climate, true);
        return {
          rot,
          feasible: env.feasible,
          blockReason: env.blockReason,
          metrics: {
            "water-shortfall": env.waterShortfallMm,
            "soil-legume-share": env.legumeShare,
            "soil-cover": env.coverShare,
            "input-nitrogen": env.nDemandKgHa,
          },
          econ: { grossMarginMmkHa: 0, totalCostMmkHa: 0, netRevenueMmkHa: 0 },
          env,
        };
      }
      case "C": {
        const env = calculateEnvironmentalMetrics(rot, climate, false);
        const econ = calculateRotationEconomics(rot, env.yieldFactors);
        return {
          rot,
          feasible: env.feasible,
          blockReason: env.blockReason,
          metrics: {
            "income-margin": econ.grossMarginMmkHa,
            "water-shortfall": env.waterShortfallMm,
            "soil-legume-share": env.legumeShare,
            "soil-cover": env.coverShare,
            "input-nitrogen": env.nDemandKgHa,
          },
          econ,
          env,
        };
      }
      case "D": {
        const env = calculateEnvironmentalMetrics(rot, climate, false);
        const econ = calculateRotationEconomics(rot, env.yieldFactors);
        return {
          rot,
          feasible: env.feasible,
          blockReason: env.blockReason,
          metrics: {
            "income-margin": econ.grossMarginMmkHa,
            "water-shortfall": env.waterShortfallMm,
            "soil-legume-share": env.legumeShare,
            "soil-cover": env.coverShare,
            "input-nitrogen": env.nDemandKgHa,
          },
          econ,
          env,
        };
      }
      case "E": {
        const env = calculateEnvironmentalMetrics(rot, climate, true);
        const econ = calculateRotationEconomics(rot, env.yieldFactors);
        return {
          rot,
          feasible: env.feasible,
          blockReason: env.blockReason,
          metrics: {
            "income-margin": econ.grossMarginMmkHa,
            "water-shortfall": env.waterShortfallMm,
            "soil-legume-share": env.legumeShare,
            "soil-cover": env.coverShare,
            "input-nitrogen": env.nDemandKgHa,
          },
          econ,
          env,
        };
      }
    }
  });

  const mcdaInputs: McdaInput[] = evaluated.map((e) => ({
    rotationId: e.rot.id,
    feasible: e.feasible,
    values: e.metrics as any,
  }));

  const rankOpts = customWaterAnchorLimit
    ? {
        anchors: {
          "water-shortfall": {
            target: 0,
            limit: customWaterAnchorLimit,
            scope: "analyst-assumption" as const,
            ref: "Calibrated dry-zone annual anchor",
          },
        },
      }
    : undefined;

  const mcdaResult = rankRotations(mcdaInputs, priorities, rankOpts);
  const scoreMap = new Map<string, number>();
  mcdaResult.ranking.forEach((r) => scoreMap.set(r.rotationId, r.score));

  const configNames: Record<string, string> = {
    A: "Economic Info Only",
    B: "Environmental Info Only",
    C: "Combined Baseline (Climatology)",
    D: "Combined Heuristic (No NASA)",
    E: "Combined NASA-Derived",
  };

  const results: AblationRunResult[] = evaluated.map((e) => {
    const score = scoreMap.get(e.rot.id) ?? null;
    return {
      config,
      configName: configNames[config],
      rotationId: e.rot.id,
      rotationName: e.rot.name,
      rank: 999,
      feasible: e.feasible,
      score,
      grossMarginMmkHa: e.econ.grossMarginMmkHa,
      waterShortfallMm: e.env.waterShortfallMm,
      legumeShare: e.env.legumeShare,
      coverShare: e.env.coverShare,
      blockReason: e.blockReason,
    };
  });

  results.sort((a, b) => {
    if (a.feasible && !b.feasible) return -1;
    if (!a.feasible && b.feasible) return 1;
    return (b.score ?? -999) - (a.score ?? -999);
  });

  results.forEach((r, idx) => {
    r.rank = r.feasible ? idx + 1 : 999;
  });

  return results;
}

describe("Systematic 5-Way NASA Decision Ablation Experiments", () => {
  const ayeyarwadyRotations = ROTATION_CANDIDATES.filter((r) => r.region === "ayeyarwady");
  const magwayRotations = ROTATION_CANDIDATES.filter((r) => r.region === "magway");

  const deltaNormalClimate: ClimateCondition = {
    name: "Ayeyarwady Normal Year",
    seasonRainMm: { rice: 1600, "black-gram": 120, "green-gram": 120, sunflower: 110, fallow: 50 },
    seasonEt0Mm: { rice: 600, "black-gram": 320, "green-gram": 280, sunflower: 340, fallow: 200 },
    tempMeanC: { rice: 28, "black-gram": 25, "green-gram": 25, sunflower: 26, fallow: 27 },
    tempMaxC: { rice: 33, "black-gram": 32, "green-gram": 32, sunflower: 33, fallow: 34 },
    soilDrainage: "moderate",
    waterloggingEvent: false,
    availableIrrigation: "none",
  };

  const deltaDroughtClimate: ClimateCondition = {
    name: "Ayeyarwady Severe Drought Year (Early Monsoon Cutoff)",
    seasonRainMm: { rice: 1100, "black-gram": 25, "green-gram": 25, sunflower: 20, fallow: 10 },
    seasonEt0Mm: { rice: 680, "black-gram": 380, "green-gram": 330, sunflower: 400, fallow: 240 },
    tempMeanC: { rice: 29, "black-gram": 27, "green-gram": 27, sunflower: 28, fallow: 29 },
    tempMaxC: { rice: 35, "black-gram": 36, "green-gram": 36, sunflower: 36, fallow: 37 },
    soilDrainage: "moderate",
    waterloggingEvent: false,
    availableIrrigation: "none",
  };

  const magwayNormalClimate: ClimateCondition = {
    name: "Magway Central Dry Zone Normal Year",
    seasonRainMm: { sesame: 420, groundnut: 480, chickpea: 70, "pigeon-pea": 550, "green-gram": 280, fallow: 40 },
    seasonEt0Mm: { sesame: 480, groundnut: 520, chickpea: 360, "pigeon-pea": 850, "green-gram": 320, fallow: 250 },
    tempMeanC: { sesame: 30, groundnut: 29, chickpea: 22, "pigeon-pea": 28, "green-gram": 29, fallow: 28 },
    tempMaxC: { sesame: 37, groundnut: 36, chickpea: 31, "pigeon-pea": 37, "green-gram": 36, fallow: 38 },
    soilDrainage: "well",
    waterloggingEvent: false,
    availableIrrigation: "none",
  };

  const magwayDroughtClimate: ClimateCondition = {
    name: "Magway Extreme Drought Year (El Niño Analogue)",
    seasonRainMm: { sesame: 210, groundnut: 240, chickpea: 15, "pigeon-pea": 290, "green-gram": 120, fallow: 10 },
    seasonEt0Mm: { sesame: 560, groundnut: 600, chickpea: 420, "pigeon-pea": 980, "green-gram": 380, fallow: 300 },
    tempMeanC: { sesame: 33, groundnut: 32, chickpea: 24, "pigeon-pea": 31, "green-gram": 32, fallow: 31 },
    tempMaxC: { sesame: 41, groundnut: 40, chickpea: 34, "pigeon-pea": 41, "green-gram": 40, fallow: 42 },
    soilDrainage: "well",
    waterloggingEvent: false,
    availableIrrigation: "none",
  };

  const balancedPriorities: FarmerPriorities = {
    order: ["income", "water", "soil"],
    weights: { income: 0.5, water: 0.3, soil: 0.2 },
  };

  const waterDominantPriorities: FarmerPriorities = {
    order: ["water", "soil", "income"],
    weights: { water: 0.6, soil: 0.25, income: 0.15 },
  };

  it("TEST 1: Ayeyarwady Delta 5-Way Ablation under Normal Climate", () => {
    const resultsA = runAblation(ayeyarwadyRotations, deltaNormalClimate, { order: ["income"], weights: { income: 1 } }, "A");
    const resultsB = runAblation(ayeyarwadyRotations, deltaNormalClimate, { order: ["water", "soil"], weights: { water: 0.6, soil: 0.4 } }, "B");
    const resultsC = runAblation(ayeyarwadyRotations, deltaNormalClimate, balancedPriorities, "C");
    const resultsD = runAblation(ayeyarwadyRotations, deltaNormalClimate, balancedPriorities, "D");
    const resultsE = runAblation(ayeyarwadyRotations, deltaNormalClimate, balancedPriorities, "E");

    expect(["ay-rice-sunflower", "ay-rice-green-gram"]).toContain(resultsA[0].rotationId);
    expect(resultsB[0].rotationId).toBe("ay-rice-fallow"); // Zero water shortfall makes fallow top on environment
    expect(resultsE.find((r) => r.rotationId === "ay-rice-irrigated-rice")?.feasible).toBe(false);
    expect(resultsE[0].rotationId).toBe("ay-rice-green-gram");
  });

  it("TEST 2: Ayeyarwady Delta 5-Way Ablation under Extreme Drought", () => {
    const resultsD = runAblation(ayeyarwadyRotations, deltaDroughtClimate, balancedPriorities, "D");
    const resultsE = runAblation(ayeyarwadyRotations, deltaDroughtClimate, balancedPriorities, "E");
    const resultsEWater = runAblation(ayeyarwadyRotations, deltaDroughtClimate, waterDominantPriorities, "E");

    expect(resultsD[0].rotationId).toBe("ay-rice-green-gram");
    expect(resultsE[0].rotationId).toBe("ay-rice-green-gram");
    expect(resultsEWater[0].rotationId).toBe("ay-rice-fallow");
  });

  it("TEST 3: Central Dry Zone (Magway) 5-Way Ablation: Normal vs Severe Drought", () => {
    const magwayNormA = runAblation(magwayRotations, magwayNormalClimate, { order: ["income"], weights: { income: 1 } }, "A");
    const magwayDroughtD = runAblation(magwayRotations, magwayDroughtClimate, balancedPriorities, "D");
    const magwayDroughtE = runAblation(magwayRotations, magwayDroughtClimate, balancedPriorities, "E");

    // In normal economics, Groundnut -> Chickpea is #1
    expect(magwayNormA[0].rotationId).toBe("mg-groundnut-chickpea");
    // Without NASA, heuristic config D still recommends Groundnut -> Chickpea #1
    expect(magwayDroughtD[0].rotationId).toBe("mg-groundnut-chickpea");
    // With NASA, chickpea yield and margin collapse due to 15mm rain against 420mm ET0
    // Groundnut -> Green Gram overtakes Groundnut -> Chickpea!
    expect(magwayDroughtE[0].rotationId).toBe("mg-groundnut-green-gram");
    expect(magwayDroughtE[0].rotationId).not.toBe(magwayDroughtD[0].rotationId);
  });

  it("TEST 4: Priority Weight & Anchor Limit Ablation in Magway Drought", () => {
    // When calibrated anchor limit (1000 mm) is used for annual multi-crop sequences in Dry Zone:
    const resCalibratedIncome = runAblation(
      magwayRotations,
      magwayDroughtClimate,
      { order: ["income", "water"], weights: { income: 0.9, water: 0.1 } },
      "E",
      1000
    );
    const resCalibratedWater = runAblation(
      magwayRotations,
      magwayDroughtClimate,
      { order: ["water", "soil", "income"], weights: { water: 0.7, soil: 0.2, income: 0.1 } },
      "E",
      1000
    );

    console.log("CALIBRATED ANCHOR (1000mm) - Income Priority Top:", resCalibratedIncome[0].rotationId, resCalibratedIncome[0].score);
    console.log("CALIBRATED ANCHOR (1000mm) - Water Priority Top:", resCalibratedWater[0].rotationId, resCalibratedWater[0].score);

    expect(resCalibratedIncome[0].rotationId).toBe("mg-groundnut-green-gram");
    expect(resCalibratedWater[0].rotationId).toBe("mg-sesame-fallow"); // Drought escape via single crop fallow wins on water!
    expect(resCalibratedIncome[0].rotationId).not.toBe(resCalibratedWater[0].rotationId);
  });
});
