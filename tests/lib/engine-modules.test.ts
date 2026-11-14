import { describe, expect, test } from "vitest";
import { getCropById, strategyCrops, getDefaultTypicalDates, CROPS } from "../../lib/data/crops";
import { regionOfPoint, checkRegion } from "../../lib/data/regions";
import { generateCandidates, sequenceKey } from "../../lib/engine/candidates";
import { toDailyRecords } from "../../lib/engine/climate";
import { buildRainSeries, IMERG_MIN_COVERAGE } from "../../lib/engine/data";
import { rankRotations } from "../../lib/engine/mcda";
import { windowRain } from "../../lib/engine/rain";
import { isoFrom, replayWindows, stageWindows, slotOverlaps } from "../../lib/engine/season";
import { assessSuitability } from "../../lib/engine/suitability";
import { rotationStructure } from "../../lib/engine/structure";
import { effectiveSoil } from "../../lib/engine/soil-input";
import { exposureForCrop } from "../../lib/engine/exposure";
import { economicsFor } from "../../lib/engine/economics";
import { assessGaps } from "../../lib/engine/lowcover";
import { erosionScreen } from "../../lib/engine/soil-health";
import { pestSequence } from "../../lib/engine/pest";
import { rootZoneBalance } from "../../lib/engine/water";
import { makeIndicator } from "../../lib/evidence/indicator";
import { slot, rotation, syntheticField, syntheticWeather } from "../helpers/synthetic";
import type { ImergDay } from "../../lib/nasa/imerg";

describe("regions", () => {
  test("a point resolves to its region, and one outside the three is unsupported", () => {
    expect(regionOfPoint([94.95, 20.15])).toBe("magway");
    expect(regionOfPoint([94.73, 16.78])).toBe("ayeyarwady"); // Pathein
    expect(regionOfPoint([97.04, 20.78])).toBe("shan"); // Taunggyi
    expect(regionOfPoint([36.8, -1.3])).toBe("unsupported"); // Nairobi
    expect(regionOfPoint([96.16, 16.8])).toBe("unsupported"); // Yangon region is not one of the three
  });

  test("a polygon that crosses a boundary is flagged", () => {
    const box = { type: "Polygon" as const, coordinates: [[[94.5, 17.0], [97.5, 17.0], [97.5, 20.0], [94.5, 20.0], [94.5, 17.0]]] as [number, number][][] };
    const c = checkRegion(box, [96, 18.5]);
    expect(c.straddlesBoundary).toBe(true);
  });
});

describe("crop library", () => {
  test("every supported crop has stages that cover the cycle and a source on each threshold", () => {
    const supported = strategyCrops();
    expect(supported.map((c) => c.id).sort()).toEqual(["black-gram", "chickpea", "green-gram", "groundnut", "lablab", "maize", "pigeon-pea", "rice", "sesame", "soybean", "sunn-hemp"]);
    for (const c of supported) {
      const p = c.profile!;
      expect(p.stages.map((s) => s.id)).toEqual(["ini", "dev", "mid", "late"]);
      expect(p.varietyValidated).toBe(false);
      for (const s of p.stages) expect(s.kc.ref.length).toBeGreaterThan(5);
      expect(p.tempC.optMin.scope).toMatch(/ecocrop-reference|analyst-assumption/);
      const f = c.stageFractions;
      expect(f.ini + f.dev + f.mid + f.late).toBeCloseTo(1, 5);
    }
  });

  test("ECOCROP values for green gram and black gram are the sheet's own", () => {
    const gg = getCropById("green-gram")!.profile!;
    expect(gg.tempC.optMin.value).toBe(21);
    expect(gg.tempC.optMax.value).toBe(36);
    expect(gg.ph.optMin.value).toBe(5.5);
    expect(gg.ph.optMax.value).toBe(6.2);
    expect(gg.tempC.optMin.scope).toBe("ecocrop-reference");
    expect(gg.ecologyAnnualRainMm.value).toEqual([500, 1250]);
    const bg = getCropById("black-gram")!.profile!;
    expect(bg.tempC.optMax.value).toBe(35);
    expect(bg.ph.absMax.value).toBe(7.5);
    expect(bg.ecologyAnnualRainMm.value).toEqual([530, 2430]);
  });

  test("US-oriented crops stay selectable but are reference-only", () => {
    expect(getCropById("wheat")?.scope).toBe("reference-only");
    expect(getCropById("wheat")?.profile).toBeUndefined();
    expect(CROPS.find((c) => c.id === "sorghum")?.scope).toBe("reference-only");
  });

  test("regional default dates come from the sowing window", () => {
    const d = getDefaultTypicalDates("sesame", 2026, "magway");
    expect(d.plantDate).toBe("2026-05-01");
  });
});

