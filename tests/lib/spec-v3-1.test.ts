import { describe, expect, test } from "vitest";
import {
  dailySoilWaterStep,
  postWettingKs,
  redistributeAtRootChange,
  rootZoneBalance,
  twoZoneCapacities,
  twoZoneStep,
  uplandStartAfterPaddy,
  type TwoZoneColumn,
  type TwoZoneState,
} from "../../lib/engine/water";
import { organicMatterPct, saxtonRawls } from "../../lib/soil/pedotransfer";
import { parseSoilGrids, usdaTexture, type SoilProfile } from "../../lib/soil/soilgrids";
import { effectiveSoil } from "../../lib/engine/soil-input";
import { anchorUtility, criterionUtility, CRITERIA, minimaxRegret, rankRotations, relativeUtility, switchingPoint } from "../../lib/engine/mcda";
import { gddStageWindows, replayWindows } from "../../lib/engine/season";
import type { DailyRecord } from "../../lib/engine/climate";
import { areaWeightedCoverage, MIN_VALID_COVERAGE, summariseHls } from "../../lib/nasa/derive/ndvi";
import { getCropById } from "../../lib/data/crops";
import type { Crop, SoilObservation } from "../../lib/types";
import { syntheticField } from "../helpers/synthetic";

/** Section 4.2: Ks is evaluated on storage after wetting, and throttles demand before extraction. */
describe("Phase 1.1: coupled Ks", () => {
  test("Ks is 1 above (1 - p) C, linear below it, 0 when nothing is reachable", () => {
    expect(postWettingKs(50, 100, 0.5)).toBe(1);
    expect(postWettingKs(25, 100, 0.5)).toBeCloseTo(0.5, 12);
    expect(postWettingKs(0, 100, 0.5)).toBe(0);
    expect(postWettingKs(10, 0, 0.5)).toBe(1); // no capacity: nothing to throttle against, nothing to extract
    expect(postWettingKs(1, 100, null)).toBe(1);
  });

  test("rain on the same day lifts the throttle: Ks uses post-wetting storage, not the morning's", () => {
    // 10 mm stored of 100 (p = 0.5, threshold 50). Without rain Ks = 10/50 = 0.2.
    const dry = dailySoilWaterStep(10, 100, 0, 5, 0);
    expect(dry.stressCoefficient).toBeCloseTo(0.2, 12);
    expect(dry.actualEtMm).toBeCloseTo(1, 12);
    // 45 mm of rain first: B = 55 >= 50, so Ks = 1 and the crop gets its full 5 mm. Reading Ks from the pre-wetting
    // 10 mm would have wrongly cut this to 1 mm on a day it rained 45 mm.
    const wet = dailySoilWaterStep(10, 100, 45, 5, 0);
    expect(wet.stressCoefficient).toBe(1);
    expect(wet.actualEtMm).toBe(5);
    expect(wet.endStorageMm).toBe(50);
    expect(wet.residualMm).toBe(0);
  });

  test("a crop can no longer take the potential rate all the way to wilting point", () => {
    let s = 100;
    let atPotential = 0;
    for (let d = 0; d < 60; d++) {
      const r = dailySoilWaterStep(s, 100, 0, 5, 0);
      if (r.actualEtMm === 5) atPotential++;
      s = r.endStorageMm;
    }
    // 11 days start at or above (1 - p) C = 50 mm and run at the full rate (storage 100, 95, ... 50); after that it tails off and never reaches zero
    expect(atPotential).toBe(11);
    expect(s).toBeGreaterThan(0);
  });
});

