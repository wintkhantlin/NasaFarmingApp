import { describe, expect, test } from "vitest";
import { compareRotations } from "../../lib/engine/compare";
import { applyScenario, NO_SCENARIO, type Scenario } from "../../lib/engine/scenario";
import { whatIfResult } from "../../lib/engine/what-if";
import { engineData, rotation, slot, syntheticField, syntheticWeather } from "../helpers/synthetic";

const field = syntheticField({ priorities: { order: ["water", "soil"], weights: {} } });
const mine = rotation(field.id, [slot("a", "sesame", "2026-05-15", "2026-08-23"), slot("b", "green-gram", "2026-08-30", "2026-11-13")]);
const data = engineData(field, syntheticWeather());
const now = new Date("2026-11-14T00:00:00Z");
const compareOn = (d: typeof data) => (s: Scenario) => compareRotations(applyScenario(d, s), mine, { baseYear: 2026, now });
const compare = compareOn(data);
const test_ = (s: Partial<Scenario>, d = data) => {
  const c = compareOn(d);
  return whatIfResult(c(NO_SCENARIO), c({ ...NO_SCENARIO, ...s }), { includeCurrent: true });
};
/** A climate dry enough that the seasons sit near the edge, so a test can tip them either way. */
const marginal = engineData(field, syntheticWeather({ rainScale: 0.5 }));

describe("whatIfResult", () => {
  test("a test that changes nothing shows no movement and keeps the best match", () => {
    const r = test_({});
    expect(r.options.length).toBeGreaterThanOrEqual(3);
    expect(r.options.every((o) => o.movement === "same" && o.delta === 0 && !o.fitChanged)).toBe(true);
    expect(r.best.changed).toBe(false);
    expect(r.hardestHit).toBeNull();
    expect(r.dropped).toEqual([]);
  });

  test("much less rain never lowers the seasons at risk, and puts the farmer's own rotation in the list", () => {
    const r = test_({ rainPct: -40 });
    expect(r.options.some((o) => o.isYours)).toBe(true);
    for (const o of r.options) {
      expect(o.before).not.toBeNull();
      expect(o.delta ?? 0).toBeGreaterThanOrEqual(0);
      expect(o.after.known).toBe(o.before!.known);
    }
    expect(r.counts.better).toBe(0);
  });

  test("much more rain never raises the seasons at risk", () => {
    const r = test_({ rainPct: 40 });
    for (const o of r.options) expect(o.delta ?? 0).toBeLessThanOrEqual(0);
  });

  test("a late monsoon hurts at least one option on a marginal record, and can help another", () => {
    const r = test_({ delayDays: 30 }, marginal);
    expect(r.counts.worse).toBeGreaterThan(0);
    expect(r.hardestHit?.delta).toBeGreaterThan(0);
    // Timing moves rain into some crop windows and out of others, so it is not one-way like a rain cut.
    expect(r.counts.better).toBeGreaterThan(0);
  });

  test("a dry test can change the best match, and says which option it becomes", () => {
    const r = test_({ rainPct: -30 }, marginal);
    expect(r.best.changed).toBe(true);
    expect(r.best.beforeLabel).not.toBeNull();
    expect(r.best.afterLabel).not.toBeNull();
    expect(r.best.afterId).toBe(r.options.find((o) => o.after.place === 1)?.id);
  });

  test("the option that holds up best has the lowest share at risk after the test", () => {
    const r = test_({ rainPct: -30, tempC: 1.5 });
    expect(r.holdsUp).not.toBeNull();
    const share = (o: (typeof r.options)[number]) => o.after.stressed / o.after.known;
    const judged = r.options.filter((o) => o.after.known > 0 && o.after.fit !== "does-not-fit");
    expect(share(r.holdsUp!)).toBe(Math.min(...judged.map(share)));
  });

  test("leaving the farmer's rotation out drops it from the list", () => {
    const r = whatIfResult(compare(NO_SCENARIO), compare({ ...NO_SCENARIO, rainPct: -20 }), { includeCurrent: false });
    expect(r.options.some((o) => o.isYours)).toBe(false);
  });
});