describe("season windows", () => {
  test("a window that crosses December ends in the next year, and leap days fall back", () => {
    const w = replayWindows({ plantDate: "2025-11-15", harvestDate: "2026-03-10" }, undefined, [2016, 2019]);
    expect(w[0].from).toBe("2016-11-15");
    expect(w[0].to).toBe("2017-03-10");
    expect(isoFrom(2017, 2, 29)).toBe("2017-02-28");
    expect(isoFrom(2016, 2, 29)).toBe("2016-02-29");
    const leap = replayWindows({ plantDate: "2024-02-29", harvestDate: "2024-06-01" }, undefined, [2017]);
    expect(leap[0].from).toBe("2017-02-28");
  });

  test("stages tile the window exactly", () => {
    const crop = getCropById("rice")!;
    const st = stageWindows(crop, "2026-06-01", "2026-10-13");
    expect(st[0].from).toBe("2026-06-01");
    expect(st[3].to).toBe("2026-10-13");
    for (let i = 1; i < st.length; i++) expect(Date.parse(st[i].from) - Date.parse(st[i - 1].to)).toBe(86_400_000);
  });

  test("overlaps are found between consecutive slots", () => {
    expect(slotOverlaps([{ plantDate: "2026-05-01", harvestDate: "2026-09-01" }, { plantDate: "2026-08-20", harvestDate: "2026-12-01" }])[0].days).toBe(12);
    expect(slotOverlaps([{ plantDate: "2026-05-01", harvestDate: "2026-08-01" }, { plantDate: "2026-08-20", harvestDate: "2026-12-01" }])).toHaveLength(0);
  });
});

describe("rain statistics", () => {
  const days = (vals: Array<number | null>, start = "2025-06-01") =>
    vals.map((mm, i) => ({ date: new Date(Date.parse(start) + i * 86_400_000).toISOString().slice(0, 10), mm }));

  test("a missing day breaks a dry spell; it is not a dry day", () => {
    const r = windowRain(days([0, 0, 0, null, 0, 0, 5, 0]), "2025-06-01", "2025-06-08", { minValidShare: 0.5 });
    expect(r.longestDryDays).toBe(3);
    expect(r.totalMm).toBe(5);
  });

  test("a window with too many missing days is not evaluable, and total is null not zero", () => {
    const r = windowRain(days([1, null, null, null, null, 2]), "2025-06-01", "2025-06-06");
    expect(r.evaluable).toBe(false);
    expect(r.totalMm).toBeNull();
  });

  test("heavy rain days are counted at the named threshold", () => {
    const r = windowRain(days([0, 60, 10, 55, 0]), "2025-06-01", "2025-06-05", { heavyMm: 50 });
    expect(r.heavyRainDays).toBe(2);
  });

  test("IMERG replaces POWER only when it covers the baseline; the mix is never used", () => {
    const records = toDailyRecords(syntheticWeather({ startYear: 2016, endYear: 2025 }));
    const few: ImergDay[] = [{ date: "2020-06-01", precipMm: 99, samples: 48, randomError: 1, randomErrorSamples: 48, partialSampling: false, granule: "g" }];
    const sparse = buildRainSeries(records, few);
    expect(sparse.fromR).toBe(0);
    expect(sparse.primary).toBe("P");
    const full: ImergDay[] = records.map((r) => ({ date: r.date, precipMm: 1, samples: 48, randomError: 0, randomErrorSamples: 48, partialSampling: false, granule: "g" }));
    const all = buildRainSeries(records, full);
    expect(all.primary).toBe("R");
    expect(all.fromP).toBe(0);
    // partly sampled days are not read as complete days
    const partial = full.map((d, i) => (i % 2 === 0 ? { ...d, samples: 30, partialSampling: true } : d));
    expect(buildRainSeries(records, partial).primary).toBe("P");
    expect(IMERG_MIN_COVERAGE).toBeGreaterThan(0.9);
  });
});

