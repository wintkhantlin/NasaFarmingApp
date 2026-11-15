import { describe, it, expect } from "vitest";
import { regionOfPoint } from "../../lib/data/regions";
import { engineData, rotation, slot, syntheticField, syntheticWeather } from "../helpers/synthetic";
import { compareRotations } from "../../lib/engine/compare";
import { adaptComparison } from "../../lib/plan/engine-display";
import { resolveRegionalPreview } from "../../lib/plan/regional-preview";

describe("Myanmar national coverage", () => {
  it("recognizes Yangon, Mandalay, Bago, Naypyidaw and northern/southern Myanmar without claiming neighboring countries", () => {
    expect(regionOfPoint([96.24, 16.75])).toBe("yangon"); // Dagon Seikkan
    for (const point of [[96.08,21.98],[96.48,17.33],[96.12,19.76],[97.4,25.38],[98.61,12.44]]) {
      expect(regionOfPoint(point as [number, number])).toBe("myanmar");
    }
    expect(regionOfPoint([100.5,13.75])).toBe("unsupported");
    expect(regionOfPoint([94.95,20.15])).toBe("magway");
  });
  it("keeps nationwide templates unavailable while retaining actual crop assessment", () => {
    expect(resolveRegionalPreview("myanmar", "rice").availability).toBe("templates-unavailable");
    const yangonPreview = resolveRegionalPreview("yangon", "rice");
    expect(yangonPreview.availability).toBe("templates-unavailable");
    expect(yangonPreview.patterns).toHaveLength(0);
    const field = syntheticField({ centroid: [96.12,19.76], region: "myanmar", priorities: { order: ["water"], weights: {} } });
    const current = rotation(field.id, [slot("s", "rice", "2026-06-15", "2026-10-15")]);
    const data = engineData(field, syntheticWeather());
    const comparison = compareRotations(data, current);
    const view = adaptComparison({ mode: "field", phase: "ready", field, rotation: current, data, comparison, inputRevision: "1", resultRevision: "1" });
    expect(view.state).toBe("unresolved");
    expect(view.options).toHaveLength(1);
    expect(view.options[0].kind).toBe("current");
    expect(comparison.alternatives).toHaveLength(0);
  });

  it("does not rank or invent Yangon alternatives when no trusted local catalog exists", () => {
    const field = syntheticField({
      centroid: [96.24, 16.75],
      region: "yangon",
      priorities: { order: ["water"], weights: {} },
    });
    const current = rotation(field.id, [slot("s", "rice", "2026-06-15", "2026-10-15")]);
    const data = engineData(field, syntheticWeather());
    const comparison = compareRotations(data, current);
    const view = adaptComparison({ mode: "field", phase: "ready", field, rotation: current, data, comparison, inputRevision: "1", resultRevision: "1" });

    expect(view.state).toBe("unresolved");
    expect(view.headline).toBe("We can't suggest other crops for your area yet");
    expect(view.detail).toContain("Yangon Region");
    expect(view.detail).not.toMatch(/stress test|trusted|catalog/i);
    expect(view.options).toHaveLength(1);
    expect(comparison.alternatives).toHaveLength(0);
  });
});
