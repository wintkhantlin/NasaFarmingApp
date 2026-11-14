import { describe, expect, it } from "vitest";
import {
  getEngineInputProvenance,
  assertTruthfulSoilMoistureLabel,
  smapIndicator,
} from "../../lib/engine/provenance";
import { compareBaselineVsNasa } from "../../lib/engine/farmer-decision";
import { powerEnvironment } from "../../lib/rotation/power-environment";
import { resolveEnvironment } from "../../lib/rotation/environment";
import type { DailyWeather } from "../../lib/nasa/power";
import type { FarmerRequest } from "../../lib/rotation/farmer-request";
import type { EngineData } from "../../lib/engine/data";

describe("PROMPT 9: Data Truthfulness, Provenance & Resilience", () => {
  describe("Provenance Completeness & Honest Attribution", () => {
    it("returns complete provenance metadata for all primary engine variables", () => {
      const vars = [
        "temperature_t2m",
        "temperature_t2m_max",
        "precipitation",
        "reference_et0",
        "regional_soil_moisture",
        "soil_texture_soilgrids",
        "farmer_soil_observation",
        "farmer_drainage_observation",
        "crop_market_economics",
      ];

      for (const v of vars) {
        const prov = getEngineInputProvenance(v);
        expect(prov.provider).toBeTruthy();
        expect(prov.product).toBeTruthy();
        expect(prov.variable).toBeTruthy();
        expect(prov.spatialResolution).toBeTruthy();
        expect(prov.unit).toBeTruthy();
        expect(typeof prov.isObserved).toBe("boolean");
        expect(typeof prov.isModeled).toBe("boolean");
        expect(typeof prov.isFarmerEntered).toBe("boolean");
        expect(prov.quality).toBeTruthy();
      }
    });

    it("correctly attributes non-NASA sources (SoilGrids, DoA prices, FAO ET0)", () => {
      const soilProv = getEngineInputProvenance("soil_texture_soilgrids");
      expect(soilProv.provider).toBe("ISRIC");
      expect(soilProv.product).toContain("SoilGrids");
      expect(soilProv.quality).toBe("uncalibrated");

      const priceProv = getEngineInputProvenance("crop_market_economics");
      expect(priceProv.provider).toBe("Department_of_Agriculture");
      expect(priceProv.product).toContain("Department of Agriculture");

      const et0Prov = getEngineInputProvenance("reference_et0");
      expect(et0Prov.provider).toBe("FAO");
      expect(et0Prov.quality).toBe("calculated");
    });
  });

  describe("Regional Soil Moisture Invariant", () => {
    it("strictly prevents SMAP 9km coarse data from being claimed as measured in the farmer's field", () => {
      expect(() => {
        assertTruthfulSoilMoistureLabel("Measured in your field");
      }).toThrow(/Data truthfulness violation/);

      expect(() => {
        assertTruthfulSoilMoistureLabel("Field soil moisture measurement on parcel");
      }).toThrow(/Data truthfulness violation/);

      expect(() => {
        assertTruthfulSoilMoistureLabel("In-situ sensor on your field");
      }).toThrow(/Data truthfulness violation/);

      // Truthful regional label is permitted
      expect(() => {
        assertTruthfulSoilMoistureLabel(
          "SMAP L4 Regional catchment soil moisture context (9 km grid assimilation)"
        );
      }).not.toThrow();
    });

    it("documents SMAP native footprint as regional context in indicator builder", () => {
      const mockCommon = {
        data: {
          field: {
            id: "test-f1",
            geometry: { type: "Point" as const, coordinates: [96.17, 16.84] },
            locationConfirmed: true,
          },
          region: "ayeyarwady",
          smapInfo: { status: "ok" as const, retrievedAt: "2026-11-14T00:00:00Z" },
        } as unknown as EngineData,
        name: "Regional Soil Moisture",
        value: 0.32,
        units: "m3/m3",
        statistic: "mean",
        start: "2025-01-01",
        end: "2025-01-31",
      };

      const ind = smapIndicator(mockCommon);
      expect(ind.nativeFootprint).toContain("regional context, not field water");
      expect(ind.sourceResolution).toContain("9 km");
    });
  });

  describe("NASA POWER Weather Sentinel & Missing Data Handling", () => {
    it("ignores sentinel / fill values (-999, -99) without converting them to 0 rain or 0°C", () => {
      const mockWeather: DailyWeather = {
        latitude: 16.84,
        longitude: 96.17,
        elevationM: 5,
        dates: [
          "2025-01-01",
          "2025-01-02",
          "2025-01-03",
        ],
        series: {
          T2M: [28.5, -999, 29.1], // -999 is sentinel
          PRECTOTCORR: [0.0, -999, 12.5], // -999 is sentinel
        },
        source: {
          dataset: "NASA POWER Daily Point",
          version: "2.0",
          resolution: "0.5x0.625",
        },
        meta: {
          fillValue: -999,
          timeStandard: "UTC",
          sources: ["MERRA2"],
          units: { T2M: "C", PRECTOTCORR: "mm/day" },
          apiVersion: "2.0",
          start: "2025-01-01",
          end: "2025-01-03",
        },
      };

      // Incomplete month (only 3 days) is not accepted as complete monthly normal
      const env = powerEnvironment(mockWeather, "2025-01-01", "2025-01-31", null);
      const jan = env.monthly.find((m) => m.month === "2025-01");
      expect(jan?.temp_c).toBeNull();
      expect(jan?.rain_mm).toBeNull();
    });

    it("deterministically computes monthly averages when all days of the month are valid", () => {
      const daysInJan = 31;
      const dates: string[] = [];
      const t2m: number[] = [];
      const rain: number[] = [];

      for (let d = 1; d <= daysInJan; d++) {
        dates.push(`2025-01-${String(d).padStart(2, "0")}`);
        t2m.push(28.0); // constant 28 C
        rain.push(2.0); // 2 mm/day -> 62 mm total
      }

      const mockWeather: DailyWeather = {
        latitude: 16.84,
        longitude: 96.17,
        elevationM: 5,
        dates,
        series: { T2M: t2m, PRECTOTCORR: rain },
        source: {
          dataset: "NASA POWER Daily Point",
          version: "2.0",
          resolution: "0.5x0.625",
        },
        meta: {
          fillValue: -999,
          timeStandard: "UTC",
          sources: ["MERRA2"],
          units: { T2M: "C", PRECTOTCORR: "mm/day" },
          apiVersion: "2.0",
          start: "2025-01-01",
          end: "2025-01-31",
        },
      };

      const env1 = powerEnvironment(mockWeather, "2025-01-01", "2025-01-31", "2026-11-14T00:00:00Z");
      const env2 = powerEnvironment(mockWeather, "2025-01-01", "2025-01-31", "2026-11-14T00:00:00Z");

      const jan1 = env1.monthly.find((m) => m.month === "2025-01");
      const jan2 = env2.monthly.find((m) => m.month === "2025-01");

      expect(jan1?.temp_c).toBe(28.0);
      expect(jan1?.rain_mm).toBe(62.0);
      // Recomputation is completely deterministic
      expect(jan1).toEqual(jan2);
    });
  });

  describe("API Timeout & Missing Source Resilience", () => {
    it("returns 'unavailable' state and honest note when NASA lookup times out or fails (no demo substitution)", async () => {
      const failingLoader = async () => {
        throw new Error("ETIMEDOUT: Connection to power.larc.nasa.gov timed out after 12000ms");
      };

      const req: FarmerRequest = {
        location: {
          kind: "farm",
          label: "Danubyu Parcel",
          lat: 16.84,
          lon: 96.17,
        },
        previousCrop: "rice",
        irrigation: "no",
        priority: "income",
        planning: {
          startDate: "2025-05-01",
          endDate: "2026-04-30",
        },
      };

      const res = await resolveEnvironment(req, fetch, failingLoader);
      expect(res.state).toBe("unavailable");
      expect(res.note).toContain("NASA POWER weather data could not be used");
      expect(res.note).toContain("no demonstration values were substituted");
      expect(res.snapshot.monthly).toHaveLength(0);
    });
  });

  describe("Baseline vs NASA Audit Output", () => {
    it("marks comparison unavailable when there is no accepted baseline rotation", () => {
      const comp = compareBaselineVsNasa({
        candidateId: "cand-1",
        baselineRainfallMm: 120,
        nasaRainfallMm: 125,
        baselineEtoMm: 350,
        nasaEtoMm: 355,
        baselineRank: null, // No baseline!
        nasaRank: 1,
      });

      expect(comp.available).toBe(false);
      expect(comp.explanation).toContain("Comparison unavailable: no accepted baseline rotation was found");
      expect(comp.evidenceDifferences).toHaveLength(0);
    });

    it("provides audit details when accepted baseline is compared with NASA observation", () => {
      const comp = compareBaselineVsNasa({
        candidateId: "cand-1",
        baselineRainfallMm: 150,
        nasaRainfallMm: 80, // Significant deficit
        baselineEtoMm: 350,
        nasaEtoMm: 390,
        baselineRank: 1,
        nasaRank: 2,
      });

      expect(comp.available).toBe(true);
      expect(comp.rankChanged).toBe(true);
      expect(comp.baselineRank).toBe(1);
      expect(comp.nasaRank).toBe(2);
      expect(comp.nasaWaterRisk).toContain("Elevated drought stress");
      expect(comp.evidenceDifferences.length).toBeGreaterThanOrEqual(2);
    });
  });
});
