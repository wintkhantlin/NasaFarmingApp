import { describe, expect, it } from "vitest";
import { buildTimelines, buildMapViz, fieldIdentity, AVAILABILITY, OVERLAY_NOTE } from "@/lib/conditions/explorer-model";
import { buildHeatColdEvidence, buildErosionEvidence, buildFloodEvidence } from "@/lib/conditions/condition-evidence";
import type { TrendSeries } from "@/lib/server/trends";

const series = (key: TrendSeries["key"], values: Array<number | null>): TrendSeries => ({
  key, title: key, unit: "x", source: "NASA POWER", scale: "wider", test: null, sentence: "",
  years: values.map((value, i) => ({ year: 2016 + i, value })),
});
const trends = { through: 2025, trends: [series("hot-days", [30, 32, null, 40, 41, 45, 44, 50, 52, 60]), series("cold-nights", [5, 6, 7, 3, 4, 2, 1, 0, 2, 1])] };
const point: [number, number] = [95.12, 16.84];

describe("explorer model", () => {
  it("keeps a coverage gap as null, never zero, and baselines only the valid years", () => {
    const ev = buildHeatColdEvidence({ trends, point, selectedYear: 2025 });
    const [hot, cold] = buildTimelines("heat_cold", { evidence: ev, trends });
    expect(hot.points.find((p) => p.key === "2018")?.value).toBeNull();
    expect(hot.baseline?.years).toBe("2016–2025");
    expect(hot.selectedKey).toBe("2025");
    expect(cold.id).toBe("cold-nights");
  });

  it("gives erosion no timeline and flood none without valid scenes", () => {
    const e = buildErosionEvidence({ point });
    expect(buildTimelines("erosion", { evidence: e })).toEqual([]);
    const f = buildFloodEvidence({ point });
    expect(buildTimelines("flood", { evidence: f })).toEqual([]);
  });

  it("never labels missing data as available", () => {
    expect(AVAILABILITY.unavailable.tone).toBe("missing");
    expect(AVAILABILITY.unavailable.label).not.toMatch(/available$/i);
    expect(AVAILABILITY.unavailable.label).toMatch(/no data/i);
  });

  it("states what each map does not show, for every risk", () => {
    for (const k of ["water_stress", "flood", "erosion", "heat_cold"] as const) expect(OVERLAY_NOTE[k]).toMatch(/^No /);
  });

  it("omits absent identity parts instead of printing none", () => {
    expect(fieldIdentity({ name: "Field 4", region: "ayeyarwady", irrigation: "none" })).toEqual({ name: "Field 4", context: "Ayeyarwady · Rainfed" });
    expect(fieldIdentity({ name: "Field 4", region: "unsupported", irrigation: "full" }).context).toBe("Irrigated");
  });

  it("tints the data cell by the selected year, from the real series", () => {
    const ev = buildHeatColdEvidence({ trends, point, selectedYear: 2025 });
    const tl = buildTimelines("heat_cold", { evidence: ev, trends });
    const viz = buildMapViz(ev, tl);
    expect(viz.cell?.color).toBe("#9c3d12");
    expect(viz.cell!.opacity).toBeGreaterThan(0.3); // 2025 is the hottest year in the fixture
    expect(viz.field).toBeUndefined();
    expect(viz.readout.value).toBe("60 days");
    expect(viz.readout.scope).toMatch(/whole .*data cell/);
    const low = buildHeatColdEvidence({ trends, point, selectedYear: 2016 });
    expect(buildMapViz(low, buildTimelines("heat_cold", { evidence: low, trends })).cell!.opacity).toBeLessThan(viz.cell!.opacity);
  });

  it("draws nothing, and says so, when there is no data", () => {
    const e = buildErosionEvidence({ point });
    const viz = buildMapViz(e, []);
    expect(viz.cell).toBeUndefined();
    expect(viz.field).toBeUndefined();
    expect(viz.readout.missing).toBe(true);
    expect(viz.readout.note).toMatch(/not a sign/i);
  });

  it("tints the field by slope only when a slope was mapped", () => {
    const e = buildErosionEvidence({ point, remote: { srtm: { status: "ok", data: { slope: { medianDeg: 6 } } } } as never });
    const viz = buildMapViz(e, []);
    expect(viz.field?.opacity).toBeGreaterThan(0.1);
    expect(viz.readout.value).toBe("6.0°");
  });
});