/** Section 4.2.1: one fixed column, split at the rooting depth. */
describe("Phase 1.2: two-zone column", () => {
  const col: TwoZoneColumn = { awcMmPerM: 120, rootDepthM: 0.4, maxDepthM: 1.0 };

  test("capacities follow the split: AWC x Zr and AWC x (Zmax - Zr)", () => {
    const c = twoZoneCapacities(col);
    expect(c.rootMm).toBeCloseTo(48, 10);
    expect(c.subMm).toBeCloseTo(72, 10);
  });

  test("drainage cascades root zone to buffer to the outside, and only the last is lost", () => {
    const r = twoZoneStep({ rootMm: 48, subMm: 70 }, col, 10, 5, 0);
    expect(r.rootDrainageMm).toBe(10); // root zone is full, all 10 mm drain out of it
    expect(r.deepDrainageMm).toBe(8); // buffer takes 2 mm to reach its 72, 8 mm leave the column
    expect(r.state.subMm).toBe(72);
    expect(r.state.rootMm).toBe(43);
    expect(r.actualEtMm).toBe(5);
    expect(r.residualMm).toBe(0);
  });

  test("a deepening root takes its share of the buffer, and the total does not move", () => {
    // 0.4 -> 0.6 m in a 1.0 m column: a third (0.2 of 0.6) of the buffer joins the root zone
    const after = redistributeAtRootChange({ rootMm: 20, subMm: 36 }, 0.4, 0.6, 1.0);
    expect(after.rootMm).toBeCloseTo(32, 10);
    expect(after.subMm).toBeCloseTo(24, 10);
    expect(after.rootMm + after.subMm).toBeCloseTo(56, 10);
  });

  test("a shallower root hands the water below it to the buffer, and the total does not move", () => {
    const after = redistributeAtRootChange({ rootMm: 30, subMm: 10 }, 0.6, 0.3, 1.0);
    expect(after.rootMm).toBeCloseTo(15, 10);
    expect(after.subMm).toBeCloseTo(25, 10);
  });

  test("water is conserved through a year of rain, three crops and every change of rooting depth", () => {
    const awc = 110;
    const zmax = 0.9;
    const depths = [0.3, 0.9, 0.6];
    let seed = 12345;
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
    let zr = depths[0];
    let state: TwoZoneState = { rootMm: 0.5 * awc * zr, subMm: 0.5 * awc * (zmax - zr) };
    let storedBefore = state.rootMm + state.subMm;
    let rainIn = 0;
    let deepOut = 0;
    let etOut = 0;
    const start = storedBefore;
    for (let day = 0; day < 365; day++) {
      if (day > 0 && day % 60 === 0) {
        const next = depths[(day / 60) % depths.length];
        const moved = redistributeAtRootChange(state, zr, next, zmax);
        expect(moved.rootMm + moved.subMm).toBeCloseTo(state.rootMm + state.subMm, 9);
        expect(moved.rootMm).toBeLessThanOrEqual(awc * next + 1e-9);
        expect(moved.subMm).toBeLessThanOrEqual(awc * (zmax - next) + 1e-9);
        state = moved;
        zr = next;
      }
      const rain = rnd() < 0.2 ? rnd() * 45 : 0;
      const demand = 3 + rnd() * 4;
      const column = { awcMmPerM: awc, rootDepthM: zr, maxDepthM: zmax };
      const r = twoZoneStep(state, column, rain, demand, 0);
      expect(r.residualMm).toBe(0);
      rainIn += rain;
      deepOut += r.deepDrainageMm;
      etOut += r.actualEtMm;
      state = r.state;
      storedBefore = state.rootMm + state.subMm;
    }
    expect(storedBefore - start).toBeCloseTo(rainIn - deepOut - etOut, 6);
  });

  test("a single rooting depth has no buffer and matches the one-bucket step", () => {
    const one = twoZoneStep({ rootMm: 30, subMm: 0 }, { awcMmPerM: 100, rootDepthM: 0.6, maxDepthM: 0.6 }, 20, 6, 0);
    const bucket = dailySoilWaterStep(30, 60, 20, 6, 0);
    expect(one.state.rootMm).toBeCloseTo(bucket.endStorageMm, 12);
    expect(one.deepDrainageMm).toBeCloseTo(bucket.drainageMm, 12);
    expect(one.actualEtMm).toBeCloseTo(bucket.actualEtMm, 12);
  });

  test("paddy to upland: a pond left at harvest starts the upland column at field capacity and is booked as drainage", () => {
    const start = uplandStartAfterPaddy(40, col);
    expect(start).not.toBeNull();
    expect(start?.state).toEqual({ rootMm: 48, subMm: 72 });
    expect(start?.surfaceDrainageMm).toBe(40);
    expect(uplandStartAfterPaddy(0, col)).toBeNull(); // no pond: keep the state the caller has
  });

  test("the root-zone balance with a deeper rotation column loses nothing to a buffer it never fills", () => {
    const win = { from: "2026-06-01", to: "2026-06-05" };
    const etc = new Map(Array.from({ length: 5 }, (_, i) => [`2026-06-0${i + 1}`, 4] as const));
    const shallow = rootZoneBalance({ awcMmPerM: 100, rootDepthM: 0.3, initialDepletionMm: 0, irrigationMm: 0 }, win, etc, new Map());
    const deepColumn = rootZoneBalance({ awcMmPerM: 100, rootDepthM: 0.3, maxRootDepthM: 0.9, initialDepletionMm: 0, irrigationMm: 0 }, win, etc, new Map());
    if (shallow.status !== "ok" || deepColumn.status !== "ok") throw new Error("expected ok");
    expect(deepColumn.tawMm).toBeCloseTo(shallow.tawMm, 10); // TAW is the root zone's, not the column's
    expect(deepColumn.actualEtMm).toBeCloseTo(shallow.actualEtMm, 10);
    expect(deepColumn.assumptions.join(" ")).toMatch(/below the roots/i);
  });
});

