import { describe, expect, it } from "vitest";
import { applyScenario, isNeutral, matchingPreset, NO_SCENARIO, PRESETS, type Scenario } from "@/lib/engine/scenario";
import type { EngineData } from "@/lib/engine/data";

const data = {
  latitude: 17,
  field: { irrigation: "none", constraints: undefined },
  records: [
    { date: "2020-06-01", year: 2020, month: 6, doy: 153, tmaxC: 34, tminC: 24, tmeanC: 29, rainMm: 10, et0Mm: 5 },
    { date: "2020-06-02", year: 2020, month: 6, doy: 154, tmaxC: null, tminC: null, tmeanC: null, rainMm: null, et0Mm: null },
  ],
  imerg: [{ date: "2020-06-01", precipMm: 20, samples: 48 }, { date: "2020-06-02", precipMm: null, samples: null }],
} as unknown as EngineData;

const test = (s: Partial<Scenario>): Scenario => ({ ...NO_SCENARIO, ...s });

/** Ten consecutive days with a different rain each, so a shift is easy to read. */
const run = (rain: Array<number | null>) =>
  ({
    latitude: 17,
    field: { irrigation: "none" },
    records: rain.map((r, i) => ({ date: `2020-06-${String(i + 1).padStart(2, "0")}`, year: 2020, month: 6, doy: 153 + i, tmaxC: 34, tminC: 24, tmeanC: 29, rainMm: r, et0Mm: 5 })),
    imerg: rain.map((r, i) => ({ date: `2020-06-${String(i + 1).padStart(2, "0")}`, precipMm: r, samples: 48 })),
  }) as unknown as EngineData;

describe("applyScenario", () => {
  it("returns the same data when neutral", () => expect(applyScenario(data, NO_SCENARIO)).toBe(data));

  it("shifts rain and temperature evenly and keeps gaps missing", () => {
    const out = applyScenario(data, test({ rainPct: -20, tempC: 1.5 }));
    expect(out.records[0].rainMm).toBeCloseTo(8);
    expect(out.records[0].tmaxC).toBe(35.5);
    expect(out.records[0].et0Mm).not.toBe(5);
    expect(out.records[1].rainMm).toBeNull();
    expect(out.records[1].tmaxC).toBeNull();
    expect(out.imerg[0].precipMm).toBeCloseTo(16);
    expect(out.imerg[1].precipMm).toBeNull();
  });

  it("leaves evaporative demand alone when only rain is tested", () => {
    expect(applyScenario(data, test({ rainPct: 25 })).records[0].et0Mm).toBe(5);
  });

  it("moves rain later without changing the total", () => {
    const out = applyScenario(run([0, 0, 5, 10, 20, 0, 0, 0]), test({ delayDays: 2 }));
    expect(out.records.map((r) => r.rainMm)).toEqual([0, 0, 0, 0, 5, 10, 20, 0]);
    expect(out.imerg.map((d) => d.precipMm)).toEqual([0, 0, 0, 0, 5, 10, 20, 0]);
  });

  it("keeps a missing day missing after a delay, and does not invent rain before the record starts", () => {
    const out = applyScenario(run([4, null, 6, 0]), test({ delayDays: 1 }));
    expect(out.records.map((r) => r.rainMm)).toEqual([0, 4, null, 6]);
  });

  it("does not change temperature when only the timing moves", () => {
    const out = applyScenario(run([1, 2, 3]), test({ delayDays: 1 }));
    expect(out.records.every((r) => r.tmaxC === 34 && r.et0Mm === 5)).toBe(true);
  });

  it("tests a water supply on a copy and leaves the recorded field alone", () => {
    const out = applyScenario(data, test({ irrigation: "supplemental" }));
    expect(out.field.irrigation).toBe("supplemental");
    expect(out.field.constraints?.irrigation).toEqual({ access: "supplemental", amountMm: 150 });
    expect(data.field.irrigation).toBe("none");
    expect(out.records).toBe(data.records);
  });

  it("uses the amount the farmer gave over the assumed depth", () => {
    const withAmount = { ...data, field: { ...data.field, constraints: { irrigation: { access: "none", amountMm: 90 } } } } as unknown as EngineData;
    expect(applyScenario(withAmount, test({ irrigation: "full" })).field.constraints?.irrigation?.amountMm).toBe(90);
  });
});

describe("scenario helpers", () => {
  it("counts any change, including the water supply, as a test", () => {
    expect(isNeutral(NO_SCENARIO)).toBe(true);
    expect(isNeutral(test({ delayDays: 5 }))).toBe(false);
    expect(isNeutral(test({ irrigation: "full" }))).toBe(false);
  });

  it("finds the preset a scenario matches, ignoring the water supply", () => {
    for (const p of PRESETS) expect(matchingPreset(test({ ...p.change, irrigation: "full" }))?.id).toBe(p.id);
    expect(matchingPreset(test({ rainPct: -5 }))).toBeNull();
  });

  it("keeps every preset on the slider steps", () => {
    for (const { change } of PRESETS) {
      expect(Math.abs(change.rainPct % 5)).toBe(0);
      expect(Math.abs(change.delayDays % 5)).toBe(0);
      expect(Math.abs((change.tempC * 2) % 1)).toBe(0);
    }
  });
});
