import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { compareRotations } from "../../lib/engine/compare";
import { recommend } from "../../lib/rotation/engine";
import { buildFieldRequest } from "../../lib/rotation/field-request";
import { powerEnvironment } from "../../lib/rotation/power-environment";
import { DRY_ZONE_POWER_RAIN, UNRELIABLE_HEAT_LIMIT_C, heatLimitCaution, isDryZone } from "../../lib/validation/source-checks";
import type { StationReport } from "../../lib/validation/weather";
import { engineData, rotation, slot, syntheticField, syntheticWeather } from "../helpers/synthetic";

const run = JSON.parse(readFileSync(join(process.cwd(), "data/validation/power-vs-ghcn.json"), "utf8")) as { stations: StationReport[] };

describe("run-time constants match the committed validation results", () => {
  test("Dry Zone rain bias is the Mandalay monthly result", () => {
    const mandalay = run.stations.find((s) => s.station.id === DRY_ZONE_POWER_RAIN.stationId)!;
    expect(mandalay.rain.monthly.relBias).not.toBeNull();
    expect(mandalay.rain.monthly.relBias!).toBeCloseTo(DRY_ZONE_POWER_RAIN.relBias, 2);
    expect(mandalay.rain.monthsCompared).toBe(DRY_ZONE_POWER_RAIN.months);
  });

  test("no station grades heat limits at or above the unreliable limit as good", () => {
    for (const s of run.stations) {
      for (const t of s.tmax.thresholds.filter((x) => x.thresholdC >= UNRELIABLE_HEAT_LIMIT_C)) expect(t.grade, s.station.name).not.toBe("good");
    }
  });
});

describe("cautions reach the farmer", () => {
  test("heat counts at 36 °C and above are marked rough; 35 °C is not", () => {
    expect(heatLimitCaution(38)).toContain("rough");
    expect(heatLimitCaution(35)).toBeNull();
  });

  test("a Magway comparison on POWER rain carries the Dry Zone rain caution", () => {
    const field = syntheticField();
    expect(isDryZone(field.region)).toBe(true);
    const mine = rotation(field.id, [slot("sesame", "sesame", "2026-05-15", "2026-08-23"), slot("gram", "green-gram", "2026-08-30", "2026-11-13")]);
    const res = compareRotations(engineData(field, syntheticWeather()), mine, { baseYear: 2026, now: new Date("2026-11-14T00:00:00Z") });
    expect(res.rain.primary).toBe("P");
    expect(res.current.risks.find((r) => r.id === "dry-zone-power-rain")?.text).toContain("51%");
  });

  test("the rotation path adds the Dry Zone note for real POWER data in Magway only", () => {
    const real = { ...syntheticWeather(), source: { dataset: "NASA POWER", resolution: "about 0.5°", version: "v2.5" } };
    const magway = powerEnvironment(real, "2026-06-01", "2027-05-31", null);
    expect(magway.known_biases?.[0]).toContain("Dry Zone");
    const delta = powerEnvironment({ ...real, latitude: 16.78, longitude: 94.73 }, "2026-06-01", "2027-05-31", null);
    expect(delta.known_biases).toBeUndefined();
    // Synthetic demo data is not real POWER, so it carries no POWER bias note.
    expect(powerEnvironment(syntheticWeather(), "2026-06-01", "2027-05-31", null).known_biases).toBeUndefined();
  });

  test("the rotation engine shows the Dry Zone note as a caution on its scenarios", () => {
    const f = syntheticField({ priorities: { order: ["soil"], weights: {} } });
    const weather = { ...syntheticWeather({ startYear: 2020, endYear: 2025 }), source: { dataset: "NASA POWER", resolution: "about 0.5°", version: "v2.5" } };
    const history = rotation(f.id, [slot("a", "sesame", "2026-05-15", "2026-08-23"), slot("b", "green-gram", "2026-08-30", "2026-11-13")]);
    const built = buildFieldRequest(f, history, { fieldId: f.id, fetchedAt: "2026-11-14T00:00:00Z", weather, sources: [] }, { startDate: "2026-11-20", endDate: "2027-05-20" });
    const result = recommend(built.request);
    expect(result.scenarios.some((s) => s.cautions.some((c) => c.includes("Dry Zone")))).toBe(true);
  });
});
