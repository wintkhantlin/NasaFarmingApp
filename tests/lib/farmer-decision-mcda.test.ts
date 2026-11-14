import { describe, expect, it } from "vitest";
import {
  classifyRotationFeasibility,
  mapFarmerPrioritiesToMcda,
  evaluateDeterministicSensitivity,
  compareBaselineVsNasa,
  type FarmerDecisionInput,
} from "../../lib/engine/farmer-decision";
import { rankRotations, type McdaInput } from "../../lib/engine/mcda";
import type { Rotation } from "../../lib/types";

describe("PROMPT 6: Farmer Constraints, Safe MCDA & Decision Sensitivity (D-01, D-02)", () => {
  const rainfedPulseRotation: Rotation = {
    id: "rice-pulse-rainfed",
    fieldId: "field-delta",
    label: "Monsoon Rice -> Post-monsoon Black Gram",
    cycleYears: 1,
    source: "strategy",
    slots: [
      {
        id: "s1",
        kind: "crop",
        cropId: "rice",
        plantDate: "2025-06-15",
        harvestDate: "2025-10-20",
        dateConfidence: "exact",
        irrigated: false,
      },
      {
        id: "s2",
        kind: "crop",
        cropId: "black-gram",
        plantDate: "2025-10-28",
        harvestDate: "2026-02-10",
        dateConfidence: "exact",
        irrigated: false,
      },
    ],
  };

  const highProfitIrrigatedSummerRice: Rotation = {
    id: "rice-summer-rice",
    fieldId: "field-delta",
    label: "Monsoon Rice -> Irrigated Summer Rice",
    cycleYears: 1,
    source: "strategy",
    slots: [
      {
        id: "s1",
        kind: "crop",
        cropId: "rice",
        plantDate: "2025-06-15",
        harvestDate: "2025-10-20",
        dateConfidence: "exact",
        irrigated: false,
      },
      {
        id: "s2",
        kind: "crop",
        cropId: "rice",
        plantDate: "2026-01-15",
        harvestDate: "2026-05-15",
        dateConfidence: "exact",
        irrigated: true, // Requires full dry-season irrigation!
      },
    ],
  };

  describe("Hard Feasibility Gate (D-01)", () => {
    it("high profit cannot override confirmed no-water constraint", () => {
      const rainfedFarmer: FarmerDecisionInput = {
        topPriorities: ["profit"], // Wants high profit
        availableWater: "rainfed", // But has NO irrigation!
        equipment: "tractor_tiller",
      };

      const summerRiceFeasibility = classifyRotationFeasibility(
        highProfitIrrigatedSummerRice,
        rainfedFarmer,
      );

      // Irrigated summer rice MUST be infeasible despite high profit priority!
      expect(summerRiceFeasibility.status).toBe("infeasible");
      expect(summerRiceFeasibility.hardConstraintVetoes).toContain("WATER_UNAVAILABLE:rice");
      expect(summerRiceFeasibility.reasons[0].code).toBe("WATER_DEFICIT_CONFIRMED");

      // Rainfed pulse should be feasible
      const pulseFeasibility = classifyRotationFeasibility(
        rainfedPulseRotation,
        rainfedFarmer,
      );
      expect(pulseFeasibility.status).toBe("feasible");
    });

    it("high profit cannot override confirmed budget limit", () => {
      const budgetConstrainedFarmer: FarmerDecisionInput = {
        topPriorities: ["profit"],
        availableWater: "reliable_irrigation",
        budgetMaxMmkHa: 800000, // Max 800,000 MMK/ha budget
        equipment: "tractor_tiller",
      };

      const mockEconomics = [
        { cropId: "rice", costMmkPerHa: [850000, 1200000] as [number, number], source: "test" },
      ];

      const feasibility = classifyRotationFeasibility(
        highProfitIrrigatedSummerRice,
        budgetConstrainedFarmer,
        mockEconomics,
      );

      expect(feasibility.status).toBe("infeasible");
      expect(feasibility.hardConstraintVetoes).toContain("BUDGET_EXCEEDED");
    });

    it("unknown water access does NOT become infeasible (status: needs_review)", () => {
      const unknownWaterFarmer: FarmerDecisionInput = {
        topPriorities: ["profit"],
        availableWater: "unknown", // Unknown, not confirmed rainfed
        equipment: "tractor_tiller",
      };

      const feasibility = classifyRotationFeasibility(
        highProfitIrrigatedSummerRice,
        unknownWaterFarmer,
      );

      // Must be needs_review, NOT a safe pass and NOT a permanent veto!
      expect(feasibility.status).toBe("needs_review");
      expect(feasibility.hardConstraintVetoes.length).toBe(0);
      expect(feasibility.unconfirmedFactors).toContain("WATER_ACCESS_UNCONFIRMED:rice");
    });

    it("vetoes rotation containing crops explicitly marked for avoidance", () => {
      const farmerWithPestHistory: FarmerDecisionInput = {
        topPriorities: ["profit"],
        availableWater: "rainfed",
        equipment: "tractor_tiller",
        avoidCropIds: ["black-gram"], // Fusarium root rot history on this parcel
      };

      const feasibility = classifyRotationFeasibility(
        rainfedPulseRotation,
        farmerWithPestHistory,
      );

      expect(feasibility.status).toBe("infeasible");
      expect(feasibility.hardConstraintVetoes).toContain("AVOID_CROP:black-gram");
    });
  });

  describe("Priority Choices Reorder Feasible Candidates (D-02)", () => {
    const candidateInputs: McdaInput[] = [
      {
        rotationId: "cash-crop-option",
        feasible: true,
        values: {
          "income-margin": 3500000,
          "water-shortfall": 320, // high water need
          "soil-legume-share": 0.0,
          "soil-cover": 0.7,
        },
      },
      {
        rotationId: "water-saving-legume-option",
        feasible: true,
        values: {
          "income-margin": 2200000,
          "water-shortfall": 50, // very low water need
          "soil-legume-share": 0.5,
          "soil-cover": 0.8,
        },
      },
    ];

    it("ranks cash crop first when priority is income/profit", () => {
      const incomePriorities = mapFarmerPrioritiesToMcda(["profit"]);
      const res = rankRotations(candidateInputs, incomePriorities);

      expect(res.status).toBe("ranked");
      expect(res.ranking[0].rotationId).toBe("cash-crop-option");
    });

    it("ranks water-saving legume first when priority is low water / low risk", () => {
      const waterPriorities = mapFarmerPrioritiesToMcda(["low_water"]);
      const res = rankRotations(candidateInputs, waterPriorities);

      expect(res.status).toBe("ranked");
      expect(res.ranking[0].rotationId).toBe("water-saving-legume-option");
    });

    it("handles empty feasible candidate set honestly without inventing a fake best crop", () => {
      const emptyInputs: McdaInput[] = [
        { rotationId: "option-1", feasible: false, values: {} },
        { rotationId: "option-2", feasible: false, values: {} },
      ];
      const priorities = mapFarmerPrioritiesToMcda(["profit"]);
      const res = rankRotations(emptyInputs, priorities);

      expect(res.status).toBe("unresolved");
      expect(res.ranking.length).toBe(0);
      expect(res.note).toContain("Fewer than two options fit this field");
    });
  });

  describe("Deterministic Decision Sensitivity", () => {
    it("detects when commodity price variation switches the top recommendation", () => {
      const candidates = [
        { id: "black-gram-export", baseScore: 0.82, priceSensitive: true, waterSensitive: false },
        { id: "sesame-local", baseScore: 0.78, priceSensitive: false, waterSensitive: false },
      ];

      const farmerInput: FarmerDecisionInput = {
        topPriorities: ["profit"],
        availableWater: "rainfed",
        equipment: "tractor_tiller",
      };

      const sensitivity = evaluateDeterministicSensitivity({
        candidates,
        farmerPriorities: farmerInput,
      });

      const priceCheck = sensitivity.find((s) => s.parameterName.includes("Commodity Market Price"));
      expect(priceCheck).toBeDefined();
      expect(priceCheck?.switchesTopChoice).toBe(true);
      expect(priceCheck?.recommendedLocalCheck).toContain("Check local wholesale depot price");
    });

    it("reports stability when ranking does not switch", () => {
      const candidates = [
        { id: "dominant-option", baseScore: 0.95, priceSensitive: true, waterSensitive: true },
        { id: "weak-option", baseScore: 0.30, priceSensitive: true, waterSensitive: true },
      ];

      const sensitivity = evaluateDeterministicSensitivity({
        candidates,
        farmerPriorities: {
          topPriorities: ["profit"],
          availableWater: "rainfed",
          equipment: "tractor_tiller",
        },
      });

      // Dominant option stays top choice across all tests
      expect(sensitivity.every((s) => !s.switchesTopChoice)).toBe(true);
    });
  });

  describe("Baseline vs NASA-Informed Comparison Mode", () => {
    it("reports unchanged ranking honestly when climate conditions match normal", () => {
      const comp = compareBaselineVsNasa({
        candidateId: "option-1",
        baselineRainfallMm: 120,
        nasaRainfallMm: 122, // near normal
        baselineEtoMm: 380,
        nasaEtoMm: 385,
        baselineRank: 1,
        nasaRank: 1, // unchanged
      });

      expect(comp.rankChanged).toBe(false);
      expect(comp.explanation).toContain("Environmental conditions are consistent with historical seasonal climatology");
    });

    it("captures rank flip and explains deficit when observed rainfall differs significantly", () => {
      const comp = compareBaselineVsNasa({
        candidateId: "option-1",
        baselineRainfallMm: 150,
        nasaRainfallMm: 70, // 53% rainfall deficit!
        baselineEtoMm: 380,
        nasaEtoMm: 420,
        baselineRank: 1,
        nasaRank: 2, // rank dropped due to drought stress
      });

      expect(comp.rankChanged).toBe(true);
      expect(comp.nasaWaterRisk).toContain("Elevated drought stress");
      expect(comp.explanation).toContain("differed by -53.3%");
    });
  });
});