describe("Phase 2.1: Saxton-Rawls pedotransfer", () => {
  test("organic matter is converted to PERCENT: 14.5 g/kg organic carbon is 2.5 % organic matter", () => {
    expect(organicMatterPct(14.5)).toBeCloseTo(2.5, 3);
  });

  test("a loam (sand 40 %, clay 20 %, OM 2.5 %) matches the equations worked by hand", () => {
    const r = saxtonRawls({ sand: 0.4, clay: 0.2, omPct: 2.5 });
    expect(r?.thetaWp).toBeCloseTo(0.1370236, 6);
    expect(r?.thetaFc).toBeCloseTo(0.2796102, 6);
    expect(r?.awcMmPerM).toBeCloseTo(142.587, 2);
  });

  test("feeding organic matter as a fraction (0.025) would understate the loam's AWC by about 8 %", () => {
    const right = saxtonRawls({ sand: 0.4, clay: 0.2, omPct: 2.5 })!.awcMmPerM;
    const wrong = saxtonRawls({ sand: 0.4, clay: 0.2, omPct: 0.025 })!.awcMmPerM;
    expect(right - wrong).toBeGreaterThan(11);
    expect((right - wrong) / right).toBeGreaterThan(0.07);
  });

  test("coarse soils hold less than fine ones, and a sandy soil is plausible at about 60 mm/m", () => {
    const sand = saxtonRawls({ sand: 0.8, clay: 0.1, omPct: 1 })!;
    const clayey = saxtonRawls({ sand: 0.2, clay: 0.55, omPct: 3 })!;
    expect(sand.awcMmPerM).toBeCloseTo(60.19, 1);
    expect(clayey.awcMmPerM).toBeCloseTo(113.85, 1);
    expect(sand.thetaFc).toBeLessThan(clayey.thetaFc);
  });

  test("inputs outside what the equations were fitted on give null, never a guess", () => {
    expect(saxtonRawls({ sand: 0.6, clay: 0.5, omPct: 2 })).toBeNull(); // fractions above 1
    expect(saxtonRawls({ sand: 0.2, clay: 0.2, omPct: 12 })).toBeNull(); // organic soil
    expect(saxtonRawls({ sand: 0.1, clay: 0.7, omPct: 2 })).toBeNull(); // clay above 60 %
    expect(saxtonRawls({ sand: Number.NaN, clay: 0.2, omPct: 2 })).toBeNull();
  });
});

