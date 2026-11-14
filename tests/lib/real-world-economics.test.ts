import { describe, expect, it } from "vitest";
import {
  REAL_WORLD_CROP_ECONOMICS,
  getRealWorldCropEconomics,
  getDefaultEconomicsForCrops,
} from "@/lib/data/crops/real-world-economics";
import { CROPS } from "@/lib/data/crops";
import { economicsFor } from "@/lib/engine/economics";
import type { Rotation } from "@/lib/types";

describe("Real-World Crop Economics Module", () => {
  it("provides realistic market benchmarks for all crops in the crop catalog", () => {
    for (const crop of CROPS) {
      const benchmark = REAL_WORLD_CROP_ECONOMICS[crop.id];
      expect(benchmark, `Missing benchmark for crop ${crop.id}`).toBeDefined();
      expect(benchmark!.priceMmkPerKg![0]).toBeGreaterThan(0);
      expect(benchmark!.priceMmkPerKg![1]).toBeGreaterThanOrEqual(benchmark!.priceMmkPerKg![0]);
      expect(benchmark!.yieldKgHa![0]).toBeGreaterThan(0);
      expect(benchmark!.yieldKgHa![1]).toBeGreaterThanOrEqual(benchmark!.yieldKgHa![0]);
      expect(benchmark!.costMmkPerHa![0]).toBeGreaterThan(0);
      expect(benchmark!.costMmkPerHa![1]).toBeGreaterThanOrEqual(benchmark!.costMmkPerHa![0]);
      expect(benchmark!.source.length).toBeGreaterThan(10);
      expect(benchmark!.burmeseName.length).toBeGreaterThan(0);
      expect(benchmark!.traditionalUnitNote.length).toBeGreaterThan(0);
    }
  });

  it("retrieves benchmark by ID via getRealWorldCropEconomics", () => {
    const rice = getRealWorldCropEconomics("rice");
    expect(rice).toBeDefined();
    expect(rice?.burmeseName).toBe("မိုးစပါး / နွေစပါး");
    expect(rice?.priceMmkPerKg).toEqual([950, 1300]);
    expect(rice?.yieldKgHa).toEqual([3200, 4800]);

    const blackGram = getRealWorldCropEconomics("black-gram");
    expect(blackGram?.burmeseName).toBe("မတ်ပဲ");
    expect(blackGram?.priceMmkPerKg).toEqual([3200, 3850]);

    const unknown = getRealWorldCropEconomics("unknown-crop" as unknown as (typeof CROPS)[number]["id"]);
    expect(unknown).toBeUndefined();
  });

  it("converts list of crop IDs into default CropEconomics entries", () => {
    const defaults = getDefaultEconomicsForCrops(["rice", "black-gram"]);
    expect(defaults).toHaveLength(2);

    expect(defaults[0]).toMatchObject({
      cropId: "rice",
      yieldKgHa: [3200, 4800],
      priceMmkPerKg: [950, 1300],
      costMmkPerHa: [850000, 1350000],
    });
    expect(defaults[0].source).toContain("DOA");

    expect(defaults[1]).toMatchObject({
      cropId: "black-gram",
      yieldKgHa: [1000, 1600],
      priceMmkPerKg: [3200, 3850],
      costMmkPerHa: [550000, 850000],
    });
  });

  it("preserves strict non-imputation in economicsFor by default when farmer inputs are omitted", () => {
    const rotation: Rotation = {
      id: "rot-1",
      fieldId: "field-1",
      label: "Test Rotation",
      source: "farmer",
      cycleYears: 1,
      slots: [
        {
          id: "s1",
          kind: "crop",
          cropId: "rice",
          plantDate: "2025-06-15",
          harvestDate: "2025-10-15",
          dateConfidence: "exact",
          irrigated: false,
        },
      ],
    };

    const result = economicsFor(rotation, undefined, 2);
    expect(result.unknownSlots).toBe(1);
    expect(result.cycleMarginMmkHa).toBeNull();
    expect(result.annualizedMarginMmkHa).toBeNull();
  });

  it("supports fallbackToRealWorld in economicsFor to evaluate rotations using regional market prices", () => {
    const rotation: Rotation = {
      id: "rot-1",
      fieldId: "field-1",
      label: "Test Rotation",
      source: "farmer",
      cycleYears: 1,
      slots: [
        {
          id: "s1",
          kind: "crop",
          cropId: "rice",
          plantDate: "2025-06-15",
          harvestDate: "2025-10-15",
          dateConfidence: "exact",
          irrigated: false,
        },
        {
          id: "s2",
          kind: "crop",
          cropId: "black-gram",
          plantDate: "2025-11-01",
          harvestDate: "2026-02-15",
          dateConfidence: "exact",
          irrigated: false,
        },
      ],
    };

    const result = economicsFor(rotation, undefined, 2, { fallbackToRealWorld: true });
    expect(result.unknownSlots).toBe(0);
    expect(result.cycleMarginMmkHa).toBeDefined();
    expect(result.annualizedMarginMmkHa).toBeDefined();
    // Gross margins per year should be well within realistic ranges for 2 crops in Myanmar
    expect(result.cycleMarginMmkHa?.[0]).toBeGreaterThan(0);
    expect(result.cycleMarginMmkHa?.[1]).toBeGreaterThan(result.cycleMarginMmkHa?.[0] ?? 0);
    expect(result.annualizedMarginMmkHa?.[0]).toBeGreaterThan(0);
  });
});
