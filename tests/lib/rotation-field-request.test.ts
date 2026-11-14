import { describe, expect, test } from "vitest";
import { buildFieldRequest, engineCropId, lastKnownCrop } from "../../lib/rotation/field-request";
import { recommend } from "../../lib/rotation/engine";
import { rotation, slot, syntheticField, syntheticWeather } from "../helpers/synthetic";

const planning = { startDate: "2026-11-20", endDate: "2027-05-20" };
const field = () => syntheticField({ priorities: { order: ["soil"], weights: {} } });
const history = () => rotation("f1", [slot("a", "sesame", "2026-05-15", "2026-08-23"), slot("b", "green-gram", "2026-08-30", "2026-11-13")]);

describe("saved field to rotation engine", () => {
  test("maps the last crop, irrigation, priorities and excluded crops", () => {
    const f = field();
    f.irrigation = "supplemental";
    f.constraints = { excludedCropIds: ["black-gram"], irrigation: { access: "none" }, preferredCropIds: ["rice"] };
    f.soilObservations = [
      { id: "p", property: "ph", value: 6.4, units: "pH", depthCm: [0, 20], date: "2026-01-01", method: "laboratory", source: "District lab" },
      { id: "d", property: "drainage", value: "poor", units: "class", depthCm: [0, 20], date: "2026-01-01", method: "farmer-estimate", source: "Farmer" },
    ];
    const built = buildFieldRequest(f, history(), null, planning);
    expect(lastKnownCrop(history())?.id).toBe("green-gram");
    expect(engineCropId("green-gram")).toBe("green_gram");
    expect(built.request.history).toEqual(["green_gram"]);
    expect(built.request.farm.irrigation).toBe("none");
    expect(built.request.farm.soil_ph).toBe(6.4);
    expect(built.request.farm.drainage).toBe("poor");
    expect(built.preferencesNotApplied).toEqual(["rice"]);
    expect(built.request.farm.available_crops).not.toContain("black_gram");
    expect(built.request.farmer.priorities).toHaveProperty("legume_inclusion", 1);
    expect(recommend(built.request).scenarios.length).toBeGreaterThan(0);
  });

  test("missing weather remains missing in the engine result", () => {
    const result = recommend(buildFieldRequest(field(), history(), null, planning).request);
    expect(result.global_warnings.join(" ")).toContain("No monthly environment data supplied");
    expect(result.scenarios.some((item) => item.missing_information.some((reason) => /temperature|rainfall/i.test(reason)))).toBe(true);
  });

  test("synthetic test weather is explicitly labeled and never shown as NASA observations", () => {
    const f = field();
    const weather = syntheticWeather({ startYear: 2025, endYear: 2025 });
    const built = buildFieldRequest(f, history(), { fieldId: f.id, fetchedAt: "2026-11-14T00:00:00Z", weather, sources: [] }, planning);
    expect(built.request.environment.basis).toBe("synthetic");
    expect(built.request.environment.source).toContain("synthetic");
    expect(built.request.environment.monthly.some((row) => row.temp_c !== null)).toBe(true);
  });

  test("unsupported previous crops are rejected rather than silently remapped", () => {
    expect(() => buildFieldRequest(field(), rotation("f1", [slot("x", "groundnut", "2026-01-01", "2026-04-01")]), null, planning)).toThrow(/five-crop/);
  });

  test("an unsupported priority does not become a balanced ranking", () => {
    const f = syntheticField({ priorities: { order: ["forage"], weights: {} } });
    const built = buildFieldRequest(f, history(), null, planning);
    expect(built.unsupportedPriority).toBe("forage");
    expect(built.request.farmer.priorities).toEqual({});
  });
});