describe("Phase 2.1: SoilGrids water-retention layers", () => {
  const layer = (name: string, means: [number, number, number], dFactor = 10, units = "10-2 cm³/cm³") => ({
    name,
    unit_measure: { d_factor: dFactor, mapped_units: "(10-2 cm³/cm³)*10", target_units: units, uncertainty_unit: "" },
    depths: [
      { label: "0-5cm", values: { mean: means[0] } },
      { label: "5-15cm", values: { mean: means[1] } },
      { label: "15-30cm", values: { mean: means[2] } },
    ],
  });
  const clay = layer("clay", [250, 260, 270], 10, "%");
  // Shape and values taken from a live rest.isric.org response for a Magway-region point.
  const response = (extra: unknown[]) => ({ properties: { layers: [clay, ...extra] } });

  test("reads the API's own units: raw 304 with d_factor 10 is 30.4 % by volume, 0.304 m3/m3", () => {
    const p = parseSoilGrids(response([layer("wv0033", [304, 299, 300]), layer("wv1500", [172, 174, 177])]))!;
    // thickness-weighted over 0 to 30 cm: (30.4 x 5 + 29.9 x 10 + 30.0 x 15) / 30 = 30.033 %
    expect(p.fieldCapacityFrac).toBeCloseTo(0.300333, 5);
    expect(p.wiltingPointFrac).toBeCloseTo(0.175167, 5);
  });

  test("a layer in an unrecognised unit is refused rather than rescaled by guesswork", () => {
    const p = parseSoilGrids(response([layer("wv0033", [304, 299, 300], 10, "g/kg"), layer("wv1500", [172, 174, 177])]))!;
    expect(p.fieldCapacityFrac).toBeNull();
    expect(p.wiltingPointFrac).toBeCloseTo(0.175167, 5);
  });

  test("a profile without retention layers still parses, with the new fields null", () => {
    const p = parseSoilGrids(response([]))!;
    expect(p.fieldCapacityFrac).toBeNull();
    expect(p.wiltingPointFrac).toBeNull();
  });
});

describe("Phase 2.1: two-tier plant-available water", () => {
  const obs = (property: SoilObservation["property"], value: number | string, units: string, method: SoilObservation["method"] = "laboratory"): SoilObservation => ({
    id: `o-${property}`, property, value, units, depthCm: [0, 20], date: "2026-05-01", method, source: "Lab report",
  });
  const profile: SoilProfile = {
    clayPct: 25, sandPct: 40, siltPct: 35, ph: 6.5, socGKg: 12, cecCmolKg: null, bulkDensityKgDm3: null, nitrogenGKg: null,
    fieldCapacityFrac: 0.3, wiltingPointFrac: 0.175, texture: "loam",
    source: { dataset: "ISRIC SoilGrids v2", resolution: "250 m", depth: "0 to 30 cm" },
  };
  const lab = [obs("sand", 40, "%"), obs("clay", 20, "%"), obs("organic-carbon", 1.45, "%")];

  test("tier 1: the farmer's own sand, clay and organic carbon give Saxton-Rawls", () => {
    const awc = effectiveSoil(syntheticField({ soilObservations: lab }), profile).awcMmPerM;
    expect(awc?.from).toBe("farmer-ptf");
    expect(awc?.value).toBeCloseTo(142.6, 0);
    expect(awc?.note).toMatch(/Saxton and Rawls/);
  });

  test("when SoilGrids is unavailable, farmer measurements still calculate available water capacity", () => {
    const soil = effectiveSoil(syntheticField({ soilObservations: lab }), null);
    expect(soil.soilGridsAvailable).toBe(false);
    expect(soil.awcMmPerM).toMatchObject({ from: "farmer-ptf" });
    expect(soil.awcMmPerM?.value).toBeCloseTo(142.6, 0);
  });

  test("tier 1 does not borrow organic carbon from a soil map: without it the grid values are used and labelled", () => {
    const awc = effectiveSoil(syntheticField({ soilObservations: [obs("sand", 40, "%"), obs("clay", 20, "%")] }), profile).awcMmPerM;
    expect(awc?.from).toBe("soilgrids");
    expect(awc?.value).toBeCloseTo(125, 5);
  });

  test("tier 2: with no farmer test the SoilGrids retention layers give 1000 x (FC - WP)", () => {
    const awc = effectiveSoil(syntheticField({ soilObservations: [] }), profile).awcMmPerM;
    expect(awc).toMatchObject({ from: "soilgrids" });
    expect(awc?.value).toBeCloseTo(125, 5);
  });

  test("a value the farmer entered for water capacity beats both", () => {
    const awc = effectiveSoil(syntheticField({ soilObservations: [...lab, obs("available-water-capacity", 90, "mm/m")] }), profile).awcMmPerM;
    expect(awc).toMatchObject({ from: "farmer", value: 90 });
  });

  test("no farmer test and no retention layers: unknown, not defaulted", () => {
    const bare = { ...profile, fieldCapacityFrac: null, wiltingPointFrac: null };
    expect(effectiveSoil(syntheticField({ soilObservations: [] }), bare).awcMmPerM).toBeNull();
    expect(effectiveSoil(syntheticField({ soilObservations: [] }), null).awcMmPerM).toBeNull();
  });
});

