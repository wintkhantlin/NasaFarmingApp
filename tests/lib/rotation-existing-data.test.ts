import { describe, expect, test } from "vitest";
import { existingDataEnvironment } from "../../lib/rotation/existing-data";
import { buildFieldRequest } from "../../lib/rotation/field-request";
import { recommend } from "../../lib/rotation/engine";
import type { ConditionsData, RemoteData } from "../../lib/store/data-cache";
import type { ImergDay } from "../../lib/nasa/imerg";
import { rotation, slot, syntheticField, syntheticWeather } from "../helpers/synthetic";

const planning = { startDate: "2026-11-20", endDate: "2027-05-20" };
const historicalFixture = () => {
  // Deterministic test numbers only; metadata mimics a parsed POWER response to test the adapter.
  const weather = syntheticWeather({ startYear: 2025, endYear: 2025 });
  weather.source = { dataset: "NASA POWER", resolution: "about 0.5°", version: "1.0" };
  weather.meta = { ...weather.meta, sources: ["TEST FIXTURE"], units: { T2M: "C", PRECTOTCORR: "mm/day" } };
  return weather;
};
const imergDays = (): ImergDay[] => historicalFixture().dates.map((date) => ({
  date, precipMm: 2, samples: 48, randomError: null, randomErrorSamples: null,
  partialSampling: false, granule: `fixture-${date}`,
}));
const conditions = (over: Partial<ConditionsData> = {}): ConditionsData => ({
  fieldId: "f1", fetchedAt: "2026-11-14T00:00:00Z", weather: historicalFixture(),
  imerg: { status: "ok", expected: 365, covered: 365, partialDays: 0, granules: 365, days: imergDays(), error: null },
  sources: [{ dataset: "GPM IMERG Final daily V07", resolution: "0.1°", dates: "2025" }], ...over,
});
const history = () => rotation("f1", [slot("a", "sesame", "2026-05-01", "2026-09-01")]);

