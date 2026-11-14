import { describe, expect, it } from "vitest";
import { generateStrategies } from "@/lib/engine/strategies";
import type { Field, Rotation } from "@/lib/types";

describe("Strategy engine", () => {
  const dummyField: Field = {
    id: "f-123",
    name: "North 40",
    geometry: { type: "Point", coordinates: [-93.65, 42.03] },
    areaHa: 40,
    centroid: [-93.65, 42.03],
    samplePoints: [[-93.65, 42.03]],
    irrigation: "none",
    createdAt: "2026-11-14T00:00:00Z",
    updatedAt: "2026-11-14T00:00:00Z",
  };

  const dummyRotation: Rotation = {
    id: "r-1",
    fieldId: "f-123",
    label: "Continuous Maize",
    cycleYears: 1,
    slots: [
      {
        id: "s-1",
        kind: "crop",
        cropId: "maize",
        plantDate: "2025-05-10",
        harvestDate: "2025-09-25",
        dateConfidence: "exact",
        irrigated: false,
      },
    ],
    source: "farmer",
  };

  it("generates baseline and at least two climate alternatives", () => {
    const res = generateStrategies(dummyField, dummyRotation, 700);
    expect(res.current).toBeDefined();
    expect(res.alternatives.length).toBeGreaterThanOrEqual(2);
    expect(res.current.evidence.length).toBeGreaterThan(0);
    expect(res.alternatives[0].badge).toContain("Most reliable");
    expect(res.alternatives[1].badge).toContain("Highest soil");
  });

  it("detects water deficit risk for rainfed sensitive crops under low rainfall", () => {
    const dryRes = generateStrategies(dummyField, dummyRotation, 450);
    const hasWaterRisk = dryRes.current.risks.some((r) => r.id === "risk-water-deficit");
    expect(hasWaterRisk).toBe(true);
  });
});
