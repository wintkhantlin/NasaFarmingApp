import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { parsePowerDaily } from "../../lib/nasa/power";
import { penmanMonteithDetails, normalizeSolarRadiation } from "../../lib/engine/et0";
import { generateCandidates } from "../../lib/engine/candidates";
import {
  dailySoilWaterStep,
  timingBucketModel,
  pumpingDecision,
  fao56StressCoefficient,
  paddyWaterBalance,
} from "../../lib/engine/water";
import {
  rankRotations,
  anchorUtility,
  minimaxRegret,
  switchingPoint,
} from "../../lib/engine/mcda";
import { annualizeMargin, breakEvenPrice } from "../../lib/engine/economics";
import { dailyGdd } from "../../lib/engine/climate";
import { stageWindows } from "../../lib/engine/season";
import { dryGrainNRemoval, partialNitrogenBudgetEnclosure } from "../../lib/engine/soil-health";
import { layeredWaterCapacity } from "../../lib/engine/soil-input";
import { areaWeightedCoverage } from "../../lib/nasa/derive/ndvi";
import { computeFieldSceneMetrics } from "../../lib/engine/lowcover";
import { pairedImprovementMae } from "../../lib/engine/compare";
import { compareRainfallSources } from "../../lib/engine/rain";
import { getCropById } from "../../lib/data/crops";
import { rotation, slot } from "../helpers/synthetic";

const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(join(import.meta.dirname, "../fixtures/myanmar", name), "utf8"));

describe("First Engineering Milestone: Magway 1-2 Jan 2025 POWER Reproduction", () => {
  const rawJson = fixture("power-connectivity-example.json") as { response: unknown };
  const weather = parsePowerDaily(rawJson.response);

  test("parses the recorded Magway response and verifies coordinate and units", () => {
    expect(weather.latitude).toBe(20.15);
    expect(weather.longitude).toBe(94.95);
    expect(weather.elevationM).toBe(166.35);
    expect(weather.meta.units.ALLSKY_SFC_SW_DWN).toBe("MJ/m^2/day");
    expect(weather.meta.units.PS).toBe("kPa");
    expect(weather.meta.fillValue).toBe(-999.0);
  });

  test("reproduces 20250101 and 20250102 intermediate columns and daily ET0 within ±0.01 mm", () => {
    const p = weather.series;
    const lat = weather.latitude;
    const elev = weather.elevationM ?? 166.35;

    // Day 1: 20250101 (DOY 1)
    const day1Details = penmanMonteithDetails({
      latDeg: lat,
      doy: 1,
      elevationM: elev,
      tmaxC: p.T2M_MAX![0]!,
      tminC: p.T2M_MIN![0]!,
      rhMeanPct: p.RH2M![0]!,
      u2: p.WS2M![0]!,
      rsMj: p.ALLSKY_SFC_SW_DWN![0]!,
      pressureKpa: p.PS![0]!,
    });

    expect(day1Details.tExtremaMeanC).toBeCloseTo(24.405, 3);
    expect(day1Details.eaKpa).toBeCloseTo(1.622, 2);
    expect(day1Details.raMj).toBeCloseTo(25.764, 2);
    expect(day1Details.rnMj).toBeCloseTo(8.093, 2);
    expect(day1Details.et0Mm).toBeCloseTo(3.390, 2);

    // Day 2: 20250102 (DOY 2)
    const day2Details = penmanMonteithDetails({
      latDeg: lat,
      doy: 2,
      elevationM: elev,
      tmaxC: p.T2M_MAX![1]!,
      tminC: p.T2M_MIN![1]!,
      rhMeanPct: p.RH2M![1]!,
      u2: p.WS2M![1]!,
      rsMj: p.ALLSKY_SFC_SW_DWN![1]!,
      pressureKpa: p.PS![1]!,
    });

    expect(day2Details.tExtremaMeanC).toBeCloseTo(24.470, 3);
    expect(day2Details.eaKpa).toBeCloseTo(1.542, 2);
    expect(day2Details.raMj).toBeCloseTo(25.809, 2);
    expect(day2Details.rnMj).toBeCloseTo(7.530, 2);
    expect(day2Details.et0Mm).toBeCloseTo(3.157, 2);

    // Two-day sum from unrounded daily estimates: 6.548 mm (within tolerance ±0.01 mm)
    const twoDaySum = day1Details.et0Mm + day2Details.et0Mm;
    expect(twoDaySum).toBeCloseTo(6.548, 2);

    // Rainfall sum is 0 mm
    const rainSum = (p.PRECTOTCORR![0] ?? 0) + (p.PRECTOTCORR![1] ?? 0);
    expect(rainSum).toBe(0.0);
  });

  test("fill value replacement in radiation reports missing radiation and does not corrupt valid rain", () => {
    const cloned = JSON.parse(JSON.stringify(rawJson.response));
    // Replace radiation on 20250101 with fill value -999.0
    cloned.properties.parameter.ALLSKY_SFC_SW_DWN["20250101"] = -999.0;
    const parsedWithFill = parsePowerDaily(cloned);
    expect(parsedWithFill.series.ALLSKY_SFC_SW_DWN![0]).toBeNull();
    expect(parsedWithFill.series.PRECTOTCORR![0]).toBe(0.0);
    expect(parsedWithFill.series.PRECTOTCORR![1]).toBe(0.0);
  });

  test("solar energy in kWh/m2/day is converted to MJ/m2/day only when declared as kWh", () => {
    expect(normalizeSolarRadiation(10, "MJ/m^2/day")).toBe(10);
    expect(normalizeSolarRadiation(10, "kWh/m^2/day")).toBe(36);
    expect(normalizeSolarRadiation(10, null)).toBe(10);
  });
});