describe("existing environmental products in rotation", () => {
  test("uses only complete aligned IMERG days and keeps per-variable provenance", () => {
    const snapshot = existingDataEnvironment(conditions(), null, planning);
    expect(snapshot.monthly.find((row) => row.month === "2026-11")?.rain_mm).toBe(60);
    expect(snapshot.variable_sources?.rainfall).toMatch(/IMERG.*0.1°/);
    expect(snapshot.variable_sources?.temperature).toMatch(/POWER/);
    expect(snapshot.observation_period).toEqual({ start_date: "2025-01-01", end_date: "2025-12-31" });
    const result = recommend(buildFieldRequest(syntheticField(), history(), conditions(), planning).request);
    expect(result.input_variable_sources?.rainfall).toMatch(/IMERG/);
  });

  test("missing or partially sampled days reject the IMERG year and preserve POWER rainfall", () => {
    const original = existingDataEnvironment(conditions({ imerg: undefined }), null, planning);
    const incomplete = conditions();
    incomplete.imerg!.days[0].precipMm = null;
    expect(existingDataEnvironment(incomplete, null, planning).monthly).toEqual(original.monthly);
    expect(existingDataEnvironment(incomplete, null, planning).variable_sources?.missing?.join(" ")).toMatch(/no complete/);
    const partial = conditions();
    partial.imerg!.days[0].samples = 47;
    expect(existingDataEnvironment(partial, null, planning).variable_sources?.rainfall).toMatch(/NASA POWER/);
  });

  test("rejects duplicate dates, non-UTC POWER and conflicting IMERG provenance", () => {
    const duplicated = conditions();
    duplicated.imerg!.days.push({ ...duplicated.imerg!.days[0] });
    expect(existingDataEnvironment(duplicated, null, planning).variable_sources?.rainfall).toMatch(/NASA POWER/);
    const localTime = conditions();
    localTime.weather!.meta.timeStandard = "LST";
    expect(existingDataEnvironment(localTime, null, planning).variable_sources?.rainfall).toMatch(/NASA POWER/);
    const wrongSource = conditions({ sources: [{ dataset: "Unknown rainfall", resolution: "0.1°" }] });
    expect(existingDataEnvironment(wrongSource, null, planning).variable_sources?.rainfall).toMatch(/NASA POWER/);
    const wrongUnits = conditions();
    wrongUnits.weather!.meta.units.T2M = "K";
    expect(existingDataEnvironment(wrongUnits, null, planning).variable_sources?.missing?.join(" ")).toMatch(/temperature units/);
  });

  test("SoilGrids pH remains an estimate and cannot exclude a crop", () => {
    const c = conditions({ imerg: undefined, soil: { ph: 2, source: { dataset: "ISRIC SoilGrids v2", resolution: "250 m", depth: "0 to 30 cm" } } as ConditionsData["soil"] });
    const built = buildFieldRequest(syntheticField(), history(), c, planning);
    expect(built.request.farm.soil_ph).toBeNull();
    expect(built.request.farm.soil_ph_estimate?.value).toBe(2);
    const scenario = recommend(built.request).scenarios.find((item) => item.proposed_crops[0] === "rice")!;
    expect(scenario.hard_constraints.join(" ")).not.toMatch(/pH/);
    expect(scenario.missing_information.join(" ")).toMatch(/field test/);
    const observed = syntheticField({ soilOverride: { ph: 2 } });
    expect(recommend(buildFieldRequest(observed, history(), c, planning).request).scenarios.find((item) => item.proposed_crops[0] === "rice")?.hard_constraints.join(" ")).toMatch(/measured soil pH/);
    const mismatched = buildFieldRequest(syntheticField({ id: "another-field" }), history(), c, planning);
    expect(mismatched.request.farm.soil_ph_estimate).toBeNull();
  });

  test("SMAP observations are contextual and missing values are counted", () => {
    const remote = { fieldId: "f1", checkedAt: "2026-11-14T00:00:00Z", smap: { kind: "smap", status: "ok", provider: "appeears", start: "2025-01-01", end: "2025-12-31", data: { days: [
      { date: "2025-02-01", surface: null, rootzone: 0.31, rootzonePctl: null, validSurface: 0, validRootzone: 8, rows: 8 },
      { date: "2025-02-02", surface: null, rootzone: null, rootzonePctl: null, validSurface: 0, validRootzone: 0, rows: 8 },
    ] } }, hls: { kind: "hls", status: "unconfigured", start: "2021-01-01", end: "2025-12-31" }, srtm: { kind: "srtm", status: "unconfigured", start: "2000-01-01", end: "2000-12-31" } } as RemoteData;
    const result = recommend(buildFieldRequest(syntheticField(), history(), conditions(), planning, remote).request);
    expect(result.input_environment_context?.smap?.observations).toHaveLength(1);
    expect(result.input_environment_context?.smap?.missing_count).toBe(364);
    expect(result.scenarios.every((item) => item.observations_used.every((row) => row.soil_moisture_anomaly === null))).toBe(true);
    expect(result.global_warnings.join(" ")).toMatch(/contextual only/);
  });

  test("missing credentials and failed soil retrieval stay explicit without adding fake values", () => {
    const c = conditions({ soil: null, soilAvailable: false, imerg: { status: "unconfigured", expected: 3653, covered: 0, partialDays: 0, granules: 0, days: [], error: null },
      sourceWarnings: ["SoilGrids map data could not be retrieved; estimated soil pH is unknown.", "IMERG needs an Earthdata token; NASA POWER rainfall remains the historical source when available."] });
    const remote = { fieldId: "f1", checkedAt: "2026-11-14T00:00:00Z", smap: { kind: "smap", status: "unconfigured", start: "2016-01-01", end: "2025-12-31" },
      hls: { kind: "hls", status: "unconfigured", start: "2021-01-01", end: "2025-12-31" }, srtm: { kind: "srtm", status: "unconfigured", start: "2000-01-01", end: "2000-12-31" } } as RemoteData;
    const result = recommend(buildFieldRequest(syntheticField(), history(), c, planning, remote).request);
    expect(result.input_environment_context?.soil_ph_estimate).toBeUndefined();
    expect(result.input_environment_context?.smap).toBeUndefined();
    expect(result.input_variable_sources?.rainfall).toMatch(/POWER/);
    expect(result.global_warnings.join(" ")).toMatch(/SoilGrids.*unknown.*IMERG.*Earthdata token.*SMAP.*credentials/);
  });

  test("a failed POWER retrieval does not borrow demo climate", () => {
    const c = conditions({ weather: null, soil: null, imerg: { status: "unconfigured", expected: 3653, covered: 0, partialDays: 0, granules: 0, days: [], error: null },
      sourceWarnings: ["NASA POWER history could not be retrieved; temperature and rainfall are unknown."] });
    const result = recommend(buildFieldRequest(syntheticField(), history(), c, planning).request);
    expect(result.input_environment_basis).toBeNull();
    expect(result.global_warnings.join(" ")).toMatch(/POWER history could not be retrieved/);
    expect(result.global_warnings.join(" ")).toMatch(/No monthly environment data supplied/);
    expect(result.scenarios.every((item) => item.observations_used.every((row) => row.temp_c === null && row.rain_mm === null))).toBe(true);
  });
});
