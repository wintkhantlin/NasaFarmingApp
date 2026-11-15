import { describe, expect, it } from "vitest";
import {
  buildWaterStressEvidence,
  buildFloodEvidence,
  buildErosionEvidence,
  buildHeatColdEvidence,
  buildRiskEvidenceMap,
} from "@/lib/conditions/condition-evidence";
import type { Field } from "@/lib/types";
import type { ConditionsData, RemoteData } from "@/lib/store/data-cache";
import type { TrendSeries } from "@/lib/server/trends";

const mockField: Field = {
  id: "f4",
  name: "Field 4",
  areaHa: 2.5,
  centroid: [95.2, 16.8],
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [95.19, 16.79],
        [95.21, 16.79],
        [95.21, 16.81],
        [95.19, 16.81],
        [95.19, 16.79],
      ],
    ],
  },
  samplePoints: [[95.2, 16.8]],
  irrigation: "none",
  region: "ayeyarwady",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

const mockConditions: ConditionsData = {
  fieldId: "f4",
  fetchedAt: "2026-11-15T00:00:00Z",
  climateAvailable: true,
  annualRainMm: 866,
  monthlyRainMm: [5, 10, 20, 60, 180, 240, 210, 190, 110, 50, 15, 5],
  monthlyEt0Mm: [95, 110, 140, 160, 150, 120, 110, 110, 105, 100, 90, 85],
  monthlyTmaxC: [31, 33, 36, 38, 35, 31, 30, 30, 31, 31, 31, 30],
  monthlyTminC: [16, 17, 21, 24, 25, 25, 24, 24, 24, 23, 20, 17],
  sources: [],
};

const mockTrends: { trends: TrendSeries[]; through: number } = {
  through: 2025,
  trends: [
    {
      key: "monsoon-rain",
      title: "Monsoon rain (Jun to Oct)",
      unit: "mm",
      source: "NASA POWER",
      scale: "wider",
      years: [
        { year: 2023, value: 850 },
        { year: 2024, value: 920 },
        { year: 2025, value: 810 },
      ],
      test: null,
      sentence: "Monsoon rain trend.",
    },
    {
      key: "hot-days",
      title: "Days at 35 °C or hotter (Mar to May)",
      unit: "days",
      source: "NASA POWER",
      scale: "wider",
      years: [
        { year: 2023, value: 45 },
        { year: 2024, value: 52 },
        { year: 2025, value: 68 },
      ],
      test: null,
      sentence: "Hot days trend.",
    },
  ],
};

