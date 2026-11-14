import { describe, expect, it } from "vitest";
import { applyScenario } from "@/lib/engine/scenario";
import type { EngineData } from "@/lib/engine/data";

const data = {
  latitude: 17,
  records: [
    { date: "2020-06-01", year: 2020, month: 6, doy: 153, tmaxC: 34, tminC: 24, tmeanC: 29, rainMm: 10, et0Mm: 5 },
    { date: "2020-06-02", year: 2020, month: 6, doy: 154, tmaxC: null, tminC: null, tmeanC: null, rainMm: null, et0Mm: null },
  ],
  imerg: [{ date: "2020-06-01", precipMm: 20, samples: 48 }, { date: "2020-06-02", precipMm: null, samples: null }],
} as unknown as EngineData;

describe("applyScenario", () => {
  it("returns the same data when neutral", () => expect(applyScenario(data, { rainPct: 0, tempC: 0 })).toBe(data));
  it("shifts rain and temperature evenly and keeps gaps missing", () => {
    const out = applyScenario(data, { rainPct: -20, tempC: 1.5 });
    expect(out.records[0].rainMm).toBeCloseTo(8);
    expect(out.records[0].tmaxC).toBe(35.5);
    expect(out.records[0].et0Mm).not.toBe(5);
    expect(out.records[1].rainMm).toBeNull();
    expect(out.records[1].tmaxC).toBeNull();
    expect(out.imerg[0].precipMm).toBeCloseTo(16);
    expect(out.imerg[1].precipMm).toBeNull();
  });
});