describe("suitability: unknown is not a pass", () => {
  const crop = getCropById("green-gram")!;
  const records = toDailyRecords(syntheticWeather());
  const windows = replayWindows({ plantDate: "2026-09-01", harvestDate: "2026-11-15" }, crop, [2016, 2017, 2018, 2019]);
  const base = { crop, region: "magway" as const, slot: { plantDate: "2026-09-01", harvestDate: "2026-11-15" }, windows, records };

  test("no pH leaves the overall result unknown", () => {
    const r = assessSuitability({ ...base, soil: effectiveSoil(syntheticField(), null) });
    expect(r.checks.find((c) => c.id === "ph")?.level).toBe("unknown");
    expect(r.overall).toBe("unknown");
  });

  test("a pH outside the range makes it outside, even with other checks fine", () => {
    const field = syntheticField({ soilOverride: { ph: 9.2 } });
    const r = assessSuitability({ ...base, soil: effectiveSoil(field, null) });
    expect(r.checks.find((c) => c.id === "ph")?.level).toBe("outside");
    expect(r.overall).toBe("outside");
  });

  test("a sowing date outside the regional window is outside", () => {
    const field = syntheticField({ soilOverride: { ph: 6 } });
    const r = assessSuitability({ ...base, slot: { plantDate: "2026-02-01", harvestDate: "2026-04-15" }, soil: effectiveSoil(field, null) });
    expect(r.checks.find((c) => c.id === "sowing-window")?.level).toBe("outside");
  });

  test("the farmer's value wins over the soil map, and both stay visible", () => {
    const field = syntheticField({ soilOverride: { ph: 5.8 } });
    const soil = effectiveSoil(field, { clayPct: 30, sandPct: 30, siltPct: 40, ph: 7.4, socGKg: 12, cecCmolKg: null, bulkDensityKgDm3: null, nitrogenGKg: null, texture: "clay loam", source: { dataset: "ISRIC SoilGrids v2", resolution: "250 m", depth: "0 to 30 cm" } });
    expect(soil.ph?.value).toBe(5.8);
    expect(soil.ph?.from).toBe("farmer");
    expect(soil.texture?.from).toBe("soilgrids");
    expect(soil.soilGridsAvailable).toBe(true);
  });

  test("a laboratory observation beats a farmer estimate, and a newer one beats an older one", () => {
    const field = syntheticField({
      soilObservations: [
        { id: "a", property: "ph", value: 5.0, units: "pH", depthCm: [0, 20], date: "2025-01-01", method: "farmer-estimate", source: "me" },
        { id: "b", property: "ph", value: 6.1, units: "pH", depthCm: [0, 20], date: "2024-01-01", method: "laboratory", source: "lab" },
        { id: "c", property: "ph", value: 6.3, units: "pH", depthCm: [0, 20], date: "2025-03-01", method: "laboratory", source: "lab" },
      ],
    });
    expect(effectiveSoil(field, null).ph?.value).toBe(6.3);
  });
});

describe("exposure from air temperature", () => {
  test("a stage without a sourced threshold is unknown, not zero", () => {
    const crop = getCropById("sunn-hemp")!; // no heat or cold threshold in the library
    const records = toDailyRecords(syntheticWeather());
    const w = replayWindows({ plantDate: "2026-06-01", harvestDate: "2026-08-30" }, crop, [2017, 2018]);
    const e = exposureForCrop(crop, w, records);
    expect(e.byStage.every((s) => s.seasonsWithHeat === null)).toBe(true);
  });

  test("hot days at flowering are counted per season, with the threshold named", () => {
    const crop = getCropById("sesame")!; // 38 C at flowering
    const hot = toDailyRecords(syntheticWeather({ startYear: 2016, endYear: 2018 })).map((r) => (r.year === 2017 ? { ...r, tmaxC: 41 } : r));
    const w = replayWindows({ plantDate: "2026-05-15", harvestDate: "2026-08-23" }, crop, [2016, 2017]);
    const e = exposureForCrop(crop, w, hot);
    const mid = e.byStage.find((s) => s.stage === "mid")!;
    expect(mid.heatThresholdC).toBe(38);
    expect(mid.seasonsWithHeat).toBe(1);
    expect(e.eligibleSeasons).toBe(2);
  });
});

