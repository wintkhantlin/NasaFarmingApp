import { describe, expect, test } from "vitest";
import { compareRotations } from "../../lib/engine/compare";
import { engineData, rotation, slot, syntheticField, syntheticWeather } from "../helpers/synthetic";

const magwayField = () => syntheticField({ priorities: { order: ["water", "soil"], weights: {} } });
const sesameGreenGram = (fieldId: string) =>
  rotation(fieldId, [slot("a", "sesame", "2026-05-15", "2026-08-23"), slot("b", "green-gram", "2026-08-30", "2026-11-13")]);

describe("compareRotations", () => {
  test("a Magway field gets the current rotation and at least two defined alternatives", () => {
    const field = magwayField();
    expect(field.region).toBe("magway");
    const r = compareRotations(engineData(field, syntheticWeather()), sesameGreenGram(field.id), { baseYear: 2026 });
    expect(r.alternatives.length).toBeGreaterThanOrEqual(2);
    // the farmer's own rotation is never offered back as an alternative
    expect(r.alternatives.map((a) => a.id)).not.toContain("strategy-mg-sesame-green-gram");
    expect(r.alternatives.every((a) => a.rotation.source === "strategy")).toBe(true);
  });

  test("the same inputs give the same comparison", () => {
    const field = magwayField();
    const w = syntheticWeather();
    const now = new Date("2026-11-14T00:00:00Z");
    const a = compareRotations(engineData(field, w), sesameGreenGram(field.id), { baseYear: 2026, now });
    const b = compareRotations(engineData(field, w), sesameGreenGram(field.id), { baseYear: 2026, now });
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
  });

  test("with no weather the result is unknown, not zero or a pass", () => {
    const field = magwayField();
    const r = compareRotations(engineData(field, null), sesameGreenGram(field.id), { baseYear: 2026 });
    const sesame = r.current.slots[0];
    expect(sesame.water).toBeNull();
    expect(sesame.rain.total.p50).toBeNull();
    expect(r.current.fit).toBe("not-confirmed");
    expect(r.dataGaps.join(" ")).toContain("NASA POWER weather is not available");
    const rainEvidence = r.current.evidence.filter((e) => e.indicator.sourceId === "R" || e.indicator.sourceId === "P");
    for (const e of rainEvidence) {
      expect(e.indicator.value).toBeNull();
      expect(e.indicator.missingReason).not.toBeNull();
    }
  });

  test("an unconfigured IMERG falls back to POWER rain and says so", () => {
    const field = magwayField();
    const r = compareRotations(engineData(field, syntheticWeather()), sesameGreenGram(field.id), { baseYear: 2026 });
    expect(r.rain.primary).toBe("P");
    expect(r.rain.fromR).toBe(0);
    const ev = r.current.evidence.find((e) => e.id.endsWith(":rain"));
    expect(ev?.indicator.sourceId).toBe("P");
    expect(ev?.indicator.assumptions.join(" ")).toContain("IMERG is not connected");
  });

  test("a location outside the three regions is reported as unsupported", () => {
    const nairobi = syntheticField({ id: "k", centroid: [36.8, -1.3] });
    expect(nairobi.region).toBe("unsupported");
    const r = compareRotations(engineData(nairobi, syntheticWeather({ lat: -1.3, lon: 36.8 })), sesameGreenGram("k"), { baseYear: 2026 });
    expect(r.alternatives).toHaveLength(0);
    expect(r.shortfall).toContain("outside");
    expect(r.current.risks.some((x) => x.id === "region")).toBe(true);
  });

  test("without priorities there is no ranking", () => {
    const field = syntheticField();
    const r = compareRotations(engineData(field, syntheticWeather()), sesameGreenGram(field.id), { baseYear: 2026 });
    expect(r.mcda.status).toBe("no-priorities");
    expect(r.mcda.ranking).toHaveLength(0);
  });

  test("a missing decisive input (pH) is unknown, and a soil value it can use settles it", () => {
    const field = magwayField();
    const w = syntheticWeather();
    const unknown = compareRotations(engineData(field, w), sesameGreenGram(field.id), { baseYear: 2026 });
    expect(unknown.current.slots[0].suitability?.checks.find((c) => c.id === "ph")?.level).toBe("unknown");

    const withPh = syntheticField({ ...field, soilObservations: [{ id: "o1", property: "ph", value: 6.4, units: "pH", depthCm: [0, 20], date: "2026-03-01", method: "laboratory", source: "District lab" }] });
    const known = compareRotations(engineData(withPh, w), sesameGreenGram(withPh.id), { baseYear: 2026 });
    const ph = known.current.slots[0].suitability?.checks.find((c) => c.id === "ph");
    expect(ph?.level).toBe("preferred");
    expect(ph?.inputSource).toBe("Your soil value");
  });
});
