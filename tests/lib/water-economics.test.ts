import { describe, expect, it } from "vitest";
import {
  evaluateWaterYieldResponse,
  calculateBreakEvenYield,
  calculateScenarioGrossMargin,
  annualizeMargin,
  FAO_CROP_WATER_RESPONSE_KY,
} from "../../lib/engine/economics";

describe("PROMPT 5: Water-Sensitive Economics without False Precision (E-01)", () => {
  describe("Water-Limited Yield Response (FAO Ky)", () => {
    it("reduces adjusted yield when ETa < ETm for crops with validated FAO Ky (e.g. maize, rice)", () => {
      // Maize has sourced FAO Ky = 1.25
      const res = evaluateWaterYieldResponse({
        cropId: "maize",
        baseYieldKgHa: [3000, 4500],
        etaSumMm: 350,
        etmSumMm: 500, // 30% deficit: 1 - 350/500 = 0.30
      });

      expect(res.status).toBe("quantified");
      expect(res.ky).toBe(1.25);
      // phi = 1 - 1.25 * 0.30 = 1 - 0.375 = 0.625
      expect(res.phi).toBeCloseTo(0.625, 3);
      expect(res.adjustedYieldKgHa?.[0]).toBe(Math.round(3000 * 0.625)); // 1875
      expect(res.adjustedYieldKgHa?.[1]).toBe(Math.round(4500 * 0.625)); // 2813
    });

    it("leaves base yield unchanged when there is no water deficit (ETa >= ETm)", () => {
      const res = evaluateWaterYieldResponse({
        cropId: "maize",
        baseYieldKgHa: [3000, 4500],
        etaSumMm: 500,
        etmSumMm: 500,
      });

      expect(res.status).toBe("quantified");
      expect(res.phi).toBe(1.0);
      expect(res.adjustedYieldKgHa).toEqual([3000, 4500]);
    });

    it("leaves yield response UNQUANTIFIED when crop lacks species-calibrated FAO Ky (e.g. black-gram)", () => {
      // Black gram does not have an experimental Ky in FAO 33/66
      expect(FAO_CROP_WATER_RESPONSE_KY["black-gram"]).toBeUndefined();

      const res = evaluateWaterYieldResponse({
        cropId: "black-gram",
        baseYieldKgHa: [1000, 1600],
        etaSumMm: 180,
        etmSumMm: 250,
      });

      expect(res.status).toBe("unquantified");
      expect(res.ky).toBeNull();
      expect(res.phi).toBe(1.0);
      expect(res.unquantifiedReason).toContain("lacks a standardized, species-calibrated FAO Ky");
      expect(res.notes[0]).toContain("risk indicator; uncalibrated yield discount omitted");
    });

    it("prevents double-discounting when baseline yield already reflects rainfed water stress", () => {
      const res = evaluateWaterYieldResponse({
        cropId: "rice",
        baseYieldKgHa: [2500, 3500],
        etaSumMm: 350,
        etmSumMm: 600,
        isWaterStressInBase: true, // farmer entered observed rainfed yield
      });

      expect(res.status).toBe("unquantified");
      expect(res.phi).toBe(1.0);
      expect(res.unquantifiedReason).toContain("suppressed to prevent double-counting");
      expect(res.adjustedYieldKgHa).toEqual([2500, 3500]);
    });
  });

  describe("Cost Partitioning & Break-Even Analysis", () => {
    it("calculates break-even yield correctly with fixed and variable costs", () => {
      // Fixed pre-harvest = 600,000 MMK/ha
      // Sale price = 3,500 MMK/kg
      // Variable harvest/bagging = 500 MMK/kg
      // Net unit margin = 3,000 MMK/kg
      // Break-even yield = 600,000 / 3,000 = 200 kg/ha
      const bep = calculateBreakEvenYield(600000, 3500, 500);
      expect(bep.viable).toBe(true);
      expect(bep.netUnitMarginMmkKg).toBe(3000);
      expect(bep.breakEvenYieldKgHa).toBe(200);
    });

    it("reports loss-making price without replacing denominator with max(1,...)", () => {
      // Variable cost exceeds market price! (e.g. price collapse to 400 MMK/kg with 500 MMK/kg harvest cost)
      const bep = calculateBreakEvenYield(600000, 400, 500);
      expect(bep.viable).toBe(false);
      expect(bep.breakEvenYieldKgHa).toBeNull();
      expect(bep.note).toContain("Not economically viable at these prices");
    });

    it("evaluates scenario gross margin envelope and exposes committed cash-at-risk", () => {
      const margin = calculateScenarioGrossMargin({
        yieldKgHa: [1000, 1500],
        priceMmkPerKg: [3200, 3800],
        costPartition: {
          fixedMmkHa: 500000,
          variableMmkPerKg: 300,
          irrigationMmkHa: 80000,
        },
      });

      expect(margin.illustrativeEstimate).toBe(true);
      // Committed cash at risk = 500,000 + 80,000 = 580,000 MMK/ha
      expect(margin.committedCashAtRiskMmkHa).toBe(580000);
      // Min margin = 1000 * (3200 - 300) - 580000 = 2,900,000 - 580,000 = 2,320,000
      expect(margin.grossMarginMmkHa[0]).toBe(2320000);
      // Max margin = 1500 * (3800 - 300) - 580000 = 5,250,000 - 580,000 = 4,670,000
      expect(margin.grossMarginMmkHa[1]).toBe(4670000);
      expect(margin.viable).toBe(true);
    });
  });

  describe("Annualization with Fallow", () => {
    it("annualizes margin using the complete rotation cycle including fallow days", () => {
      const margin: [number, number] = [2000000, 3000000];
      // 1-year cycle (365 days)
      const annual1Year = annualizeMargin(margin, 365);
      expect(annual1Year?.[0]).toBeCloseTo(2000000 * (365.2425 / 365), 0);

      // 2-year cycle (730 days) including fallow period
      const annual2Year = annualizeMargin(margin, 730);
      expect(annual2Year?.[0]).toBeCloseTo(2000000 * (365.2425 / 730), 0);
      expect(annual2Year?.[0]).toBeLessThan(annual1Year![0]);
    });
  });
});