describe("rotation structure and gaps", () => {
  const r = rotation("f", [slot("a", "rice", "2026-06-01", "2026-10-13"), slot("b", "black-gram", "2026-10-20", "2027-01-18")], 1);

  test("covered share, families and legume share are direct counts", () => {
    const st = rotationStructure(r);
    expect(st.legumeSlots).toBe(1);
    expect(st.cropSlots).toBe(2);
    expect(st.distinctFamilies).toBe(2);
    expect(st.coveredShare).toBeGreaterThan(0.4);
    expect(st.gaps.length).toBeGreaterThan(0);
  });

  test("a gap is only 'possible low cover' with several clear low-greenness images; water is not bare", () => {
    const st = rotationStructure(r);
    const gap = st.gaps[0];
    const mmdd = gap.from.slice(5);
    const obs = (ndvi: number | null, coverage: number, water = 0) => ({ date: `2023-${mmdd}`, ndviMedian: ndvi, ndmiMedian: null, validPixels: 5, totalPixels: 10, waterPixels: water, coverage });
    expect(assessGaps([gap], [obs(0.1, 0.8), obs(0.12, 0.9)])[0].label).toBe("possible-low-cover");
    expect(assessGaps([gap], [obs(0.1, 0.8)])[0].label).toBe("planned-gap-no-clear-imagery");
    expect(assessGaps([gap], [])[0].label).toBe("planned-gap-no-clear-imagery");
    expect(assessGaps([gap], [obs(0.1, 0.8, 6), obs(0.1, 0.8, 6)])[0].label).toBe("mostly-water");
    expect(assessGaps([gap], [obs(0.6, 0.9), obs(0.7, 0.9)])[0].label).toBe("green-in-past-years");
  });

  test("erosion screen needs slope; with slope and a bare rainy interval it is flagged", () => {
    const st = rotationStructure(r);
    const normals = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, tmaxC: 30, tminC: 20, tmeanC: 25, rainMm: 150, et0Mm: 100, rainOverEt0: 1.5 }));
    expect(erosionScreen(st, normals, null).exposure).toBe("needs-slope-data");
    const steep = { medianDeg: 20, p90Deg: 25, meanDeg: 20, validCells: 50, totalCells: 60 };
    expect(erosionScreen(st, normals, steep).exposure).toBe("elevated");
    const flat = { medianDeg: 1, p90Deg: 2, meanDeg: 1, validCells: 50, totalCells: 60 };
    expect(erosionScreen(st, normals, flat).exposure).toBe("not-flagged");
  });
});

describe("pests, economics and the root-zone balance", () => {
  test("the same crop family in a row is flagged; different families are not", () => {
    const legumes = rotation("f", [slot("a", "green-gram", "2026-08-15", "2026-10-30"), slot("b", "black-gram", "2026-11-05", "2027-02-05")]);
    expect(pestSequence(legumes).some((p) => p.result === "same-family")).toBe(true);
    const mixed = rotation("f", [slot("a", "rice", "2026-06-01", "2026-10-13"), slot("b", "black-gram", "2026-10-20", "2027-01-18")]);
    expect(pestSequence(mixed).every((p) => p.result === "different-family")).toBe(true);
  });

  test("margin is a range from the farmer's own numbers; missing inputs give unknown, never zero", () => {
    const r = rotation("f", [slot("a", "sesame", "2026-05-01", "2026-08-09")]);
    const known = economicsFor(r, [{ cropId: "sesame", yieldKgHa: [400, 600], priceMmkPerKg: [2000, 3000], costMmkPerHa: [300000, 400000], source: "Local market, Nov 2026" }], 2);
    expect(known.cycleMarginMmkHa).toEqual([400 * 2000 - 400000, 600 * 3000 - 300000]);
    expect(known.cycleMarginMmk?.[0]).toBe((400 * 2000 - 400000) * 2);
    const unknown = economicsFor(r, [{ cropId: "sesame", yieldKgHa: [400, 600], source: "x" }], 2);
    expect(unknown.cycleMarginMmkHa).toBeNull();
    expect(unknown.slots[0].missing).toEqual(["price range", "cost range"]);
    expect(economicsFor(r, undefined, 2).unknownSlots).toBe(1);
  });

  test("the water balance refuses to run without soil capacity, depth and moisture at planting", () => {
    const win = { from: "2026-06-01", to: "2026-06-10" };
    const etc = new Map<string, number>();
    const rain = new Map<string, number | null>();
    const none = rootZoneBalance({ awcMmPerM: null, rootDepthM: null, initialDepletionMm: null, irrigationMm: null }, win, etc, rain);
    expect(none.status).toBe("unknown");
    if (none.status === "unknown") expect(none.missing).toContain("available water capacity");
    for (let i = 0; i < 10; i++) etc.set(new Date(Date.parse(win.from) + i * 86_400_000).toISOString().slice(0, 10), 5);
    const ok = rootZoneBalance({ awcMmPerM: 120, rootDepthM: 0.6, initialDepletionMm: 0, irrigationMm: 0 }, win, etc, rain);
    expect(ok.status).toBe("ok");
    if (ok.status === "ok") {
      expect(ok.tawMm).toBeCloseTo(72);
      expect(ok.endDepletionMm).toBeCloseTo(50);
      expect(ok.daysBeyondHalfTaw).toBeGreaterThan(0);
    }
  });
});

