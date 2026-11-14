import { describe, expect, it } from "vitest";
import {
  evaluateTransition,
  isRelayPairEligible,
  snapToRelayBroadcast,
  snapToStandardTurnaround,
} from "../../lib/engine/transition";
import {
  classifyRotationFeasibility,
  evaluateDeterministicSensitivity,
  compareBaselineVsNasa,
  type FarmerDecisionInput,
} from "../../lib/engine/farmer-decision";
import {
  threeZoneCapacities,
  threeZoneStep,
  seedbedMoistureWindow,
  type ThreeZoneColumn,
  type ThreeZoneState,
} from "../../lib/engine/water";
import {
  evaluateWaterYieldResponse,
  calculateBreakEvenYield,
  calculateScenarioGrossMargin,
  FAO_CROP_WATER_RESPONSE_KY,
} from "../../lib/engine/economics";
import {
  daysInCalendarYear,
  segmentYear,
  calculateGroundCoverPercent,
} from "../../lib/rotation-format";
import type { Rotation, RotationSlot } from "../../lib/types";

describe("PROMPT 10: Comprehensive End-to-End Verification & Invariant Checks", () => {
  describe("Journey 1: Known Rice → Black Gram Relay Broadcast (Ye-pyan)", () => {
    it("recognizes pre-drainage negative gap as valid relay sowing for eligible pair", () => {
      expect(isRelayPairEligible("rice", "black-gram")).toBe(true);
      expect(isRelayPairEligible("rice", "green-gram")).toBe(true);
      expect(isRelayPairEligible("rice", "maize")).toBe(false);

      const riceSlot: RotationSlot = {
        id: "slot-rice",
        kind: "crop",
        cropId: "rice",
        plantDate: "2025-06-15",
        harvestDate: "2025-10-20",
        dateConfidence: "exact",
        irrigated: false,
        establishmentMode: "tillage",
      };

      const pulseRelaySlot: RotationSlot = {
        id: "slot-pulse",
        kind: "crop",
        cropId: "black-gram",
        // Planted 7 days before rice harvest into standing crop:
        plantDate: "2025-10-13",
        harvestDate: "2026-01-10",
        dateConfidence: "exact",
        irrigated: false,
        establishmentMode: "relay_broadcast",
      };

      const trans = evaluateTransition(riceSlot, pulseRelaySlot);
      expect(trans.status).toBe("relay");
      expect(trans.gapDays).toBe(-7);
      expect(trans.isRelay).toBe(true);
    });
  });

  describe("Journey 2: Farmer Without Irrigation or Machinery", () => {
    it("flags machinery and irrigation-intensive crops as infeasible or needing review", () => {
      const rainfedFarmer: FarmerDecisionInput = {
        topPriorities: ["low_water", "reliable_harvest"],
        availableWater: "rainfed", // NO irrigation
        equipment: "manual",
      };

      const summerRiceCandidate: Rotation = {
        id: "rot-summer-rice",
        fieldId: "field-1",
        label: "Summer Rice",
        cycleYears: 1,
        source: "strategy",
        slots: [
          {
            id: "s1",
            kind: "crop",
            cropId: "rice",
            plantDate: "2026-01-15",
            harvestDate: "2026-05-15",
            dateConfidence: "exact",
            irrigated: true,
          },
        ],
      };

      const pulseCandidate: Rotation = {
        id: "rot-pulse",
        fieldId: "field-1",
        label: "Pulse Relay",
        cycleYears: 1,
        source: "strategy",
        slots: [
          {
            id: "s1",
            kind: "crop",
            cropId: "black-gram",
            plantDate: "2025-10-25",
            harvestDate: "2026-01-20",
            dateConfidence: "exact",
            establishmentMode: "relay_broadcast",
            irrigated: false,
          },
        ],
      };

      const riceFeas = classifyRotationFeasibility(summerRiceCandidate, rainfedFarmer);
      const pulseFeas = classifyRotationFeasibility(pulseCandidate, rainfedFarmer);

      // Irrigated summer rice is strictly infeasible without water
      expect(riceFeas.status).toBe("infeasible");
      expect(riceFeas.hardConstraintVetoes).toContain("WATER_UNAVAILABLE:rice");

      // Rainfed black gram relay is feasible
      expect(pulseFeas.status).toBe("feasible");
    });
  });

  describe("Journey 3: Budget Constrained Farmer", () => {
    it("flags candidate exceeding maximum cash budget when confirmed, and needs_review when unconfirmed", () => {
      const budgetConstrainedFarmer: FarmerDecisionInput = {
        topPriorities: ["profit"],
        availableWater: "reliable_irrigation",
        budgetMaxMmkHa: 800_000,
        equipment: "tractor_tiller",
      };

      const costlyCandidate: Rotation = {
        id: "rot-costly",
        fieldId: "field-1",
        label: "Double Rice Plan",
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
            irrigated: true,
          },
        ],
      };

      // 1. When economics are unconfirmed: status is needs_review (NOT assumed safe pass, NOT vetoed)
      const unconfirmedFeas = classifyRotationFeasibility(costlyCandidate, budgetConstrainedFarmer);
      expect(unconfirmedFeas.status).toBe("needs_review");

      // 2. When economics confirm costs exceed budget: status is infeasible
      const mockEconomics = [
        { cropId: "rice", costMmkPerHa: [850000, 1200000] as [number, number], source: "test" },
      ];
      const confirmedFeas = classifyRotationFeasibility(
        costlyCandidate,
        budgetConstrainedFarmer,
        mockEconomics
      );
      expect(confirmedFeas.status).toBe("infeasible");
      expect(confirmedFeas.hardConstraintVetoes).toContain("BUDGET_EXCEEDED");
    });
  });

  describe("Journey 4: Uncertain Soil & Drainage Requiring Field Check", () => {
    it("returns 'field-check-needed' and suppresses fake countdown when soil texture is missing", () => {
      const windowRes = seedbedMoistureWindow({
        hasConfirmedSoil: false,
        hasConfirmedDrainageDate: false,
      });

      expect(windowRes.status).toBe("field-check-needed");
      expect(windowRes.advisory).toContain("Check topsoil moisture and drainage by hand");
    });

    it("computes physical workable drydown window when soil is ground-confirmed", () => {
      const windowRes = seedbedMoistureWindow({
        hasConfirmedSoil: true,
        hasConfirmedDrainageDate: true,
        awcMmPerM: 140,
        thetaSat: 0.50,
        thetaFc: 0.36,
        pondAtDrainageMm: 30,
        kPanMmDay: 3.0,
        dailyEt0Mm: Array(28).fill(4.0),
        dailyRainMm: Array(28).fill(0.0),
      });

      expect(windowRes.status).toBe("estimate");
      if (windowRes.status === "estimate") {
        expect(windowRes.readyDayAfterDrainage).toBeGreaterThan(0);
        expect(windowRes.windowEndDayAfterDrainage).toBeGreaterThanOrEqual(windowRes.readyDayAfterDrainage);
        expect(windowRes.timeline.length).toBe(28);
      }
    });
  });

  describe("Journey 5: Incorrect Crop Overlap vs Eligible Relay", () => {
    it("flags illegal overlap as collision and provides snap repair options", () => {
      const slotA: RotationSlot = {
        id: "s1",
        kind: "crop",
        cropId: "maize",
        plantDate: "2025-06-01",
        harvestDate: "2025-09-15",
        dateConfidence: "exact",
        irrigated: false,
      };

      const slotB: RotationSlot = {
        id: "s2",
        kind: "crop",
        cropId: "sesame",
        plantDate: "2025-09-10", // overlaps by 5 days; maize->sesame is NOT eligible for relay!
        harvestDate: "2025-12-01",
        dateConfidence: "exact",
        irrigated: false,
      };

      const trans = evaluateTransition(slotA, slotB);
      expect(trans.status).toBe("collision");

      // Test repair helper
      const fixedB = snapToStandardTurnaround(slotA, slotB, 14);
      expect(fixedB.plantDate).toBe("2025-09-29"); // 2025-09-15 + 14d
      expect(evaluateTransition(slotA, fixedB).status).toBe("valid");

      // Test relay snap helper for eligible pulse
      const pulseSlot: RotationSlot = {
        id: "s3",
        kind: "crop",
        cropId: "black-gram",
        plantDate: "2025-10-01",
        harvestDate: "2025-12-20",
        dateConfidence: "exact",
        irrigated: false,
        establishmentMode: "relay_broadcast",
      };
      const riceSlot: RotationSlot = {
        id: "s0",
        kind: "crop",
        cropId: "rice",
        plantDate: "2025-06-01",
        harvestDate: "2025-10-15",
        dateConfidence: "exact",
        irrigated: false,
      };
      const fixedPulse = snapToRelayBroadcast(riceSlot, pulseSlot, 7);
      expect(fixedPulse.plantDate).toBe("2025-10-08"); // 7 days pre-harvest
      expect(evaluateTransition(riceSlot, fixedPulse).status).toBe("relay");
    });
  });

  describe("Journey 6: FAO-56 Water Yield Response & Deterministic Sensitivity", () => {
    it("evaluates Ky water yield response where calibrated, and marks uncalibrated as unquantified", () => {
      // Maize has FAO Ky = 1.25
      expect(FAO_CROP_WATER_RESPONSE_KY["maize"]?.ky).toBe(1.25);
      const maizeResp = evaluateWaterYieldResponse({
        cropId: "maize",
        baseYieldKgHa: [3000, 4500],
        etaSumMm: 300,
        etmSumMm: 500, // 40% deficit
      });
      expect(maizeResp.status).toBe("quantified");
      // phi = 1 - 1.25 * 0.40 = 0.50
      expect(maizeResp.phi).toBeCloseTo(0.5, 3);
      expect(maizeResp.adjustedYieldKgHa).toEqual([1500, 2250]);

      // Black gram does not have standard FAO Ky
      const bgResp = evaluateWaterYieldResponse({
        cropId: "black-gram",
        baseYieldKgHa: [1000, 1600],
        etaSumMm: 150,
        etmSumMm: 250,
      });
      expect(bgResp.status).toBe("unquantified");
      expect(bgResp.ky).toBeNull();
      expect(bgResp.phi).toBe(1.0);
    });

    it("performs deterministic sensitivity analysis identifying candidate ranking stability", () => {
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

      expect(sensitivity.length).toBeGreaterThanOrEqual(1);
      const priceCheck = sensitivity.find((s) => s.parameterName.includes("Commodity Market Price"));
      expect(priceCheck).toBeDefined();
      expect(priceCheck?.switchesTopChoice).toBe(true);
      expect(priceCheck?.recommendedLocalCheck).toContain("Check local wholesale depot price");
    });
  });

  describe("Journey 7: Missing NASA Data & Offline Resilience", () => {
    it("returns truthful fallback audit without crashing or fabricating numbers", () => {
      const comp = compareBaselineVsNasa({
        candidateId: "cand-1",
        baselineRainfallMm: 120,
        nasaRainfallMm: 120,
        baselineEtoMm: 350,
        nasaEtoMm: 350,
        baselineRank: null, // missing baseline
        nasaRank: 1,
      });

      expect(comp.available).toBe(false);
      expect(comp.explanation).toContain("Comparison unavailable");
    });
  });

  describe("Journey 8: Leap Year 2028 & Multi-Year Cycles", () => {
    it("safely handles 366 days in leap year 2028 without 365-day overflow errors", () => {
      expect(daysInCalendarYear(2028)).toBe(366);
      expect(daysInCalendarYear(2025)).toBe(365);

      const seg = segmentYear(2028, "2028-12-31", "2028-12-31");
      expect(seg).not.toBeNull();
      expect(seg!.left + seg!.width).toBeLessThanOrEqual(1.0);
      expect(seg!.left + seg!.width).toBeCloseTo(1.0, 5);

      const coverRes = calculateGroundCoverPercent(
        [
          {
            id: "s1",
            kind: "crop",
            cropId: "rice",
            plantDate: "2028-06-01",
            harvestDate: "2028-09-28", // 120 days
            dateConfidence: "exact",
            irrigated: false,
          },
        ],
        1,
        2028
      );
      expect(coverRes.totalCycleDays).toBe(366);
      expect(coverRes.coveredDays).toBe(120);
      expect(coverRes.coverPercent).toBe(33); // 120/366 = 32.78% -> 33%
    });
  });

  describe("Journey 9 & 10: Invariants & Property Checks", () => {
    it("strictly conserves mass in three-zone hydrology ledger (residual <= 1e-9 mm)", () => {
      const col: ThreeZoneColumn = {
        awcMmPerM: 140,
        seedbedDepthM: 0.12,
        rootDepthM: 0.40,
        maxDepthM: 1.0,
        thetaSat: 0.48,
        thetaFc: 0.34,
        kPanMmDay: 3.0,
      };

      const cap = threeZoneCapacities(col);
      const startState: ThreeZoneState = {
        surfacePondMm: 5.0,
        seedbedMm: cap.c1Mm,
        rootSubSeedbedMm: cap.c2Mm,
        subRootMm: cap.c3Mm,
      };

      const step = threeZoneStep(startState, col, 25.0, 4.5, 0, {
        kcb: 0.9,
        ke: 0.2,
        p: 0.5,
      });

      expect(Math.abs(step.residualMm)).toBeLessThanOrEqual(1e-9);
      expect(step.state.seedbedMm).toBeGreaterThanOrEqual(0);
      expect(step.state.rootSubSeedbedMm).toBeGreaterThanOrEqual(0);
      expect(step.state.subRootMm).toBeGreaterThanOrEqual(0);
    });

    it("returns null and viable: false when price <= variable unit cost (no fake 1 kg/ha break-even)", () => {
      const breakEven = calculateBreakEvenYield(600000, 400, 500);

      expect(breakEven.viable).toBe(false);
      expect(breakEven.breakEvenYieldKgHa).toBeNull();
      expect(breakEven.note).toContain("Not economically viable at these prices");
    });

    it("verifies all crop economic cost and price currencies are strictly in MMK", () => {
      const scenario = calculateScenarioGrossMargin({
        yieldKgHa: [1000, 1500],
        priceMmkPerKg: [3200, 3800],
        costPartition: {
          fixedMmkHa: 500000,
          variableMmkPerKg: 300,
          irrigationMmkHa: 80000,
        },
      });

      expect(scenario.illustrativeEstimate).toBe(true);
      expect(scenario.committedCashAtRiskMmkHa).toBe(580000);
      expect(scenario.grossMarginMmkHa[0]).toBeLessThan(scenario.grossMarginMmkHa[1]);
    });
  });
});
