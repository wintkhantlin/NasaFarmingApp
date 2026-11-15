import { describe, expect, test } from "vitest";
import { compareRotations } from "../../lib/engine/compare";
import { adaptComparison } from "../../lib/plan/engine-display";
import { resolveRegionalPreview, type RegionalPreviewCatalog } from "../../lib/plan/regional-preview";
import { engineData, rotation, slot, syntheticField, syntheticWeather } from "../helpers/synthetic";

const field = syntheticField({ priorities: { order: ["water", "soil"], weights: {} } });
const mine = rotation(field.id, [slot("sesame", "sesame", "2026-05-15", "2026-08-23"), slot("gram", "green-gram", "2026-08-30", "2026-11-13")]);
const data = engineData(field, syntheticWeather());
const result = compareRotations(data, mine, { baseYear: 2026, now: new Date("2026-11-14T00:00:00Z") });
const input = (over: Partial<Parameters<typeof adaptComparison>[0] & { mode: "field" }> = {}) => ({
  mode: "field" as const, phase: "ready" as const, field, rotation: mine, data, comparison: result,
  inputRevision: "r1", resultRevision: "r1", ...over,
});

describe("typed engine display adapter", () => {
  test("regional catalog preview never becomes a field comparison", () => {
    const preview = resolveRegionalPreview("magway", "sesame");
    const view = adaptComparison({ mode: "regional-preview", preview });
    expect(view.state).toBe("regional-preview");
    expect(view.options).toHaveLength(0);
  });

  test("an empty versioned catalog stays templates-unavailable", () => {
    const catalog: RegionalPreviewCatalog = { version: "empty-test", cropLibraryVersion: "test", entries: {} };
    const preview = resolveRegionalPreview("magway", "sesame", catalog);
    expect(preview.availability).toBe("templates-unavailable");
    expect(adaptComparison({ mode: "regional-preview", preview }).options).toHaveLength(0);
  });

  test("requires the farmer's confirmed location and actual sequence", () => {
    expect(adaptComparison(input({ rotation: undefined })).state).toBe("field-incomplete");
    expect(adaptComparison(input({ field: { ...field, locationConfirmed: false } })).state).toBe("field-incomplete");
  });

  test("a saved example plan gets a friendly next step without becoming field history", () => {
    const view = adaptComparison(input({ rotation: { ...mine, source: "strategy" }, comparison: null }));
    expect(view.state).toBe("field-incomplete");
    expect(view.headline).toBe("Your plan is saved");
    expect(view.detail).toContain("do not need to guess exact dates");
    expect(view.options).toHaveLength(0);
  });

  test("stale edits hide old options before they can be acted on", () => {
    const view = adaptComparison(input({ inputRevision: "r2" }));
    expect(view.state).toBe("stale");
    expect(view.options).toHaveLength(0);
  });

  test("loading, failed and unavailable sources have distinct states", () => {
    expect(adaptComparison(input({ phase: "loading", comparison: null })).state).toBe("evaluating");
    expect(adaptComparison(input({ phase: "failed", comparison: null })).state).toBe("error");
    expect(adaptComparison(input({ comparison: null })).state).toBe("data-unavailable");
  });

  test("no alternatives does not fabricate templates", () => {
    const view = adaptComparison(input({ comparison: { ...result, alternatives: [], mcda: { ...result.mcda, ranking: [] } } }));
    expect(view.state).toBe("data-unavailable");
    expect(view.options.filter((o) => o.kind === "alternative")).toHaveLength(0);
  });

  test("unsupported location names the region boundary even when weather is complete", () => {
    const view = adaptComparison(input({ comparison: { ...result, region: "unsupported", alternatives: [], rejected: [], shortfall: "Outside Ayeyarwady, Magway and Shan State." } }));
    expect(view.headline).toBe("This field appears to be outside Myanmar");
    expect(view.detail).toContain("Check the saved field location");
    expect(view.gaps).toContain("Outside Ayeyarwady, Magway and Shan State.");
  });

  test("weather-complete exclusion explains crop checks rather than implying missing weather", () => {
    const alternatives = result.alternatives.map(o => ({ ...o, fit: "does-not-fit" as const, noFitReason: "Two crops overlap by 12 days." }));
    const view = adaptComparison(input({ comparison: { ...result, alternatives } }));
    expect(view.headline).toBe("Not enough crop choices to compare");
    expect(view.detail).toContain("The weather information is ready");
    expect(view.gaps.some(g => g.includes("Two crops overlap by 12 days."))).toBe(true);
    expect(view.options.filter(o => o.kind === "alternative")).toHaveLength(0);
  });

  test("source gaps use plain farmer-facing explanations", () => {
    const view = adaptComparison(input());
    expect(view.gaps).toContain("Detailed satellite rain data is not available. We used NASA POWER regional rain estimates instead.");
    expect(view.gaps).toContain("Regional soil-moisture information is not available, so the soil's starting moisture is unknown.");
    expect(view.gaps.join(" ")).not.toContain("SRTM terrain");
  });

  test("a shared soil disease between crops leads the trade-off", () => {
    // Sesame then green gram: different families, but both host Macrophomina (charcoal rot).
    const view = adaptComparison(input());
    expect(view.options[0].tradeOff).toContain("charcoal rot");
  });

  test("option cautions explain model limits in farmer-facing words", () => {
    // Without the agronomic pest finding, the model-limit caution is the trade-off.
    const comparison = { ...result, current: { ...result.current, risks: result.current.risks.filter((r) => !r.id.startsWith("pest:")) } };
    const view = adaptComparison(input({ comparison }));
    expect(view.options[0].tradeOff).not.toContain("species-level starting values");
    expect(view.options[0].tradeOff).toContain("general crop information");
  });

  test("missing first-priority evidence stays unresolved, never zero", () => {
    const comparison = { ...result, current: { ...result.current, metrics: { ...result.current.metrics, "water-shortfall": null } }, mcda: { ...result.mcda, status: "unresolved" as const, ranking: [], note: "First-priority evidence missing." } };
    const view = adaptComparison(input({ comparison }));
    expect(view.state).toBe("unresolved");
    expect(view.detail).toContain("Information for your main priority is missing");
    expect(view.options[0].engine.metrics["water-shortfall"]).toBeNull();
    expect(view.options[0].engine.metrics["water-shortfall"]).not.toBe(0);
  });

  test("partial candidates remain visibly partial", () => {
    const candidate = result.alternatives[0];
    const comparison = { ...result, mcda: { ...result.mcda, partial: [{ rotationId: candidate.id, missing: ["water-shortfall" as const], lacksTopPriority: false, warning: "Rain evidence missing" }] } };
    const view = adaptComparison(input({ comparison }));
    expect(view.state).toBe("partial-evidence");
    expect(view.engineStatus).toBe(comparison.mcda.status);
  });

  test("equal displayed ranks cannot be called a winner", () => {
    const ranking = result.mcda.ranking.slice(0, 2).map((r) => ({ ...r, score: 0.5 }));
    const view = adaptComparison(input({ comparison: { ...result, mcda: { ...result.mcda, status: "ranked", ranking } } }));
    expect(view.tiedFirst).toBe(true);
    expect(view.headline).not.toMatch(/winner|best match/i);
  });

  test("historical replay and source lineage come from the engine result", () => {
    const view = adaptComparison(input());
    expect(view.replay).toEqual(result.baseline);
    expect(view.detail).toContain("past years from 2016–2025");
    expect(view.detail).toContain("confirm local prices and field conditions");
    expect(view.sourceStatuses?.power).toBe(data.power.status);
    const source = view.options[0].sources[0];
    const indicator = result.current.evidence[0].indicator;
    expect(source?.product).toBe(indicator.product);
    expect(source?.lineage).toContain(indicator.product);
    expect(source?.missingReason).toBe(indicator.missingReason);
  });
});
