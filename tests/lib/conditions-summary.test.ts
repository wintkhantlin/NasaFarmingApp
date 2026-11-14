import { describe, expect, test } from "vitest";
import { monthlyNormals, toDailyRecords } from "@/lib/engine/climate";
import { BASELINE, buildRainSeries } from "@/lib/engine/data";
import { dailyEt0 } from "@/lib/engine/water";
import type { ImergDay } from "@/lib/nasa/imerg";
import { summariseConditions } from "@/lib/server/conditions-summary";
import { loadWeather, WEATHER_PARAMS } from "@/lib/server/weather";
import type { ServerCache } from "@/lib/server/cache";
import { syntheticWeather } from "../helpers/synthetic";

const imergFor = (dates: string[], mm: number): ImergDay[] =>
  dates.map((date) => ({ date, precipMm: mm, samples: 48, randomError: null, randomErrorSamples: null, partialSampling: false, granule: "test" }));

describe("Conditions summary", () => {
  test("uses POWER rainfall when IMERG is absent and reports it", () => {
    const w = syntheticWeather();
    const s = summariseConditions(w, []);
    expect(s.rainSource).toBe("power");
    expect(s.rainDays.imerg).toBe(0);
    const normals = monthlyNormals(toDailyRecords(w).filter((r) => r.year >= BASELINE.startYear && r.year <= BASELINE.endYear));
    expect(s.monthlyRainMm).toEqual(normals.map((n) => Math.round(n.rainMm)));
    expect(s.completeYears).toBe(BASELINE.endYear - BASELINE.startYear + 1);
  });

  test("uses the same IMERG series as the comparison once coverage is enough", () => {
    const w = syntheticWeather();
    const baselineDates = w.dates.filter((d) => Number(d.slice(0, 4)) >= BASELINE.startYear && Number(d.slice(0, 4)) <= BASELINE.endYear);
    const imerg = imergFor(baselineDates, 2);
    const s = summariseConditions(w, imerg);
    expect(s.rainSource).toBe("imerg");
    expect(s.rainDays.power).toBe(0);
    // 2 mm every day: about 62 mm in a 31-day month
    expect(s.monthlyRainMm[0]).toBe(62);
    const rain = buildRainSeries(toDailyRecords(w).filter((r) => r.year >= BASELINE.startYear && r.year <= BASELINE.endYear), imerg);
    expect(rain.primary).toBe("R");
  });

  test("monthly ET0 is Penman-Monteith, the method the comparison uses", () => {
    const w = syntheticWeather();
    const records = toDailyRecords(w).filter((r) => r.year >= BASELINE.startYear && r.year <= BASELINE.endYear);
    const et0 = dailyEt0(records, w.latitude, w.elevationM ?? 0);
    expect(et0.every((d) => d.method === "penman-monteith")).toBe(true);
    const years = BASELINE.endYear - BASELINE.startYear + 1;
    const jan = et0.filter((d) => d.date.slice(5, 7) === "01").reduce((a, d) => a + (d.mm ?? 0), 0) / years;
    expect(summariseConditions(w, []).monthlyEt0Mm[0]).toBe(Math.round(jan));
    // daily records carry the same value, so monthlyNormals agrees
    expect(records[0].et0Mm).toBeCloseTo(et0[0].mm as number, 6);
  });

  test("root-zone wetness comes from GWETROOT and is absent without it", () => {
    const w = syntheticWeather();
    expect(summariseConditions(w, []).rootWetnessPct).toBeUndefined();
    w.series.GWETROOT = w.dates.map(() => 0.42);
    expect(summariseConditions(w, []).rootWetnessPct).toBe(42);
  });
});

describe("POWER request", () => {
  test("asks for GWETROOT alongside the eight handoff parameters", async () => {
    expect(WEATHER_PARAMS).toContain("GWETROOT");
    let url = "";
    const store = new Map<string, unknown>();
    const cache = { get: async (k: string) => store.get(k) ?? null, set: async (k: string, v: unknown) => void store.set(k, v) } as unknown as ServerCache;
    const fetchStub = (async (u: string) => {
      url = String(u);
      return new Response("{}", { status: 500 });
    }) as unknown as typeof fetch;
    await loadWeather(20, 95, { cache, fetch: fetchStub });
    expect(decodeURIComponent(url)).toContain("GWETROOT");
  });
});
