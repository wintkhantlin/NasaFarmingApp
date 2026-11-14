import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  PowerError,
  parsePowerClimatology,
  parsePowerDaily,
  powerDailyUrl,
} from "../../lib/nasa/power";
import { parseSoilGrids, soilGridsUrl, usdaTexture } from "../../lib/soil/soilgrids";

const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(join(import.meta.dirname, "../fixtures/ames", name), "utf8"));

describe("NASA POWER", () => {
  test("builds a daily point URL with the AG community", () => {
    const url = powerDailyUrl({ lat: 42.03, lon: -93.62, start: "20240101", end: "20240110" });
    expect(url).toContain("community=AG");
    expect(url).toContain("latitude=42.0300");
    expect(url).toContain("PRECTOTCORR");
    expect(url).toContain("time-standard=UTC");
    // the handoff's eight parameters, and not the wetness fields
    for (const p of ["T2M", "T2M_MAX", "T2M_MIN", "RH2M", "WS2M", "ALLSKY_SFC_SW_DWN", "PRECTOTCORR", "PS"]) {
      expect(url).toContain(p);
    }
    expect(url).not.toContain("GWETROOT");
  });

  test("parses the ten-day sample into ISO dates and series", () => {
    const w = parsePowerDaily(fixture("power-daily-sample.json"));
    expect(w.dates).toHaveLength(10);
    expect(w.dates[0]).toBe("2024-01-01");
    expect(w.dates[9]).toBe("2024-01-10");
    expect(w.elevationM).toBeCloseTo(310.22, 2);
    expect(w.series.T2M?.[0]).toBeCloseTo(-3.37, 2);
    expect(Object.keys(w.series)).toHaveLength(10);
    expect(w.source.dataset).toBe("NASA POWER");
  });

  test("turns the -999 fill value into null", () => {
    const raw = {
      geometry: { coordinates: [0, 0, 5] },
      header: { fill_value: -999 },
      properties: { parameter: { PRECTOTCORR: { "20240101": -999, "20240102": 1.5 } } },
    };
    const w = parsePowerDaily(raw);
    expect(w.series.PRECTOTCORR).toEqual([null, 1.5]);
  });

  test("rejects a response with no parameters", () => {
    expect(() => parsePowerDaily({ messages: ["bad request"] })).toThrow(PowerError);
  });

  test("reads climatology months and the annual value", () => {
    const c = parsePowerClimatology(fixture("power-climatology.json"));
    expect(c.months.T2M).toHaveLength(12);
    expect(c.months.T2M![0]).toBeCloseTo(-6.44, 2);
    expect(c.annual.T2M).toBeDefined();
  });
});

describe("SoilGrids", () => {
  test("requests eight properties at three depths", () => {
    const url = soilGridsUrl(42.12, -93.75);
    expect(url.match(/property=/g)).toHaveLength(8);
    expect(url.match(/depth=/g)).toHaveLength(3);
  });

  test("scales a rural Iowa point into conventional units", () => {
    const p = parseSoilGrids(fixture("soilgrids-rural.json"));
    expect(p).not.toBeNull();
    expect(p!.clayPct!).toBeGreaterThan(30);
    expect(p!.clayPct!).toBeLessThan(32);
    expect(p!.ph!).toBeGreaterThan(6.4);
    expect(p!.ph!).toBeLessThan(6.7);
    expect(p!.bulkDensityKgDm3!).toBeGreaterThan(1.3);
    expect(p!.bulkDensityKgDm3!).toBeLessThan(1.7);
    expect(p!.texture).toBe("clay loam");
    expect(p!.source.dataset).toContain("SoilGrids");
  });

  test("a point with only nulls is a normal result, not an error", () => {
    expect(parseSoilGrids(fixture("soilgrids-urban-null.json"))).toBeNull();
  });

  test("USDA texture classes", () => {
    expect(usdaTexture(92, 5, 3)).toBe("sand");
    expect(usdaTexture(40, 40, 20)).toBe("loam");
    expect(usdaTexture(20, 65, 15)).toBe("silt loam");
    expect(usdaTexture(20, 20, 60)).toBe("clay");
    expect(usdaTexture(30, 38, 32)).toBe("clay loam");
    expect(usdaTexture(65, 20, 15)).toBe("sandy loam");
  });
});
