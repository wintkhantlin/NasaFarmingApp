import { describe, expect, test } from "vitest";
import { compareRotations } from "../../lib/engine/compare";
import { adaptComparison } from "../../lib/plan/engine-display";
import { buildResultsModel, classifyUnknown } from "../../lib/plan/results-model";
import { engineData, rotation, slot, syntheticField, syntheticWeather } from "../helpers/synthetic";

const field = syntheticField({ priorities: { order: ["water", "soil"], weights: {} } });
const mine = rotation(field.id, [slot("sesame", "sesame", "2026-05-15", "2026-08-23"), slot("gram", "green-gram", "2026-08-30", "2026-11-13")]);
const data = engineData(field, syntheticWeather());
const result = compareRotations(data, mine, { baseYear: 2026, now: new Date("2026-11-14T00:00:00Z") });
const display = adaptComparison({ mode: "field", phase: "ready", field, rotation: mine, data, comparison: result, inputRevision: "r", resultRevision: "r" });
const options = [result.current, ...display.options.filter((o) => o.kind === "alternative").map((o) => o.engine)];
const model = buildResultsModel({ field, comparison: result, display, options });

describe("results model", () => {
  test("covers every comparison dimension for every option", () => {
    expect(model.dimensions.map((d) => d.id)).toEqual(["suitability", "water", "climate", "soil", "nitrogen", "pest", "erosion", "economics"]);
    for (const d of model.dimensions) for (const o of model.options) expect(d.cells[o.id]?.text).toBeTruthy();
  });

  test("status mirrors the engine and never invents a winner when unresolved", () => {
    expect(["complete", "partial", "unresolved"]).toContain(model.status);
    const unresolved = buildResultsModel({ field, comparison: result, display: { ...display, state: "unresolved" }, options });
    expect(unresolved.status).toBe("unresolved");
  });

  test("ranking order is exactly the engine ranking", () => {
    expect(model.ranking.map((r) => r.optionId)).toEqual(result.mcda.ranking.map((r) => r.rotationId));
  });

  test("missing economics are labelled, not zero", () => {
    const bare = { ...result.current, economics: { ...result.current.economics, cycleMarginMmkHa: null } };
    const m = buildResultsModel({ field, comparison: { ...result, current: bare }, display, options: [bare, ...options.slice(1)] });
    const cell = m.dimensions.find((d) => d.id === "economics")!.cells[bare.id];
    expect(cell.missing).toBe("not-measured");
    expect(cell.text).not.toMatch(/\b0 MMK/);
  });

  test("unknowns are sorted into the four kinds", () => {
    expect(classifyUnknown("Slope of the field (needs terrain data)")).toBe("not-available");
    expect(classifyUnknown("Nitrogen removed at harvest (needs your yields)")).toBe("not-measured");
    expect(classifyUnknown("Something else")).toBe("unknown");
  });

  test("why-sections exist only for alternatives and use engine parts", () => {
    expect(model.why[result.current.id]).toBeUndefined();
    for (const o of model.options.filter((x) => !x.isYours)) expect(model.why[o.id].optionId).toBe(o.id);
  });
});