describe("Priority 1: Verified Myanmar Paddy Demonstration & Irrigation Access", () => {
  const common = { fieldId: "field-myanmar-paddy", region: "ayeyarwady" as const, baseYear: 2026 };
  const currentPaddy = rotation("field-myanmar-paddy", [slot("s1", "rice", "2026-06-01", "2026-10-13")]);

  test("generates rice -> black gram, rice -> green gram, and rice -> fallow as selectable alternatives", () => {
    const res = generateCandidates({ ...common, current: currentPaddy, fieldIrrigation: "none", max: 5 });
    const ids = res.alternatives.map((a) => a.template.id);
    expect(ids).toContain("ay-rice-black-gram");
    expect(ids).toContain("ay-rice-green-gram");
    expect(ids).toContain("ay-rice-fallow");

    const fallowCand = res.alternatives.find((a) => a.template.id === "ay-rice-fallow")!;
    expect(fallowCand.rotation.slots.some((s) => s.kind === "fallow")).toBe(true);
  });

  test("an unavailable irrigation supply excludes irrigated rice with explicit pass-condition reason", () => {
    const res = generateCandidates({ ...common, current: currentPaddy, fieldIrrigation: "none", max: 5 });
    expect(res.alternatives.map((a) => a.template.id)).not.toContain("ay-rice-irrigated-rice");
    const rej = res.rejected.find((r) => r.template.id === "ay-rice-irrigated-rice");
    expect(rej?.reason).toBe("An unavailable irrigation supply excludes irrigated rice.");
  });

  test("a confirmed irrigation supply includes irrigated rice", () => {
    const res = generateCandidates({ ...common, current: currentPaddy, fieldIrrigation: "full", max: 5 });
    const ids = res.alternatives.map((a) => a.template.id);
    expect(ids).toContain("ay-rice-irrigated-rice");
    const irriRice = res.alternatives.find((a) => a.template.id === "ay-rice-irrigated-rice")!;
    expect(irriRice.rotation.slots[1].irrigated).toBe(true);
  });

  test("Priority 2 & Section 28: Compares (A) Climatology vs (B) POWER vs (C) IMERG and isolates timing", () => {
    const dates = ["2025-06-01", "2025-06-02", "2025-06-03", "2025-06-04", "2025-06-05"];
    // (A) Baseline Climatology daily proportions: [2, 2, 2, 2, 2] => Total = 10 mm
    const climDays = dates.map((date) => ({ date, mm: 2 }));
    // (B) Actual daily POWER rainfall: [0, 0, 15, 0, 0] => Total = 15 mm
    const powerDays = dates.map((date, i) => ({ date, mm: i === 2 ? 15 : 0 }));
    // (C) Actual daily IMERG rainfall: [0, 0, 18, 0, 0] => Total = 18 mm
    const imergDays = dates.map((date, i) => ({ date, mm: i === 2 ? 18 : 0 }));

    const comp = compareRainfallSources(climDays, powerDays, imergDays, "2025-06-01", "2025-06-05");
    expect(comp.seasonTotalA_ClimatologyMm).toBe(10);
    expect(comp.seasonTotalB_PowerMm).toBe(15);
    expect(comp.seasonTotalC_ImergMm).toBe(18);

    // B - A: Departure = +5 mm
    expect(comp.departureMm_B_minus_A).toBe(5);
    // C - B: Sensitivity = +3 mm
    expect(comp.productSensitivityMm_C_minus_B).toBe(3);

    // Redistributed observed B season total (15 mm) according to baseline daily proportions (0.2 each)
    expect(comp.timingRedistributedMm).toEqual([3, 3, 3, 3, 3]);
  });
});