describe("MCDA", () => {
  const prio = { order: ["water", "soil"] as const, weights: {} };
  const inputs = (over: Array<Partial<Record<string, number | null>>>, feasible = [true, true, true]) =>
    over.map((v, i) => ({ rotationId: `r${i}`, feasible: feasible[i], values: v }));

  test("weights sum to one over the criteria that could be evaluated for every option", () => {
    const res = rankRotations(
      inputs([
        { "water-shortfall": 100, "soil-legume-share": 0, "soil-cover": 0.4 },
        { "water-shortfall": 50, "soil-legume-share": 0.5, "soil-cover": 0.6 },
        { "water-shortfall": 10, "soil-legume-share": 1, "soil-cover": 0.5 },
      ]),
      { order: [...prio.order], weights: {} },
    );
    expect(res.status).toBe("ranked");
    const total = Object.values(res.weights).reduce((a, b) => a + (b ?? 0), 0);
    expect(total).toBeCloseTo(1, 10);
    expect(res.ranking[0].rotationId).toBe("r2");
  });

  test("a criterion missing for one option is not ranked and is listed with a reason", () => {
    const res = rankRotations(
      inputs([
        { "water-shortfall": 100, "soil-legume-share": 0, "soil-cover": 0.4 },
        { "water-shortfall": null, "soil-legume-share": 0.5, "soil-cover": 0.6 },
        { "water-shortfall": 10, "soil-legume-share": 1, "soil-cover": 0.5 },
      ]),
      { order: ["soil", "water"], weights: {} },
    );
    expect(res.used).not.toContain("water-shortfall");
    expect(res.excluded.find((e) => e.criterion === "water-shortfall")?.reason).toBe("missing-evidence");
    expect(res.status).toBe("ranked");
  });

  test("if the first priority cannot be evaluated the result is unresolved, with no ranking", () => {
    const res = rankRotations(
      inputs([
        { "water-shortfall": null, "soil-legume-share": 0, "soil-cover": 0.4 },
        { "water-shortfall": null, "soil-legume-share": 0.5, "soil-cover": 0.6 },
        { "water-shortfall": null, "soil-legume-share": 1, "soil-cover": 0.5 },
      ]),
      { order: ["water", "soil"], weights: {} },
    );
    expect(res.status).toBe("unresolved");
    expect(res.ranking).toHaveLength(0);
  });

  test("no priorities, no ranking; an infeasible option is not ranked; no-difference is reported", () => {
    expect(rankRotations(inputs([{}, {}, {}]), undefined).status).toBe("no-priorities");
    const res = rankRotations(
      inputs(
        [
          { "soil-legume-share": 0, "soil-cover": 0.5 },
          { "soil-legume-share": 1, "soil-cover": 0.5 },
          { "soil-legume-share": 0.5, "soil-cover": 0.9 },
        ],
        [true, true, false],
      ),
      { order: ["soil"], weights: {} },
    );
    expect(res.ranking.map((r) => r.rotationId)).not.toContain("r2");
    expect(res.excluded.find((e) => e.criterion === "soil-cover")?.reason).toBe("no-difference");
  });

  test("explicit weights are normalised", () => {
    const res = rankRotations(
      inputs([{ "water-shortfall": 100, "income-margin": 1 }, { "water-shortfall": 0, "income-margin": 5 }, { "water-shortfall": 50, "income-margin": 3 }]),
      { order: ["water", "income"], weights: { water: 3, income: 1 } },
    );
    expect(res.weights["water-shortfall"]).toBeCloseTo(0.75);
    expect(res.weights["income-margin"]).toBeCloseTo(0.25);
  });
});