describe("Phase 2.2: USDA texture order (Sandy Clay is decided before the Clay >= 40 split)", () => {
  test.each([
    [50, 12, 38, "sandy clay"], // clay below 40 and sand above 45: the case the old flowchart sent elsewhere
    [50, 5, 45, "sandy clay"], // clay above 40 with sand above 45 is still Sandy Clay
    [30, 25, 45, "clay"],
    [20, 40, 40, "silty clay"],
  ] as const)("sand %i, silt %i, clay %i is %s", (sand, silt, clay, expected) => {
    expect(usdaTexture(sand, silt, clay)).toBe(expected);
  });
});

describe("Phase 3.1: anchor utility is primary", () => {
  test("negligible differences between options stay negligible instead of stretching over 0 to 1", () => {
    const res = rankRotations(
      [10, 12, 14].map((v, i) => ({ rotationId: `r${i}`, feasible: true, values: { "water-shortfall": v } })),
      { order: ["water"], weights: {} },
    );
    expect(res.ranking.map((r) => r.rotationId)).toEqual(["r0", "r1", "r2"]);
    const spread = res.ranking[0].score - res.ranking[2].score;
    expect(spread).toBeCloseTo(0.01, 10); // 4 mm out of a 400 mm scale; min-max would have said 1.0
  });

  test("every criterion except money has anchors, and each says it is an assumption", () => {
    for (const c of CRITERIA) {
      if (c.id === "income-margin") expect(c.anchor).toBeUndefined();
      else expect(c.anchor).toMatchObject({ scope: "analyst-assumption" });
    }
    const water = CRITERIA.find((c) => c.id === "water-shortfall")!;
    expect(criterionUtility(water, 100, [100, 200])).toBeCloseTo(anchorUtility(100, 0, 400, "lower"), 12);
  });

  test("an anchored criterion that ties is kept: equal values still mean something against a target", () => {
    const res = rankRotations(
      [0, 1, 0.5].map((v, i) => ({ rotationId: `r${i}`, feasible: true, values: { "soil-legume-share": v, "soil-cover": 0.75 } })),
      { order: ["soil"], weights: {} },
    );
    expect(res.used).toContain("soil-cover");
    expect(res.excluded.find((e) => e.criterion === "soil-cover")).toBeUndefined();
  });

  test("zero-variance guard: when all options tie on a relative scale the utility is 1, never 0/0", () => {
    expect(relativeUtility(5, [5, 5, 5], "higher")).toBe(1);
    expect(relativeUtility(5, [5, 5, 5], "lower")).toBe(1);
    expect(relativeUtility(5, [5 + 1e-12, 5], "higher")).toBe(1);
    expect(relativeUtility(3, [1, 3, 5], "higher")).toBeCloseTo(0.5, 12);
    expect(relativeUtility(1, [1, 3, 5], "lower")).toBeCloseTo(1, 12);
  });
});