describe("Priority 3 & Technical Spec Section B: Water Balance & Hand-Check Synthetic Day", () => {
  test("synthetic day hand-check: 40 mm stored, 10 mm rain, 4 mm ET gives 46 mm stored and 0 residual", () => {
    const step = dailySoilWaterStep(40, 90, 10, 4, 0);
    expect(step.endStorageMm).toBe(46);
    expect(step.drainageMm).toBe(0);
    expect(step.actualEtMm).toBe(4);
    expect(step.unmetDemandMm).toBe(0);
    expect(step.residualMm).toBe(0);
  });

  test("overflow drains excess above storage capacity with strict conservation residual 0", () => {
    // Capacity 45 mm, Start 40 mm, Rain 10 mm, ET 4 mm
    // Infiltration + S = 50 mm > 45 mm => 5 mm drains, accessible = 45 mm, ET = 4 mm => end storage = 41 mm
    const step = dailySoilWaterStep(40, 45, 10, 4, 0);
    expect(step.drainageMm).toBe(5);
    expect(step.endStorageMm).toBe(41);
    expect(step.actualEtMm).toBe(4);
    expect(step.residualMm).toBe(0);
  });

  test("depleted storage limits actual ET and tracks unmet demand with residual 0", () => {
    // Start 2 mm, Capacity 50 mm, Rain 0 mm, Demand 4 mm => actual ET = 2 mm, end storage = 0 mm, unmet = 2 mm
    const step = dailySoilWaterStep(2, 50, 0, 4, 0);
    expect(step.actualEtMm).toBe(2);
    expect(step.endStorageMm).toBe(0);
    expect(step.unmetDemandMm).toBe(2);
    expect(step.residualMm).toBe(0);
  });

  test("FAO-56 Section B worked fixture: TAW=90 mm, RAW=45 mm, Dr=60 mm, Ks=2/3, ETadj=3.5 mm/day", () => {
    const thetaFc = 0.3;
    const thetaWp = 0.15;
    const zr = 0.6;
    const taw = 1000 * (thetaFc - thetaWp) * zr; // 90 mm
    expect(taw).toBeCloseTo(90);

    const p = 0.5;
    const raw = p * taw; // 45 mm
    expect(raw).toBeCloseTo(45);

    const dr = 60;
    const ks = fao56StressCoefficient(taw, raw, dr);
    expect(ks).toBeCloseTo(2 / 3);

    const et0 = 5.0;
    const kcb = 0.9;
    const ke = 0.1;
    const etAdj = (ks * kcb + ke) * et0; // (2/3 * 0.9 + 0.1) * 5 = (0.6 + 0.1) * 5 = 3.5 mm/day
    expect(etAdj).toBeCloseTo(3.5);

    const endDepletion = dr + etAdj;
    expect(endDepletion).toBeCloseTo(63.5);

    // At Dr <= 45, Ks must equal 1
    expect(fao56StressCoefficient(taw, raw, 45)).toBe(1);
    expect(fao56StressCoefficient(taw, raw, 30)).toBe(1);
  });

  test("paddy water balance tracks pond depth, bund spill, seepage/percolation and residual", () => {
    const paddy = paddyWaterBalance({
      initialPondMm: 50,
      maxBundMm: 100,
      rainMm: 80,
      irrigationMm: 0,
      etcMm: 6,
      seepagePercolationMmDay: 3,
    });
    // Inflow = 80 => Pond before loss = 130 mm => spill = 30 mm, retained = 100 mm
    // Loss = 6 + 3 = 9 mm => end pond = 91 mm
    expect(paddy.spillMm).toBe(30);
    expect(paddy.actualEtMm).toBeCloseTo(6);
    expect(paddy.actualSeepagePercolationMm).toBeCloseTo(3);
    expect(paddy.endPondMm).toBeCloseTo(91);
    expect(paddy.residualMm).toBe(0);
  });
});

