import { describe, expect, it } from "vitest";
import {
  penmanMonteithDetails,
  penmanMonteithEt0,
  hargreavesEt0,
  evaluateDailyEt0,
  normalizeSolarRadiation,
} from "../../lib/engine/et0";
import { dynamicDepletionFraction } from "../../lib/data/crops/myanmar";
import { getCropById } from "../../lib/data/crops";
import { exposureForCrop } from "../../lib/engine/exposure";

describe("PROMPT 2: FAO-56 Penman-Monteith & Reference ET0 (C-01)", () => {
  it("calculates Penman-Monteith ET0 with clear distinction between Rs (shortwave) and Rn (net radiation)", () => {
    const details = penmanMonteithDetails({
      latDeg: 16.84, // Ayeyarwady Delta
      doy: 180, // June
      elevationM: 10,
      tmaxC: 32,
      tminC: 25,
      tmeanC: 28.5,
      rhMeanPct: 85,
      u2: 2.5,
      rsMj: 18.0, // incoming solar shortwave Rs
      pressureKpa: 101.2,
    });

    // Net radiation Rn must be less than Rs due to albedo (rns = 0.77 * 18 = 13.86) and net longwave loss (rnl > 0)
    expect(details.rnsMj).toBeCloseTo(18.0 * (1 - 0.23), 2);
    expect(details.rnMj).toBeLessThan(18.0);
    expect(details.rnMj).toBeGreaterThan(0);
    expect(details.et0Mm).toBeGreaterThan(0);
    expect(details.et0Mm).toBeLessThan(10);
  });

  it("handles missing humidity gracefully by falling back to Hargreaves with explicit limitations", () => {
    const res = evaluateDailyEt0({
      latDeg: 16.84,
      doy: 180,
      elevationM: 10,
      tmaxC: 32,
      tminC: 25,
      rhMeanPct: null, // missing humidity
      u2: 2.0,
      rsMj: 18.0,
    });

    expect(res.method).toBe("hargreaves");
    expect(res.et0Mm).toBeGreaterThan(0);
    expect(res.limitations).toContain("relative humidity");
    expect(res.inputsUsed).toEqual(["Tmax", "Tmin", "ExtraterrestrialRadiation"]);
  });

  it("handles missing radiation by falling back to Hargreaves-Samani with explicit provenance", () => {
    const res = evaluateDailyEt0({
      latDeg: 16.84,
      doy: 180,
      elevationM: 10,
      tmaxC: 32,
      tminC: 25,
      rhMeanPct: 80,
      u2: 2.0,
      rsMj: null, // missing solar radiation
    });

    expect(res.method).toBe("hargreaves");
    expect(res.et0Mm).toBeGreaterThan(0);
    expect(res.limitations).toContain("solar radiation");
  });

  it("handles sentinel values (-999.0) safely without producing NaN", () => {
    expect(normalizeSolarRadiation(-999.0)).toBe(0);
    expect(normalizeSolarRadiation(20.0)).toBe(20.0);

    const res = evaluateDailyEt0({
      latDeg: 16.84,
      doy: 180,
      elevationM: 10,
      tmaxC: -999.0, // sentinel invalid temperature
      tminC: 20.0,
    });

    expect(res.method).toBe("none");
    expect(res.et0Mm).toBeNull();
    expect(res.limitations).toContain("Missing valid daily minimum and maximum air temperatures");
  });
});

describe("PROMPT 2: Dynamic Depletion Fraction p(ETc) (H-02)", () => {
  it("adjusts depletion fraction p dynamically according to atmospheric demand ETc (FAO Table 22 & Eq. 84)", () => {
    const baseP = 0.45; // Pulses (black gram, green gram, chickpea)

    // At low evaporative demand (ETc = 2 mm/day), soil can be depleted further before stress:
    // p = clamp(0.45 + 0.04 * (5 - 2), 0.1, 0.8) = 0.45 + 0.12 = 0.57
    const lowDemandP = dynamicDepletionFraction(baseP, 2.0);
    expect(lowDemandP).toBeCloseTo(0.57, 2);

    // At standard demand (ETc = 5 mm/day), p equals base p:
    // p = 0.45 + 0.04 * 0 = 0.45
    const standardP = dynamicDepletionFraction(baseP, 5.0);
    expect(standardP).toBe(0.45);

    // At high evaporative demand (ETc = 7.5 mm/day), p contracts to prevent stress:
    // p = clamp(0.45 + 0.04 * (5 - 7.5), 0.1, 0.8) = 0.45 - 0.10 = 0.35
    const highDemandP = dynamicDepletionFraction(baseP, 7.5);
    expect(highDemandP).toBeCloseTo(0.35, 2);

    // Clamping limits [0.1, 0.8]
    expect(dynamicDepletionFraction(baseP, 20.0)).toBe(0.1);
    expect(dynamicDepletionFraction(baseP, -15.0)).toBe(0.8);
  });

  it("assigns documented base p values to crops in crop library", () => {
    const rice = getCropById("rice");
    const blackGram = getCropById("black-gram");
    const sesame = getCropById("sesame");

    expect(rice?.depletionFractionBase).toBe(0.20); // Shallow ponded/paddy
    expect(blackGram?.depletionFractionBase).toBe(0.45); // Pulses
    expect(sesame?.depletionFractionBase).toBe(0.60); // Deep drought tolerant oilseed
  });
});

describe("PROMPT 2: Stage-Aware Phenological Hazards (C-02)", () => {
  it("evaluates flowering heat and excess rain hazards with non-prescriptive advisory notices", () => {
    const crop = getCropById("black-gram")!;
    const windows = [
      {
        year: 2026,
        from: "2026-10-20",
        to: "2027-01-20",
        stageBasis: "calendar" as const,
        stages: [
          { id: "ini" as const, from: "2026-10-20", to: "2026-11-05" },
          { id: "dev" as const, from: "2026-11-06", to: "2026-11-25" },
          { id: "mid" as const, from: "2026-11-26", to: "2026-12-25" }, // Flowering window
          { id: "late" as const, from: "2026-12-26", to: "2027-01-20" },
        ],
      },
    ];

    // Mock records with unseasonal rain (> 10mm) and heat (> 38C) during flowering
    const records = [
      {
        date: "2026-12-05",
        year: 2026,
        month: 12,
        doy: 339,
        tmaxC: 39.0, // Above flowering heat threshold (38C)
        tminC: 22.0,
        tmeanC: 30.0,
        rainMm: 15.0, // Unseasonal rain above flowering threshold (10mm)
        et0Mm: 4.0,
        rootWetness: 0.7,
      },
      {
        date: "2026-12-06",
        year: 2026,
        month: 12,
        doy: 340,
        tmaxC: 35.0,
        tminC: 20.0,
        tmeanC: 27.5,
        rainMm: 0.0,
        et0Mm: 3.5,
        rootWetness: 0.6,
      },
    ];

    const exposure = exposureForCrop(crop, windows, records);
    expect(exposure.advisoryNotice).toContain("observational risk factors");
    expect(exposure.advisoryNotice).toContain("not deterministic yield predictions");

    const midStage = exposure.byStage.find((s) => s.stage === "mid")!;
    expect(midStage.heatThresholdC).toBe(38);
    expect(midStage.excessRainThresholdMm).toBe(10);
  });
});
