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
    locationConfirmed: true,
    createdAt: "2026-11-14T00:00:00Z",
    updatedAt: "2026-11-14T00:00:00Z",
  };

  it("marks rotation as needs-input when no rotation has been recorded", () => {
    const states = deriveStepStates(mockField, []);
    expect(states.location).toBe("done");
    expect(states.rotation).toBe("needs-input");
    expect(states.profile).toBe("not-started");
    expect(states.conditions).toBe("not-started");
    expect(states.compare).toBe("not-started");
  });

  it("a saved plan alone does not count as the crops grown now", () => {
    const plan: Rotation = { id: "p", fieldId: mockField.id, label: "plan", cycleYears: 1, source: "strategy",
      slots: [{ id: "s", kind: "crop", cropId: "rice", plantDate: "2026-06-01", harvestDate: "2026-09-30", dateConfidence: "typical", irrigated: false }] };
    expect(deriveStepStates(mockField, [plan]).rotation).toBe("needs-input");
    expect(deriveStepStates(mockField, [plan, { ...plan, id: "f", source: "farmer" }]).rotation).toBe("done");
  });

  it("a location the farmer has not confirmed still needs input", () => {
    const states = deriveStepStates({ ...mockField, locationConfirmed: false }, []);
    expect(states.location).toBe("needs-input");
  });

  it("the Your farm step is done once priorities are set, and never blocks the others", () => {
    const withPriorities: Field = { ...mockField, priorities: { order: ["water"], weights: {} } };
    expect(deriveStepStates(withPriorities, []).profile).toBe("done");
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
    // Crops alone do not make Compare "done": a comparison has to have been shown.
    expect(states.compare).toBe("needs-input");
    expect(deriveStepStates(mockField, [rotation], { compareViewed: true }).compare).toBe("done");
    expect(deriveStepStates(mockField, [], { compareViewed: true }).compare).toBe("not-started");
  });
});