describe("Priority 4 & Section F: Priority Weights, MCDA, Anchors & Regret", () => {
  const sampleRotations = [
    { rotationId: "r1", feasible: true, values: { "water-shortfall": 50, "soil-legume-share": 0.5, "soil-cover": 0.6 } },
    { rotationId: "r2", feasible: true, values: { "water-shortfall": 10, "soil-legume-share": 1.0, "soil-cover": 0.8 } },
    { rotationId: "r3", feasible: true, values: { "water-shortfall": 80, "soil-legume-share": 0.0, "soil-cover": 0.4 } },
  ];

  test("50/50 water-soil input gives 50% to water and 25% to each of two equally weighted soil indicators", () => {
    const res = rankRotations(sampleRotations, {
      order: ["water", "soil"],
      weights: { water: 50, soil: 50 },
    });
    expect(res.status).toBe("ranked");
    expect(res.weights["water-shortfall"]).toBeCloseTo(0.5);
    expect(res.weights["soil-legume-share"]).toBeCloseTo(0.25);
    expect(res.weights["soil-cover"]).toBeCloseTo(0.25);
  });

  test("missing top priority returns unresolved", () => {
    const missingTop = [
      { rotationId: "r1", feasible: true, values: { "water-shortfall": null, "soil-legume-share": 0.5 } },
      { rotationId: "r2", feasible: true, values: { "water-shortfall": null, "soil-legume-share": 1.0 } },
    ];
    const res = rankRotations(missingTop, { order: ["water", "soil"], weights: { water: 50, soil: 50 } });
    expect(res.status).toBe("unresolved");
    expect(res.ranking).toHaveLength(0);
  });

  test("all zero weights returns no-priorities", () => {
    const res = rankRotations(sampleRotations, {
      order: ["water", "soil"],
      weights: { water: 0, soil: 0 },
    });
    expect(res.status).toBe("no-priorities");
  });

  test("anchorUtility scales values monotonically against interpretable bounds", () => {
    // Lower is better: target = 10 (utility 1), upper = 60 (utility 0)
    expect(anchorUtility(10, 10, 60, "lower")).toBe(1.0);
    expect(anchorUtility(60, 10, 60, "lower")).toBe(0.0);
    expect(anchorUtility(35, 10, 60, "lower")).toBeCloseTo(0.5);
    expect(anchorUtility(5, 10, 60, "lower")).toBe(1.0); // clamped at 1
    expect(anchorUtility(70, 10, 60, "lower")).toBe(0.0); // clamped at 0
  });

  test("Section F switching point analysis: ties at w = 3/7, A leads by 0.05 at 50% water", () => {
    // A: water 0.8, income 0.4
    // B: water 0.4, income 0.7
    // A - B = 0.7w - 0.3 => ties at w = 3/7
    const wTie = switchingPoint({ u1: 0.8, u2: 0.4 }, { u1: 0.4, u2: 0.7 });
    expect(wTie).not.toBeNull();
    expect(wTie!).toBeCloseTo(3 / 7, 5);

    // At w = 0.5: Score(A) = 0.5*0.8 + 0.5*0.4 = 0.60; Score(B) = 0.5*0.4 + 0.5*0.7 = 0.55 => diff = 0.05
    const scoreA = 0.5 * 0.8 + 0.5 * 0.4;
    const scoreB = 0.5 * 0.4 + 0.5 * 0.7;
    expect(scoreA - scoreB).toBeCloseTo(0.05, 5);
  });

  test("Worked Fixture H5: Minimax regret under uncertain prices and weather", () => {
    const candidates = [
      { candidateId: "rice-black-gram", utilities: { dry: 0.7, typical: 0.55 } },
      { candidateId: "rice-green-gram", utilities: { dry: 0.6, typical: 0.8 } },
    ];
    const regret = minimaxRegret(candidates, ["dry", "typical"]);

    // In dry year: max is 0.70 => black gram regret = 0, green gram regret = 0.10
    // In typical year: max is 0.80 => black gram regret = 0.25, green gram regret = 0
    const bg = regret.table.find((r) => r.candidateId === "rice-black-gram")!;
    const gg = regret.table.find((r) => r.candidateId === "rice-green-gram")!;

    expect(bg.regrets.dry).toBeCloseTo(0.0, 3);
    expect(bg.regrets.typical).toBeCloseTo(0.25, 3);
    expect(bg.worstRegret).toBeCloseTo(0.25, 3);

    expect(gg.regrets.dry).toBeCloseTo(0.1, 3);
    expect(gg.regrets.typical).toBeCloseTo(0.0, 3);
    expect(gg.worstRegret).toBeCloseTo(0.1, 3);

    // Green gram minimizes worst regret
    expect(regret.bestCandidateId).toBe("rice-green-gram");
  });
});

