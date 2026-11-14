import { describe, expect, it } from "vitest";
import { deriveStepStates } from "@/lib/store/fields-store";
import type { Field, Rotation } from "@/lib/types";

describe("Flow step states", () => {
  const mockField: Field = {
    id: "f-test",
    name: "Valley Plot",
    geometry: { type: "Point", coordinates: [-93.65, 42.03] },
    areaHa: 25,
    centroid: [-93.65, 42.03],
    samplePoints: [[-93.65, 42.03]],
    irrigation: "none",
    createdAt: "2026-11-14T00:00:00Z",
    updatedAt: "2026-11-14T00:00:00Z",
  };

  it("marks rotation as needs-input when no rotation has been recorded", () => {
    const states = deriveStepStates(mockField, []);
    expect(states.location).toBe("done");
    expect(states.rotation).toBe("needs-input");
    expect(states.conditions).toBe("not-started");
    expect(states.compare).toBe("not-started");
  });

  it("flips rotation, conditions, and compare to done/ready once rotation has slots", () => {
    const rotation: Rotation = {
      id: "rot-1",
      fieldId: "f-test",
      label: "Corn-Soy cycle",
      cycleYears: 2,
      slots: [
        {
          id: "s-1",
          kind: "crop",
          cropId: "maize",
          plantDate: "2025-05-10",
          harvestDate: "2025-09-20",
          dateConfidence: "typical",
          irrigated: false,
        },
      ],
      source: "farmer",
    };

    const states = deriveStepStates(mockField, [rotation]);
    expect(states.location).toBe("done");
    expect(states.rotation).toBe("done");
    expect(states.conditions).toBe("done");
    expect(states.compare).toBe("done");
  });
});