describe("condition-evidence presentation adapter", () => {
  describe("Water Stress Evidence", () => {
    it("adapts valid rainfall and trends with honest regional scale and caveats", () => {
      const evidence = buildWaterStressEvidence({
        conditions: mockConditions,
        remote: null,
        trends: mockTrends,
        point: mockField.centroid,
        selectedYear: 2025,
      });

      expect(evidence.kind).toBe("water_stress");
      expect(evidence.scale).toBe("regional_context");
      expect(evidence.findingText).toContain("2025 monsoon rain (810 mm)");
      expect(evidence.caveats[0]).toContain("gridded reanalysis");
      expect(evidence.cannotTellText).toContain("Regional soil moisture (SMAP) is not available");
      expect(evidence.metric?.value).toBe(810);
    });

    it("does NOT emit false low-stress or zero deficit when SMAP is unavailable", () => {
      const evidence = buildWaterStressEvidence({
        conditions: { ...mockConditions, annualRainMm: undefined },
        remote: null,
        trends: null,
        point: mockField.centroid,
      });

      expect(evidence.status).toBe("partial");
      expect(evidence.findingText).toContain("Rain history is unavailable");
      expect(evidence.cannotTellText).toContain("Missing data is not treated as adequate moisture");
    });

    it("incorporates GPM IMERG satellite precipitation when available", () => {
      const conditionsWithImerg: ConditionsData = {
        ...mockConditions,
        imerg: {
          status: "ok",
          expected: 3650,
          covered: 3650,
          partialDays: 0,
          granules: 3650,
          days: [],
          error: null,
        },
      };

      const evidence = buildWaterStressEvidence({
        conditions: conditionsWithImerg,
        remote: null,
        trends: mockTrends,
        point: mockField.centroid,
        selectedYear: 2025,
      });

      expect(evidence.sourceLabel).toContain("GPM IMERG");
      expect(evidence.caveats).toContainEqual(
        expect.stringContaining("GPM IMERG V07 provides 0.1° (~10 km) satellite precipitation"),
      );
    });
  });

  describe("Flood Evidence", () => {
    it("reports honest unavailable state when no satellite scenes are configured", () => {
      const evidence = buildFloodEvidence({
        conditions: mockConditions,
        remote: {
          fieldId: "f4",
          checkedAt: "2026-11-15T00:00:00Z",
          smap: { kind: "smap", status: "unconfigured", start: "", end: "" },
          hls: { kind: "hls", status: "unconfigured", start: "", end: "" },
          srtm: { kind: "srtm", status: "unconfigured", start: "", end: "" },
          modis: { kind: "modis", status: "unconfigured", start: "", end: "" },
          ecostressLst: { kind: "ecostress-lst", status: "unconfigured", start: "", end: "" },
          ecostressEt: { kind: "ecostress-et", status: "unconfigured", start: "", end: "" },
        },
        point: mockField.centroid,
      });

      expect(evidence.kind).toBe("flood");
      expect(evidence.status).toBe("unavailable");
      expect(evidence.findingText).toContain("No verified cloud-free surface-water observation");
      expect(evidence.cannotTellText).toContain("cannot measure flood depth, water velocity");
      expect(evidence.localCheckText).toContain("Is standing water normal for this field");
    });

    it("displays valid scene date and pixel fraction when observations exist", () => {
      const remoteWithHls: RemoteData = {
        fieldId: "f4",
        checkedAt: "2026-11-15T00:00:00Z",
        smap: { kind: "smap", status: "ok", start: "", end: "" },
        hls: {
          kind: "hls",
          status: "ok",
          start: "2021-01-01",
          end: "2025-12-31",
          data: {
            observations: [
              {
                date: "2024-09-15",
                ndviMedian: 0.65,
                ndmiMedian: 0.42,
                coverage: 0.95,
                validPixels: 95,
                totalPixels: 100,
                waterPixels: 5,
              },
            ],
          },
        },
        srtm: { kind: "srtm", status: "ok", start: "", end: "" },
        modis: { kind: "modis", status: "ok", start: "", end: "" },
        ecostressLst: { kind: "ecostress-lst", status: "ok", start: "", end: "" },
        ecostressEt: { kind: "ecostress-et", status: "ok", start: "", end: "" },
      };

      const evidence = buildFloodEvidence({
        conditions: mockConditions,
        remote: remoteWithHls,
        point: mockField.centroid,
        selectedDate: "2024-09-15",
      });

      expect(evidence.status).toBe("partial");
      expect(evidence.findingText).toContain("95% clear view over your field");
      expect(evidence.metric?.value).toBe("95%");
      expect(evidence.time.selectedDate).toBe("2024-09-15");
    });
  });

  describe("Erosion Evidence", () => {
    it("reports missing slope honestly without assigning a false low-erosion grade", () => {
      const evidence = buildErosionEvidence({
        conditions: mockConditions,
        remote: null,
        point: mockField.centroid,
      });

      expect(evidence.kind).toBe("erosion");
      expect(evidence.status).toBe("unavailable");
      expect(evidence.findingText).toContain("Terrain slope data is not available yet, so field erosion exposure cannot be assessed");
      expect(evidence.metric).toBeUndefined();
    });

    it("reports slope context with steepness label when SRTM data is available", () => {
      const remoteWithSrtm: RemoteData = {
        fieldId: "f4",
        checkedAt: "2026-11-15T00:00:00Z",
        smap: { kind: "smap", status: "unconfigured", start: "", end: "" },
        hls: { kind: "hls", status: "unconfigured", start: "", end: "" },
        srtm: {
          kind: "srtm",
          status: "ok",
          start: "2000-02-11",
          end: "2000-02-21",
          data: {
            slope: {
              medianDeg: 2.4,
              meanDeg: 2.5,
              p90Deg: 3.5,
              validCells: 100,
              totalCells: 100,
            },
          },
        },
        modis: { kind: "modis", status: "unconfigured", start: "", end: "" },
        ecostressLst: { kind: "ecostress-lst", status: "unconfigured", start: "", end: "" },
        ecostressEt: { kind: "ecostress-et", status: "unconfigured", start: "", end: "" },
      };

      const evidence = buildErosionEvidence({
        conditions: mockConditions,
        remote: remoteWithSrtm,
        point: mockField.centroid,
      });

      expect(evidence.status).toBe("ready");
      expect(evidence.findingText).toContain("2.4°");
      expect(evidence.metric?.value).toBe("2.4°");
      expect(evidence.caveats[0]).toContain("susceptibility proxy, not measured soil erosion in tonnes/hectare");
    });
  });

  describe("Heat & Cold Evidence", () => {
    it("displays dynamic days ≥35°C without hardcoding screenshot values", () => {
      const evidence = buildHeatColdEvidence({
        conditions: mockConditions,
        trends: mockTrends,
        point: mockField.centroid,
        selectedYear: 2024,
      });

      expect(evidence.kind).toBe("heat_cold");
      expect(evidence.findingText).toContain("2024 had 52 days where regional maximum air temperature reached 35 °C or hotter");
      expect(evidence.metric?.value).toBe(52);
    });

    it("distinguishes threshold exceedance days from heatwaves in caveats", () => {
      const evidence = buildHeatColdEvidence({
        conditions: mockConditions,
        trends: mockTrends,
        point: mockField.centroid,
        selectedYear: 2025,
      });

      expect(evidence.caveats).toContainEqual(
        expect.stringContaining("measure single-day exceedance, not sustained heatwave duration"),
      );
    });

    it("integrates cold-nights trend series when available", () => {
      const trendsWithCold = {
        through: 2025,
        trends: [
          ...mockTrends.trends,
          {
            key: "cold-nights" as const,
            title: "Chilly nights at or below 12 °C (Nov to Feb)",
            unit: "nights",
            source: "NASA POWER" as const,
            scale: "wider" as const,
            years: [
              { year: 2023, value: 18 },
              { year: 2024, value: 22 },
              { year: 2025, value: 15 },
            ],
            test: null,
            sentence: "Chilly winter nights trend.",
          },
        ],
      };

      const evidence = buildHeatColdEvidence({
        conditions: mockConditions,
        trends: trendsWithCold,
        point: mockField.centroid,
        selectedYear: 2025,
      });

      expect(evidence.findingText).toContain("2025 had 15 chilly winter nights (Tmin ≤ 12 °C, Nov–Feb)");
      const raw = evidence.raw as { coldSeries?: { key: string } };
      expect(raw.coldSeries?.key).toBe("cold-nights");
    });
  });

  describe("Combined RiskEvidenceMap", () => {
    it("builds an integrated map covering all four risk domains", () => {
      const evidenceMap = buildRiskEvidenceMap({
        conditions: mockConditions,
        remote: null,
        trends: mockTrends,
        field: mockField,
        selectedYear: 2025,
      });

      expect(evidenceMap.water_stress).toBeDefined();
      expect(evidenceMap.flood).toBeDefined();
      expect(evidenceMap.erosion).toBeDefined();
      expect(evidenceMap.heat_cold).toBeDefined();
    });
  });
});