describe("Technical Spec Section A: Economics & Discontinuity Fix", () => {
  test("annualizing margin with exact occupied cycle days avoids integer year rounding cliff", () => {
    const margin: [number, number] = [1_000_000, 1_000_000];
    const ann547 = annualizeMargin(margin, 547);
    const ann548 = annualizeMargin(margin, 548);

    expect(ann547).not.toBeNull();
    expect(ann548).not.toBeNull();
    // In the old algorithm: Math.ceil(547/365)=2 vs Math.ceil(548/365)=2, or rounding cliff caused 1,000,000 vs 500,000.
    // In the corrected continuous formulation, difference between 547 and 548 days is less than 0.2%:
    expect(Math.abs(ann547![0] - ann548![0])).toBeLessThan(2000);
    expect(ann547![0]).toBeCloseTo((1_000_000 * 365.2425) / 547, 0);
  });

  test("break-even price is variable costs over saleable yield", () => {
    expect(breakEvenPrice(300_000, 500)).toBe(600); // 600 MMK/kg
    expect(breakEvenPrice(300_000, 0)).toBeNull(); // undefined for zero yield
  });
});

describe("Technical Spec Section C: Phenology, GDD & Sowing without Hindsight", () => {
  test("daily GDD clamps BOTH extrema to [Tb, Tu], producing ceiling of 20 degree-days (not 21)", () => {
    // Tb = 10, Tu = 30, Tmin = 32, Tmax = 38
    // Clamped Tmax = 30, Clamped Tmin = 30 => GDD = (30 + 30)/2 - 10 = 20 degree-days
    const gdd = dailyGdd(38, 32, 10, 30);
    expect(gdd).toBe(20);
  });

  test("stageWindows prevents day loss from independent rounding on a 10-day cycle", () => {
    const crop = getCropById("rice")!;
    // 10 day window from 2026-06-01 to 2026-06-10
    const stages = stageWindows(crop, "2026-06-01", "2026-06-10");
    expect(stages).toHaveLength(4);
    expect(stages[0].from).toBe("2026-06-01");
    expect(stages[3].to).toBe("2026-06-10");

    let totalDays = 0;
    for (const st of stages) {
      const d = (Date.parse(st.to) - Date.parse(st.from)) / 86_400_000 + 1;
      totalDays += d;
    }
    expect(totalDays).toBe(10);
  });
});

describe("Technical Spec Section D: Soil, Cover and Nutrient Indicators", () => {
  test("layered TAW sums available water capacity across depth horizons", () => {
    const layers = [
      { thetaFc: 0.3, thetaWp: 0.15, thicknessM: 0.2 }, // 1000 * 0.15 * 0.2 = 30 mm
      { thetaFc: 0.25, thetaWp: 0.15, thicknessM: 0.4 }, // 1000 * 0.10 * 0.4 = 40 mm
    ];
    const taw = layeredWaterCapacity(layers, 0.6);
    expect(taw).toBeCloseTo(70);
  });

  test("dry grain N removal: 1,000 kg/ha @ 15% moisture & 3% N removes 25.5 kg N/ha", () => {
    const nRemoved = dryGrainNRemoval(1000, 0.15, 0.03);
    expect(nRemoved).toBeCloseTo(25.5);
  });

  test("Worked Fixture H4: Bound a partial nitrogen budget", () => {
    // F in [35, 55], G in [25, 35], R in [5, 15] => [-15, +25] kg N/ha
    const budget = partialNitrogenBudgetEnclosure([35, 55], [25, 35], [5, 15]);
    expect(budget).toEqual([-15, 25]);

    // Under residue retention R = 0: [0, 30] kg N/ha
    const retainedBudget = partialNitrogenBudgetEnclosure([35, 55], [25, 35], [0, 0]);
    expect(retainedBudget).toEqual([0, 30]);
  });
});

