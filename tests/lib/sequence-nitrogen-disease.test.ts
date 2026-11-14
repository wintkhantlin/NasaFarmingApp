import { describe, expect, it } from "vitest";
import { evaluateTransition, isRelayPairEligible } from "../../lib/engine/transition";
import { assessResidueNitrogen } from "../../lib/engine/soil-health";
import { detectMultiYearDiseasePressure } from "../../lib/engine/pest";
import type { Rotation, RotationSlot } from "../../lib/types";
import { rotationSchema } from "../../lib/schemas/field";

describe("PROMPT 4: Sequence Rules, Nitrogen & Disease Caution (A-01, A-02, U-02)", () => {
  describe("Relay Broadcast Transitions (U-02)", () => {
    it("recognizes documented rice -> black gram and rice -> green gram as eligible relay pairs", () => {
      expect(isRelayPairEligible("rice", "black-gram")).toBe(true);
      expect(isRelayPairEligible("rice", "green-gram")).toBe(true);
      expect(isRelayPairEligible("rice", "sesame")).toBe(false);
      expect(isRelayPairEligible("maize", "black-gram")).toBe(false);
    });

    it("accepts negative gap when relay broadcast is chosen for an eligible pair", () => {
      const rice: Pick<RotationSlot, "cropId" | "harvestDate"> = {
        cropId: "rice",
        harvestDate: "2025-11-10",
      };
      const pulse: Pick<RotationSlot, "cropId" | "plantDate" | "establishmentMode"> = {
        cropId: "black-gram",
        plantDate: "2025-11-03", // 7 days before rice harvest
        establishmentMode: "relay_broadcast",
      };

      const assessment = evaluateTransition(rice, pulse);
      expect(assessment.status).toBe("relay");
      expect(assessment.isRelay).toBe(true);
      expect(assessment.overlapDays).toBe(7);
      expect(assessment.evaluationStatus).toBe("not-evaluated");
      expect(assessment.message).toContain("models are unverified");
    });

    it("rejects negative gap (collision) when pairing is not eligible or method is not relay", () => {
      const rice: Pick<RotationSlot, "cropId" | "harvestDate"> = {
        cropId: "rice",
        harvestDate: "2025-11-10",
      };
      // Sesame cannot be relay broadcast into standing rice
      const sesame: Pick<RotationSlot, "cropId" | "plantDate" | "establishmentMode"> = {
        cropId: "sesame",
        plantDate: "2025-11-03",
        establishmentMode: "relay_broadcast",
      };

      const assessment = evaluateTransition(rice, sesame);
      expect(assessment.status).toBe("collision");
      expect(assessment.message).toContain("not documented for this crop pairing");

      // Black gram with conventional tillage cannot overlap with rice harvest
      const pulseTillage: Pick<RotationSlot, "cropId" | "plantDate" | "establishmentMode"> = {
        cropId: "black-gram",
        plantDate: "2025-11-03",
        establishmentMode: "tillage",
      };
      const tillageAssessment = evaluateTransition(rice, pulseTillage);
      expect(tillageAssessment.status).toBe("collision");
    });
  });

  describe("Residue Nitrogen Fate & plant-available N (A-01)", () => {
    const basePulseSlot: RotationSlot = {
      id: "slot-1",
      kind: "crop",
      cropId: "black-gram",
      plantDate: "2025-11-15",
      harvestDate: "2026-02-15",
      dateConfidence: "exact",
      irrigated: false,
      yield: { value: 1.2, unit: "t/ha" },
    };

    it("keeps unknown residue fate as unquantified with no guaranteed N credit", () => {
      const res = assessResidueNitrogen({ ...basePulseSlot, residueFate: "unknown" });
      expect(res.status).toBe("unquantified");
      expect(res.exportPercentage).toBeNull();
      expect(res.caveat).toContain("No plant-available N or soil organic credit is awarded");
    });

    it("calculates high volatilization loss and zero N carryover for burned residue", () => {
      const res = assessResidueNitrogen({ ...basePulseSlot, residueFate: "burn" });
      expect(res.status).toBe("quantified");
      expect(res.exportPercentage).toBe(95);
      expect(res.estimatedNextCropAvailableN?.maxKgHa).toBe(0);
      expect(res.caveat).toContain("zero nitrogen carryover");
    });

    it("calculates high export and minimal carryover for fodder removal", () => {
      const res = assessResidueNitrogen({ ...basePulseSlot, residueFate: "remove_fodder" });
      expect(res.status).toBe("quantified");
      expect(res.exportPercentage).toBe(85);
      expect(res.estimatedNextCropAvailableN?.maxKgHa).toBeLessThanOrEqual(2);
    });

    it("calculates bounded first-season plant-available N when legume residue is retained with yield", () => {
      const res = assessResidueNitrogen({ ...basePulseSlot, residueFate: "retain_incorporate" });
      expect(res.status).toBe("quantified");
      expect(res.exportPercentage).toBe(10);
      expect(res.estimatedNextCropAvailableN?.minKgHa).toBeGreaterThan(0);
      expect(res.estimatedNextCropAvailableN?.maxKgHa).toBeLessThan(25);
      expect(res.caveat).toContain("Residue N is organic and releases gradually");
    });

    it("flags microbial nitrogen immobilization risk for cereal straw incorporated shortly before planting", () => {
      const riceSlot: RotationSlot = {
        id: "slot-rice",
        kind: "crop",
        cropId: "rice",
        plantDate: "2025-06-15",
        harvestDate: "2025-10-25",
        dateConfidence: "exact",
        irrigated: true,
        residueFate: "retain_incorporate",
        yield: { value: 4.0, unit: "t/ha" },
      };
      const nextPulseSlot: RotationSlot = {
        id: "slot-next",
        kind: "crop",
        cropId: "black-gram",
        plantDate: "2025-11-05", // 11 days turnaround (< 21d)
        harvestDate: "2026-02-15",
        dateConfidence: "exact",
        irrigated: false,
      };

      const res = assessResidueNitrogen(riceSlot, nextPulseSlot);
      expect(res.status).toBe("quantified");
      expect(res.estimatedNextCropAvailableN?.minKgHa).toBeLessThan(0); // immobilization
      expect(res.estimatedNextCropAvailableN?.note).toContain("microbial nitrogen immobilization");
    });
  });

  describe("Multi-Year Seasonal Disease Pressure (A-02)", () => {
    it("flags caution when the same legume family recurs in the post-monsoon slot in consecutive years", () => {
      const continuousLegumeRotation: Pick<Rotation, "slots" | "cycleYears"> = {
        cycleYears: 2,
        slots: [
          {
            id: "s1",
            kind: "crop",
            cropId: "rice",
            plantDate: "2025-06-15",
            harvestDate: "2025-10-20",
            dateConfidence: "exact",
            irrigated: true,
          },
          {
            id: "s2",
            kind: "crop",
            cropId: "black-gram",
            plantDate: "2025-10-28", // Post-monsoon Year 1
            harvestDate: "2026-01-30",
            dateConfidence: "exact",
            irrigated: false,
          },
          {
            id: "s3",
            kind: "crop",
            cropId: "rice",
            plantDate: "2026-06-15",
            harvestDate: "2026-10-20",
            dateConfidence: "exact",
            irrigated: true,
          },
          {
            id: "s4",
            kind: "crop",
            cropId: "black-gram",
            plantDate: "2026-10-28", // Post-monsoon Year 2 (consecutive recurrence!)
            harvestDate: "2027-01-30",
            dateConfidence: "exact",
            irrigated: false,
          },
        ],
      };

      const warnings = detectMultiYearDiseasePressure(continuousLegumeRotation);
      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings[0].family).toBe("Fabaceae");
      expect(warnings[0].severity).toBe("caution");
      expect(warnings[0].message).toContain("Repeated cultivation of Fabaceae");
      expect(warnings[0].recommendation).toContain("introducing a non-host break crop");
    });

    it("clears consecutive seasonal recurrence warning when a non-host break crop is inserted", () => {
      const diversifiedRotation: Pick<Rotation, "slots" | "cycleYears"> = {
        cycleYears: 2,
        slots: [
          {
            id: "s1",
            kind: "crop",
            cropId: "rice",
            plantDate: "2025-06-15",
            harvestDate: "2025-10-20",
            dateConfidence: "exact",
            irrigated: true,
          },
          {
            id: "s2",
            kind: "crop",
            cropId: "black-gram", // Post-monsoon Year 1 (Fabaceae)
            plantDate: "2025-10-28",
            harvestDate: "2026-01-30",
            dateConfidence: "exact",
            irrigated: false,
          },
          {
            id: "s3",
            kind: "crop",
            cropId: "rice",
            plantDate: "2026-06-15",
            harvestDate: "2026-10-20",
            dateConfidence: "exact",
            irrigated: true,
          },
          {
            id: "s4",
            kind: "crop",
            cropId: "sesame", // Post-monsoon Year 2 (Pedaliaceae break crop!)
            plantDate: "2026-11-05",
            harvestDate: "2027-02-15",
            dateConfidence: "exact",
            irrigated: false,
          },
        ],
      };

      const warnings = detectMultiYearDiseasePressure(diversifiedRotation);
      expect(warnings.length).toBe(0);
    });
  });

  describe("Backward Compatibility", () => {
    it("parses old rotation plans without new optional fields", () => {
      const legacyPlan = {
        id: "rot-legacy",
        fieldId: "field-1",
        label: "Legacy Rotation",
        cycleYears: 1,
        source: "farmer",
        slots: [
          {
            id: "slot-legacy-1",
            kind: "crop",
            cropId: "rice",
            plantDate: "2025-06-15",
            harvestDate: "2025-10-20",
            dateConfidence: "exact",
            irrigated: true,
          },
        ],
      };

      const parsed = rotationSchema.safeParse(legacyPlan);
      expect(parsed.success).toBe(true);
    });
  });
});
