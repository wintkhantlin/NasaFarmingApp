import { describe, expect, it } from "vitest";
import { makeIndicator } from "@/lib/evidence/indicator";
import { evidenceClassOf, explainIndicator, periodText, valueWithUnits } from "@/lib/evidence/explain";

const base = { fieldId: "f", sourceId: "P" as const, product: "NASA POWER", variableOrLayer: "PRECTOTCORR" };

describe("evidence explainers", () => {
  it("separates the four evidence types", () => {
    expect(evidenceClassOf(makeIndicator({ ...base, indicatorName: "x", kind: "farmer-report", value: 6.5 }))).toBe("farmer");
    expect(evidenceClassOf(makeIndicator({ ...base, indicatorName: "x", kind: "lab", value: 6.5 }))).toBe("farmer");
    expect(evidenceClassOf(makeIndicator({ ...base, indicatorName: "x", kind: "observation", value: 3 }))).toBe("satellite");
    expect(evidenceClassOf(makeIndicator({ ...base, indicatorName: "x", kind: "model-estimate", value: 3 }))).toBe("model");
    expect(evidenceClassOf(makeIndicator({ ...base, indicatorName: "x", kind: "observation", value: null }))).toBe("missing");
  });

  it("never turns a missing value into zero and keeps zero as a real value", () => {
    const missing = makeIndicator({ ...base, indicatorName: "x", value: null, units: "mm" });
    expect(valueWithUnits(missing)).toBeNull();
    expect(valueWithUnits(makeIndicator({ ...base, indicatorName: "x", value: 0, units: "mm" }))).toBe("0 mm");
  });

  it("keeps original value, units and period text", () => {
    const i = makeIndicator({ ...base, indicatorName: "Maize season rain", value: 812, units: "mm", periodStart: "2016-06-01", periodEnd: "2025-10-31" });
    expect(valueWithUnits(i)).toBe("812 mm");
    expect(periodText(i)).toBe("2016-06-01 to 2025-10-31");
  });

  it("says regional data is regional, and history is not a forecast", () => {
    const x = explainIndicator(makeIndicator({ ...base, sourceId: "M", product: "SMAP", variableOrLayer: "sm_rootzone", indicatorName: "Regional root-zone moisture", kind: "model-estimate", value: 0.3, units: "m³/m³" }));
    expect(x.scope).toBe("regional");
    expect(x.limits.join(" ")).toMatch(/not a measurement/i);
    expect(x.timeframe).toMatch(/not a forecast/i);
  });

  it("explains ET0 behind the rain shortfall and NDVI limits", () => {
    const sf = explainIndicator(makeIndicator({ ...base, indicatorName: "Maize rain shortfall", value: 120, units: "mm" }));
    expect(sf.meaning).toMatch(/ET₀/);
    const v = explainIndicator(makeIndicator({ ...base, sourceId: "V", product: "HLSL30", variableOrLayer: "B04", indicatorName: "Clear satellite observations of the field", kind: "observation", value: 9 }));
    expect(v.meaning).toMatch(/NDVI/);
    expect(v.limits.join(" ")).toMatch(/yield/i);
    expect(v.scope).toBe("field");
  });
});
