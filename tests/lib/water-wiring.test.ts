import { describe, expect, test } from "vitest";
import { paddySeasonBalance, pumpingDecision, uplandStartAfterPaddy, twoZoneCapacities, isPaddyCrop } from "../../lib/engine/water";
import { constraintsSchema } from "../../lib/schemas/field";

const win = { from: "2026-06-01", to: "2026-06-10" };
const dates = Array.from({ length: 10 }, (_, i) => new Date(Date.parse(win.from) + i * 86_400_000).toISOString().slice(0, 10));
const mapOf = <T,>(v: T) => new Map(dates.map((d) => [d, v]));

describe("paddy season balance (appendix 4.3)", () => {
  test("refuses to run without bund, seepage and irrigation; nothing is defaulted", () => {
    const r = paddySeasonBalance({ bundMm: null, seepagePercolationMmDay: null, irrigationMm: null }, win, mapOf(5), mapOf<number | null>(0));
    expect(r.status).toBe("unknown");
    if (r.status === "unknown") expect(r.missing).toEqual(["bund height", "seepage and percolation rate", "irrigation amount (enter 0 if none)"]);
  });

  test("conserves water, spills over the bund and counts dry-pond days", () => {
    const wet = paddySeasonBalance({ bundMm: 50, seepagePercolationMmDay: 3, irrigationMm: 0 }, win, mapOf(5), mapOf<number | null>(40));
    expect(wet.status).toBe("ok");
    if (wet.status === "ok") {
      expect(wet.spillMm).toBeGreaterThan(0);
      expect(wet.conservationResidualMm).toBe(0);
      expect(wet.dryPondDays).toBe(0);
    }
    const dry = paddySeasonBalance({ bundMm: 50, seepagePercolationMmDay: 3, irrigationMm: 0 }, win, mapOf(5), mapOf<number | null>(0));
    if (dry.status === "ok") {
      expect(dry.dryPondDays).toBe(10);
      expect(dry.unmetEtMm).toBeCloseTo(50);
    }
  });

  test("only rice is treated as paddy", () => {
    expect(isPaddyCrop({ id: "rice" })).toBe(true);
    expect(isPaddyCrop({ id: "sesame" })).toBe(false);
  });
});

describe("pump capacity (appendix 4.4)", () => {
  test("caps the net depth at what the pump hours deliver", () => {
    // 1 ha, 10 m3/h, eta 0.8, 100 h: 100 * 10 * 0.8 / 10 = 80 mm
    const d = pumpingDecision({ netDepthMm: 150, areaHa: 1, efficiency: 0.8, pumpRateM3H: 10, hoursAvailable: 100 });
    expect(d.maxNetDepthMm).toBeCloseTo(80);
    expect(d.shortfallMm).toBeCloseTo(70);
  });
  test("the schema keeps pump figures together and in range", () => {
    expect(constraintsSchema.safeParse({ irrigation: { access: "supplemental", pump: { rateM3H: 10, efficiency: 0.8, hoursAvailable: 100 } } }).success).toBe(true);
    expect(constraintsSchema.safeParse({ irrigation: { access: "supplemental", pump: { rateM3H: 10, efficiency: 1.5, hoursAvailable: 100 } } }).success).toBe(false);
  });
});

describe("paddy to upland hand-over (appendix 4.3)", () => {
  test("standing water at harvest leaves the upland column at field capacity", () => {
    const col = { awcMmPerM: 120, rootDepthM: 0.6, maxDepthM: 0.9 };
    const r = uplandStartAfterPaddy(20, col);
    expect(r?.state.rootMm).toBeCloseTo(twoZoneCapacities(col).rootMm);
    expect(r?.surfaceDrainageMm).toBe(20);
    expect(uplandStartAfterPaddy(0, col)).toBeNull();
  });
});