describe("Phase 3.2: scoped non-imputation", () => {
  const opt = (id: string, values: Record<string, number | null>) => ({ rotationId: id, feasible: true, values });

  test("an option missing evidence on a lower priority is set apart; the rest are ranked on all criteria", () => {
    const res = rankRotations(
      [
        opt("a", { "water-shortfall": 50, "income-margin": 100 }),
        opt("b", { "water-shortfall": 150, "income-margin": 300 }),
        opt("minor", { "water-shortfall": 20, "income-margin": null }),
      ],
      { order: ["water", "income"], weights: {} },
    );
    expect(res.status).toBe("ranked");
    expect(res.used).toEqual(expect.arrayContaining(["water-shortfall", "income-margin"]));
    expect(res.ranking.map((r) => r.rotationId).sort()).toEqual(["a", "b"]);
    expect(res.partial).toHaveLength(1);
    expect(res.partial[0]).toMatchObject({ rotationId: "minor", missing: ["income-margin"], lacksTopPriority: false });
    expect(res.note).toMatch(/One option is not ranked/);
  });

  test("the halt is kept: an option with no evidence at all on the first priority leaves no winner declared", () => {
    const res = rankRotations(
      [
        opt("a", { "water-shortfall": 50, "income-margin": 100 }),
        opt("b", { "water-shortfall": 150, "income-margin": 300 }),
        opt("minor", { "water-shortfall": null, "income-margin": 250 }),
      ],
      { order: ["water", "income"], weights: {} },
    );
    expect(res.status).toBe("unresolved");
    expect(res.ranking).toHaveLength(0);
    expect(res.partial[0]).toMatchObject({ rotationId: "minor", lacksTopPriority: true });
  });

  test("the halt is kept when nobody has evidence on the first priority", () => {
    const res = rankRotations(
      [opt("a", { "income-margin": 100 }), opt("b", { "income-margin": 300 })],
      { order: ["water", "income"], weights: {} },
    );
    expect(res.status).toBe("unresolved");
  });

  test("with fewer than two complete options nothing is set apart: only criteria every option has are used, as in v3.0", () => {
    const res = rankRotations(
      [
        opt("a", { "water-shortfall": 50, "soil-legume-share": 0.5, "soil-cover": 0.9 }),
        opt("b", { "water-shortfall": 80, "soil-legume-share": null, "soil-cover": 0.7 }),
        opt("c", { "water-shortfall": null, "soil-legume-share": 0.2, "soil-cover": 0.6 }),
      ],
      { order: ["soil", "water"], weights: {} },
    );
    expect(res.status).toBe("ranked");
    expect(res.partial).toHaveLength(0);
    expect(res.used).toEqual(["soil-cover"]);
    expect(res.excluded.filter((e) => e.reason === "missing-evidence").map((e) => e.criterion).sort()).toEqual(["soil-legume-share", "water-shortfall"]);
    expect(res.ranking).toHaveLength(3);
  });
});

describe("Phase 3.3: tail-risk percentile regret", () => {
  test("minimax picks the option with the smaller worst season; P90 picks the one that is rarely bad", () => {
    const scenarios = Array.from({ length: 10 }, (_, i) => `s${i + 1}`);
    // A is best in nine seasons and loses badly in one; B is steadily a little worse everywhere except that one.
    const a = { candidateId: "A", utilities: Object.fromEntries(scenarios.map((s) => [s, s === "s10" ? 0.5 : 1.0])) };
    const b = { candidateId: "B", utilities: Object.fromEntries(scenarios.map((s) => [s, s === "s10" ? 0.8 : 0.8])) };
    const r = minimaxRegret([a, b], scenarios);
    const ra = r.table.find((x) => x.candidateId === "A")!;
    const rb = r.table.find((x) => x.candidateId === "B")!;
    expect(ra.worstRegret).toBeCloseTo(0.3, 3);
    expect(rb.worstRegret).toBeCloseTo(0.2, 3);
    expect(ra.p90Regret).toBeCloseTo(0.03, 3); // one bad season in ten barely moves the 90th percentile
    expect(rb.p90Regret).toBeCloseTo(0.2, 3);
    expect(r.bestCandidateId).toBe("B");
    expect(r.bestByP90CandidateId).toBe("A");
  });

  test("when the two agree there is one answer, and the existing minimax table order is unchanged", () => {
    const r = minimaxRegret(
      [
        { candidateId: "x", utilities: { dry: 0.7, typical: 0.55 } },
        { candidateId: "y", utilities: { dry: 0.6, typical: 0.8 } },
      ],
      ["dry", "typical"],
    );
    expect(r.bestCandidateId).toBe("y");
    expect(r.bestByP90CandidateId).toBe("y");
    expect(r.table.map((t) => t.candidateId)).toEqual(["y", "x"]);
  });
});

