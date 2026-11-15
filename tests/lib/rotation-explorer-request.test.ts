import { describe, expect, test } from "vitest";
import { buildLocationRequest, unsavedLocationField } from "../../lib/rotation/explorer-request";
import { buildFieldRequest } from "../../lib/rotation/field-request";
import { recommend } from "../../lib/rotation/engine";
import type { FarmerRequest } from "../../lib/rotation/farmer-request";
import type { ConditionsData, RemoteData } from "../../lib/store/data-cache";
import { rotation, slot, syntheticField, syntheticWeather } from "../helpers/synthetic";

const planning = { startDate: "2026-11-20", endDate: "2027-05-20" };
const choices: FarmerRequest = {
  location: { kind: "farm", label: "Test field", lat: 20.15, lon: 94.95 }, previousCrop: "sesame",
  irrigation: "no", priority: "balanced", planning,
  advanced: { soilPh: null, drainage: "unknown", availableCrops: ["rice", "sesame", "maize"] },
};
const conditions = (fieldId: string): ConditionsData => ({
  fieldId, fetchedAt: "2026-11-14T00:00:00Z", weather: syntheticWeather({ startYear: 2025, endYear: 2025 }),
  imerg: { status: "unconfigured", expected: 3653, covered: 0, partialDays: 0, granules: 0, days: [], error: null },
  sourceWarnings: ["IMERG needs an Earthdata token; NASA POWER rainfall remains the historical source when available."], sources: [],
});
const remote = (fieldId: string): RemoteData => ({ fieldId, checkedAt: "2026-11-14T00:00:00Z",
  smap: { kind: "smap", status: "unconfigured", start: "2016-01-01", end: "2025-12-31" },
  hls: { kind: "hls", status: "unconfigured", start: "2021-01-01", end: "2025-12-31" },
  srtm: { kind: "srtm", status: "unconfigured", start: "2000-01-01", end: "2000-12-31" },
});

describe("unified Rotation Explorer requests", () => {
  test("new coordinates enter the field pipeline without a saved field", () => {
    const point = unsavedLocationField(choices.location, choices.irrigation)!;
    expect(point.geometry).toEqual({ type: "Point", coordinates: [94.95, 20.15] });
    expect(point.locationConfirmed).toBe(false);
    const request = buildLocationRequest(choices, conditions(point.id), remote(point.id));
    expect(request.environment.basis).toBe("synthetic");
    expect(request.environment.variable_sources?.missing?.join(" ")).toMatch(/IMERG.*SMAP/);
    expect(request.history).toEqual(["sesame"]);
    expect(recommend(request).scenarios.length).toBeGreaterThan(0);
  });

  test("saved and unsaved entries produce the same screening input when their known facts match", () => {
    const field = syntheticField({ name: "Test field", irrigation: "none" });
    const history = rotation(field.id, [slot("a", "sesame", "2026-05-01", "2026-09-01")]);
    const saved = buildFieldRequest(field, history, conditions(field.id), planning, remote(field.id), choices).request;
    const point = unsavedLocationField(choices.location, choices.irrigation)!;
    const unsaved = buildLocationRequest(choices, conditions(point.id), remote(point.id));
    expect(saved.history).toEqual(unsaved.history);
    expect(saved.farm).toEqual(unsaved.farm);
    expect(saved.environment).toEqual(unsaved.environment);
    expect(recommend(saved).scenarios.map((item) => [item.proposed_crops, item.status])).toEqual(recommend(unsaved).scenarios.map((item) => [item.proposed_crops, item.status]));
  });

  test("saved history and measured soil pH prefill the engine while map pH remains only an estimate", () => {
    const field = syntheticField({ soilObservations: [{ id: "p", property: "ph", value: 6.4, units: "pH", depthCm: [0, 20], date: "2026-01-01", method: "field-kit", source: "Farmer test" }] });
    const history = rotation(field.id, [slot("a", "rice", "2025-05-01", "2025-09-01"), slot("b", "sesame", "2026-05-01", "2026-09-01")]);
    const built = buildFieldRequest(field, history, null, planning);
    expect(built.request.history).toEqual(["rice", "sesame"]);
    expect(built.request.farm.soil_ph).toBe(6.4);
    expect(built.request.farm.soil_ph_estimate).toBeNull();
  });

  test("cross-field data and missing products stay missing, with no demonstration values", () => {
    const request = buildLocationRequest(choices, conditions("another-field"), remote("another-field"));
    expect(request.environment.monthly).toEqual([]);
    expect(request.environment.basis).toBeUndefined();
    expect(recommend(request).global_warnings.join(" ")).toMatch(/No monthly environment data supplied/);
    const noCoordinates = buildLocationRequest({ ...choices, location: { kind: "farm", label: "Name only" } }, null, null);
    expect(noCoordinates.environment.monthly).toEqual([]);
  });
});