describe("candidate rotations", () => {
  const common = { fieldId: "f", fieldIrrigation: "none" as const, baseYear: 2026 };

  test("the current sequence is never offered back, and an excluded crop is respected", () => {
    const current = rotation("f", [slot("a", "maize", "2026-04-15", "2026-08-13"), slot("b", "soybean", "2026-08-20", "2026-12-18")]);
    const res = generateCandidates({ ...common, region: "shan", current, constraints: { excludedCropIds: ["lablab"] } });
    expect(res.alternatives.map((a) => a.template.id)).not.toContain("sh-maize-soybean");
    expect(res.alternatives.map((a) => a.template.id)).not.toContain("sh-maize-lablab");
    expect(res.rejected.find((r) => r.template.id === "sh-maize-lablab")?.reason).toContain("excluded");
  });

  test("a sequence whose next crop misses its sowing window is rejected with the reason", () => {
    const current = rotation("f", [slot("a", "groundnut", "2026-05-15", "2026-09-07")]);
    const res = generateCandidates({ ...common, region: "shan", current });
    expect(res.rejected.find((r) => r.template.id === "sh-maize-sunn-hemp")?.reason).toMatch(/sunn hemp|Sunn hemp/);
  });

  test("a farmer's planting window rejects dates outside it", () => {
    const current = rotation("f", [slot("a", "sesame", "2026-05-15", "2026-08-23")]);
    const res = generateCandidates({ ...common, region: "magway", current, constraints: { plantingWindow: { from: "05-01", to: "06-30" } } });
    // green gram and chickpea are sown after August, so every template that needs them is rejected
    expect(res.rejected.length).toBeGreaterThan(0);
    for (const a of res.alternatives) for (const s of a.rotation.slots) expect(s.plantDate.slice(5) >= "05-01" && s.plantDate.slice(5) <= "06-30").toBe(true);
  });

  test("an unsupported region returns a typed reason, not a guess", () => {
    const res = generateCandidates({ ...common, region: "unsupported", current: rotation("f", []) });
    expect(res.alternatives).toHaveLength(0);
    expect(res.shortfall).toContain("outside");
  });

  test("every built alternative is dated inside each crop's sowing window", () => {
    for (const region of ["ayeyarwady", "magway", "shan"] as const) {
      const res = generateCandidates({ ...common, region, current: rotation("f", [slot("a", "rice", "2026-06-01", "2026-10-13")]) });
      expect(res.alternatives.length).toBeGreaterThanOrEqual(2);
      for (const a of res.alternatives) {
        for (const s of a.rotation.slots) {
          const cal = getCropById(s.cropId!)!.profile!.regionalCalendars[region]!;
          const d = s.plantDate.slice(5);
          const inside = cal.sowWindow[0] <= cal.sowWindow[1] ? d >= cal.sowWindow[0] && d <= cal.sowWindow[1] : d >= cal.sowWindow[0] || d <= cal.sowWindow[1];
          expect(inside).toBe(true);
        }
      }
    }
    expect(sequenceKey(["a", "b"])).toBe(sequenceKey(["b", "a"]));
  });
});

describe("evidence contract", () => {
  test("a null value always carries a reason; a value never does", () => {
    const gone = makeIndicator({ fieldId: "f", indicatorName: "x", sourceId: "M", product: "SMAP", variableOrLayer: "v", value: null, missingReason: "source-unconfigured" });
    expect(gone.value).toBeNull();
    expect(gone.missingReason).toBe("source-unconfigured");
    const defaulted = makeIndicator({ fieldId: "f", indicatorName: "x", sourceId: "M", product: "SMAP", variableOrLayer: "v" });
    expect(defaulted.missingReason).toBe("not-evaluable");
    const has = makeIndicator({ fieldId: "f", indicatorName: "x", sourceId: "P", product: "POWER", variableOrLayer: "v", value: 0, missingReason: "source-unavailable" });
    expect(has.value).toBe(0); // a real zero is a value
    expect(has.missingReason).toBeNull();
    expect(has.processingVersion).toMatch(/^\d{4}\./);
  });
});