describe("Worked Fixtures H1 through H6 Implementation Tests", () => {
  test("Worked Fixture H1: How rainfall timing changes stress at equal seasonal rainfall (12 mm)", () => {
    // C = 10, S = 2, E = 4
    // Rain history (4, 4, 4)
    const run1 = timingBucketModel(10, 2, 4, [4, 4, 4]);
    expect(run1.endStorage).toEqual([2, 2, 2]);
    expect(run1.totalDrainageMm).toBe(0);
    expect(run1.totalUnmetDemandMm).toBe(0);
    expect(run1.conservationResidualMm).toBe(0);

    // Rain history (12, 0, 0)
    const run2 = timingBucketModel(10, 2, 4, [12, 0, 0]);
    expect(run2.endStorage).toEqual([6, 2, 0]);
    expect(run2.totalDrainageMm).toBe(4);
    expect(run2.totalUnmetDemandMm).toBe(2);
    expect(run2.conservationResidualMm).toBe(0);
  });

  test("Worked Fixture H2: Convert irrigation depth into a pumping decision", () => {
    // a = 2 ha, D = 15 mm net, eta = 0.75, q = 20 m3/h
    // V_gross = 10 * 2 * 15 / 0.75 = 400 m3
    // h = 400 / 20 = 20 hours
    // With 16 hours available: max net depth = 12 mm, shortfall = 3 mm
    const pump = pumpingDecision({
      netDepthMm: 15,
      areaHa: 2,
      efficiency: 0.75,
      pumpRateM3H: 20,
      hoursAvailable: 16,
    });
    expect(pump.grossVolumeM3).toBe(400);
    expect(pump.requiredPumpHours).toBe(20);
    expect(pump.maxNetDepthMm).toBe(12);
    expect(pump.shortfallMm).toBe(3);
  });

  test("Worked Fixture H3: Compute coverage before reporting a field average", () => {
    // 1 ha parcel, 3 pixels: 0.5 ha @ 0.60 NDVI, 0.3 ha @ 0.20 NDVI, 0.2 ha cloudy
    const pixels = [
      { areaHa: 0.5, usable: true, value: 0.6 },
      { areaHa: 0.3, usable: true, value: 0.2 },
      { areaHa: 0.2, usable: false, value: null },
    ];
    const cov = areaWeightedCoverage(1.0, pixels);
    expect(cov.coverageFraction).toBeCloseTo(0.8);
    expect(cov.validMean).toBeCloseTo(0.45);

    // All cloudy: coverage 0, mean null
    const allCloud = areaWeightedCoverage(1.0, [{ areaHa: 1.0, usable: false, value: null }]);
    expect(allCloud.coverageFraction).toBe(0);
    expect(allCloud.validMean).toBeNull();
  });

  test("Section E: water fraction among clear pixels before excluding water pixels", () => {
    // 10 clear pixels: 6 water, 4 land => 60% water fraction
    const metrics = computeFieldSceneMetrics(10, 0, 6, 4);
    expect(metrics.waterFractionAmongClear).toBeCloseTo(0.6);
    expect(metrics.clearPixels).toBe(10);
    expect(metrics.validLandPixels).toBe(4);
  });

  test("Worked Fixture H6: Quantify whether daily rainfall improved a held-out result", () => {
    // Observed y = [20, 40, 30]
    // Baseline b = [30, 35, 45]
    // Daily m = [22, 32, 33]
    // Baseline errors = [10, 5, 15] (MAE 10)
    // Daily model errors = [2, 8, 3] (MAE 13/3)
    // Paired improvements d = [8, -3, 12]
    // Delta_MAE = 17/3 mm
    const comp = pairedImprovementMae([20, 40, 30], [30, 35, 45], [22, 32, 33]);
    expect(comp.baselineMae).toBe(10);
    expect(comp.modelMae).toBeCloseTo(13 / 3, 4);
    expect(comp.pairedImprovements).toEqual([8, -3, 12]);
    expect(comp.meanImprovementMae).toBeCloseTo(17 / 3, 4);
  });
});