describe("Phase 4: thermal-time stage transitions", () => {
  const rec = (date: string, tmax: number, tmin: number): DailyRecord => {
    const d = new Date(`${date}T00:00:00Z`);
    return { date, year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, doy: 1, tmaxC: tmax, tminC: tmin, tmeanC: (tmax + tmin) / 2, rainMm: 0, et0Mm: null, rootWetness: null };
  };
  const days = (from: string, n: number, tmax: number, tmin: number | ((i: number) => number)) =>
    Array.from({ length: n }, (_, i) => rec(new Date(Date.parse(from) + i * 86_400_000).toISOString().slice(0, 10), tmax, typeof tmin === "function" ? tmin(i) : tmin));
  const base = getCropById("sesame") as Crop;
  const thermal: Crop = { ...base, gdd: { baseC: 10, toMaturity: 1200, upperC: 30, stageEndGdd: { ini: 150, dev: 500, mid: 900 } } };
  const from = "2025-06-01";
  const to = "2025-09-08"; // 100 days

  test("stages end on the day cumulative GDD reaches the thresholds (15 GDD a day: days 10, 34 and 60)", () => {
    const w = gddStageWindows(thermal, from, to, days(from, 100, 30, 20))!;
    expect(w.map((x) => x.id)).toEqual(["ini", "dev", "mid", "late"]);
    expect(w[0]).toEqual({ id: "ini", from: "2025-06-01", to: "2025-06-10" });
    expect(w[1]).toEqual({ id: "dev", from: "2025-06-11", to: "2025-07-04" });
    expect(w[2]).toEqual({ id: "mid", from: "2025-07-05", to: "2025-07-30" });
    expect(w[3]).toEqual({ id: "late", from: "2025-07-31", to: to });
  });

  test("a hotter season reaches every stage sooner than a cooler one; the harvest date stays put", () => {
    const cool = gddStageWindows(thermal, from, to, days(from, 100, 30, 20))!;
    // tmax above the cutoff is clamped to 30, tmin 26: 18 GDD a day instead of 15
    const hot = gddStageWindows(thermal, from, to, days(from, 100, 36, 26))!;
    for (let k = 0; k < 3; k++) expect(hot[k].to < cool[k].to).toBe(true);
    expect(hot[3].to).toBe(to);
  });

  test("the stages tile the window with no gap and no overlap", () => {
    const w = gddStageWindows(thermal, from, to, days(from, 100, 30, 20))!;
    for (let k = 1; k < 4; k++) expect(Date.parse(w[k].from) - Date.parse(w[k - 1].to)).toBe(86_400_000);
    expect(w[0].from).toBe(from);
    expect(w[3].to).toBe(to);
  });

  test("calendar fallback: unknown thermal requirements, a day with no temperature, or thresholds never reached", () => {
    expect(gddStageWindows(base, from, to, days(from, 100, 30, 20))).toBeNull();
    const gap = days(from, 100, 30, 20);
    gap[40] = { ...gap[40], tmaxC: null };
    expect(gddStageWindows(thermal, from, to, gap)).toBeNull();
    expect(gddStageWindows(thermal, from, to, days(from, 100, 12, 8))).toBeNull();
    expect(gddStageWindows(thermal, from, to, [])).toBeNull();
  });

  test("replayWindows labels which basis each year used, and uses the calendar split when thresholds are unknown", () => {
    const slot = { plantDate: from, harvestDate: to };
    const withThermal = replayWindows(slot, thermal, [2025], days(from, 100, 30, 20))[0];
    expect(withThermal.stageBasis).toBe("gdd");
    const unknown = replayWindows(slot, base, [2025], days(from, 100, 30, 20))[0];
    expect(unknown.stageBasis).toBe("calendar");
    expect(unknown.stages).toHaveLength(4);
    const noWeather = replayWindows(slot, thermal, [2025])[0];
    expect(noWeather.stageBasis).toBe("calendar");
  });
});

describe("Phase 4: minimum clear-area gate", () => {
  test("a parcel with less than a quarter of its area clear gets no mean, at exactly a quarter it does", () => {
    expect(MIN_VALID_COVERAGE).toBe(0.25);
    const mk = (clearHa: number) => [
      { areaHa: clearHa, usable: true, value: 0.7 },
      { areaHa: 1 - clearHa, usable: false, value: null },
    ];
    const low = areaWeightedCoverage(1, mk(0.2));
    expect(low.coverageFraction).toBeCloseTo(0.2, 12);
    expect(low.validMean).toBeNull();
    expect(areaWeightedCoverage(1, mk(0.25)).validMean).toBeCloseTo(0.7, 12);
    expect(areaWeightedCoverage(1, mk(0.8)).validMean).toBeCloseTo(0.7, 12);
  });

  test("a 95 % cloudy HLS date keeps its place in the timeline but reports no NDVI", () => {
    const clear: [number, number, number, number] = [0.05, 0.4, 0.2, 0]; // red, nir, swir, Fmask 0 = clear land
    const cloud: [number, number, number, number] = [0.3, 0.3, 0.3, 2]; // bit 1 = cloud
    const n = 40;
    const dates = ["2025-07-01", "2025-07-09", "2025-07-17"];
    const series = {
      dates,
      pixels: [
        [...Array(2).fill(clear), ...Array(n - 2).fill(cloud)], // 5 % clear
        [...Array(10).fill(clear), ...Array(n - 10).fill(cloud)], // exactly 25 % clear
        Array(n).fill(clear), // fully clear
      ],
    };
    const [fringe, edge, full] = summariseHls(series);
    expect(fringe.coverage).toBeCloseTo(0.05, 12);
    expect(fringe.ndviMedian).toBeNull();
    expect(fringe.ndmiMedian).toBeNull();
    expect(fringe.validPixels).toBe(2); // the count is still reported honestly
    expect(edge.ndviMedian).toBeCloseTo((0.4 - 0.05) / (0.4 + 0.05), 12);
    expect(full.ndviMedian).toBeCloseTo((0.4 - 0.05) / (0.4 + 0.05), 12);
  });
});

describe("Section 8.4: pairwise switching weight", () => {
  // S(A) = w uA1 + (1 - w) uA2 and S(B) likewise; setting S(A) = S(B) gives
  //   w* = (uB2 - uA2) / ((uA1 - uB1) - (uA2 - uB2)).
  // An earlier whitepaper printed the numerator with the opposite sign. The code always used the correct one.
  test("A wins only on criterion 1 and B only on criterion 2: the options swap at w = 0.5", () => {
    const w = switchingPoint({ u1: 1, u2: 0 }, { u1: 0, u2: 1 });
    expect(w).toBeCloseTo(0.5, 12);
    // the mis-signed formula would have returned -0.5 here and so reported "no switching point"
    const wrongSign = -(1 - 0) / ((1 - 0) - (0 - 1));
    expect(wrongSign).toBeCloseTo(-0.5, 12);
  });

  test("at the returned weight the two scores are equal, and either side prefers a different option", () => {
    const A = { u1: 0.8, u2: 0.4 };
    const B = { u1: 0.4, u2: 0.7 };
    const w = switchingPoint(A, B)!;
    const score = (u: { u1: number; u2: number }, weight: number) => weight * u.u1 + (1 - weight) * u.u2;
    expect(score(A, w)).toBeCloseTo(score(B, w), 12);
    expect(score(A, w + 0.1)).toBeGreaterThan(score(B, w + 0.1)); // more weight on criterion 1 favours A
    expect(score(A, w - 0.1)).toBeLessThan(score(B, w - 0.1));
  });

  test("an option that is better on both criteria never switches", () => {
    expect(switchingPoint({ u1: 0.9, u2: 0.9 }, { u1: 0.2, u2: 0.3 })).toBeNull();
  });
});
