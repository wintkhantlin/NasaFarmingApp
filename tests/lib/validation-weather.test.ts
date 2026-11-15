import { describe, expect, it } from "vitest";
import type { DailyWeather } from "@/lib/nasa/power";
import { MYANMAR_GHCN_STATIONS, parseGhcnCsv, passesQc, splitCsvLine } from "@/lib/validation/ghcn";
import { cleanPairs, continuousScores, eventScores, laggedPairs, pearson } from "@/lib/validation/metrics";
import { renderWeatherReport } from "@/lib/validation/report";
import {
  gradeMonthlyRain,
  gradeTemperature,
  gradeThreshold,
  monthlyTotals,
  rainReport,
  seasonOf,
  stationReport,
  temperatureReport,
} from "@/lib/validation/weather";

describe("metrics", () => {
  it("drops pairs with a missing side", () => {
    expect(cleanPairs([1, null, 3, 4], [1, 2, null, Number.NaN])).toEqual([{ obs: 1, model: 1 }]);
  });

  it("computes bias, MAE, RMSE and r", () => {
    const s = continuousScores([
      { obs: 1, model: 2 },
      { obs: 2, model: 3 },
      { obs: 3, model: 4 },
      { obs: 4, model: 7 },
    ]);
    expect(s.n).toBe(4);
    expect(s.bias).toBeCloseTo(1.5);
    expect(s.relBias).toBeCloseTo(1.5 / 2.5);
    expect(s.mae).toBeCloseTo(1.5);
    expect(s.rmse).toBeCloseTo(Math.sqrt((1 + 1 + 1 + 9) / 4));
    expect(s.r).toBeGreaterThan(0.9);
  });

  it("returns nulls rather than numbers when there is nothing to compare", () => {
    expect(continuousScores([])).toMatchObject({ n: 0, bias: null, rmse: null, r: null });
    expect(pearson([{ obs: 1, model: 1 }, { obs: 1, model: 2 }, { obs: 1, model: 3 }])).toBeNull();
  });

  it("counts event hits, misses and false alarms", () => {
    const e = eventScores(
      [
        { obs: 36, model: 37 }, // hit
        { obs: 36, model: 34 }, // miss
        { obs: 33, model: 36 }, // false alarm
        { obs: 30, model: 31 }, // correct negative
      ],
      (v) => v > 35,
    );
    expect(e).toMatchObject({ hits: 1, misses: 1, falseAlarms: 1, correctNegatives: 1, pod: 0.5, far: 0.5 });
    expect(e.csi).toBeCloseTo(1 / 3);
  });

  it("shifts the model series for lag checks", () => {
    expect(laggedPairs([1, 2, 3], [10, 20, 30], 1)).toEqual([
      { obs: 1, model: 20 },
      { obs: 2, model: 30 },
    ]);
  });
});

describe("GHCN parsing", () => {
  const csv = [
    '"STATION","DATE","LATITUDE","LONGITUDE","ELEVATION","NAME","PRCP","PRCP_ATTRIBUTES","TMAX","TMAX_ATTRIBUTES","TMIN","TMIN_ATTRIBUTES"',
    '"BMM00048097","2020-01-01","16.907","96.133","33.2","YANGON INTERNATIONAL, BM","   89",",,S","  300",",,S","  201",",,S"',
    '"BMM00048097","2020-01-02","16.907","96.133","33.2","YANGON INTERNATIONAL, BM","    0","T,,S","  999",",X,S",,',
  ].join("\n");

  it("splits quoted CSV fields that contain commas", () => {
    expect(splitCsvLine('"a","b,c",,"d"')).toEqual(["a", "b,c", "", "d"]);
  });

  it("reads the quality flag from the attribute string", () => {
    expect(passesQc(",,S")).toBe(true);
    expect(passesQc("T,,S")).toBe(true);
    expect(passesQc(",X,S")).toBe(false);
  });

  it("converts tenths, keeps trace rain as zero and drops quality-flagged values", () => {
    const g = parseGhcnCsv(csv, "BMM00048097");
    expect(g.prcp.get("2020-01-01")).toBeCloseTo(8.9);
    expect(g.prcp.get("2020-01-02")).toBe(0);
    expect(g.tmax.get("2020-01-01")).toBeCloseTo(30);
    expect(g.tmax.has("2020-01-02")).toBe(false);
    expect(g.tmin.has("2020-01-02")).toBe(false);
    expect(g.qcRejected.tmax).toBe(1);
  });

  it("lists every Myanmar GHCN station with coordinates inside the country", () => {
    expect(MYANMAR_GHCN_STATIONS).toHaveLength(5);
    for (const s of MYANMAR_GHCN_STATIONS) {
      expect(s.lat).toBeGreaterThan(9);
      expect(s.lat).toBeLessThan(29);
      expect(s.lon).toBeGreaterThan(92);
      expect(s.lon).toBeLessThan(102);
    }
  });
});

describe("weather grading", () => {
  it("assigns Myanmar seasons by month", () => {
    expect(seasonOf("2020-04-15")).toBe("hot");
    expect(seasonOf("2020-08-01")).toBe("monsoon");
    expect(seasonOf("2020-12-01")).toBe("cool");
    expect(seasonOf("2020-02-29")).toBe("cool");
  });

  it("grades temperature by bias and RMSE, and refuses to grade short records", () => {
    const base = { n: 400, meanObs: 30, meanModel: 30, relBias: 0, mae: 1, r: 0.9 };
    expect(gradeTemperature({ ...base, bias: 0.5, rmse: 1.5 }).grade).toBe("good");
    expect(gradeTemperature({ ...base, bias: -1.8, rmse: 3 }).grade).toBe("usable-with-care");
    expect(gradeTemperature({ ...base, bias: 3, rmse: 4 }).grade).toBe("poor");
    expect(gradeTemperature({ ...base, n: 10, bias: 0, rmse: 0 }).grade).toBe("insufficient-data");
  });

  it("grades monthly rain by relative bias and correlation", () => {
    const base = { n: 60, meanObs: 200, meanModel: 200, bias: 0, mae: 20, rmse: 30 };
    expect(gradeMonthlyRain({ ...base, relBias: 0.1, r: 0.9 }).grade).toBe("good");
    expect(gradeMonthlyRain({ ...base, relBias: -0.25, r: 0.75 }).grade).toBe("usable-with-care");
    expect(gradeMonthlyRain({ ...base, relBias: 0.5, r: 0.9 }).grade).toBe("poor");
  });

  it("grades limit-day detection and needs enough observed events", () => {
    const e = (hits: number, misses: number, falseAlarms: number) =>
      eventScores(
        [
          ...Array.from({ length: hits }, () => ({ obs: 1, model: 1 })),
          ...Array.from({ length: misses }, () => ({ obs: 1, model: 0 })),
          ...Array.from({ length: falseAlarms }, () => ({ obs: 0, model: 1 })),
        ],
        (v) => v === 1,
      );
    expect(gradeThreshold(e(40, 5, 5)).grade).toBe("good");
    expect(gradeThreshold(e(10, 30, 5)).grade).toBe("poor");
    expect(gradeThreshold(e(5, 2, 0)).grade).toBe("insufficient-data");
  });

  it("uses the engine's comparison for heat days (strictly above the limit)", () => {
    const rep = temperatureReport("tmax", ["2020-04-01", "2020-04-02"], [35, 36], [35, 36]);
    const h35 = rep.thresholds.find((t) => t.thresholdC === 35)!;
    expect(h35.hits).toBe(1);
    expect(h35.correctNegatives).toBe(1);
  });

  it("only totals months the station covers well enough", () => {
    const dates = Array.from({ length: 31 }, (_, i) => `2020-01-${String(i + 1).padStart(2, "0")}`);
    const full = monthlyTotals(dates, dates.map(() => 1), dates.map(() => 2));
    expect(full).toEqual([{ month: "2020-01", obs: 31, model: 62 }]);
    const gappy = monthlyTotals(dates, dates.map((_, i) => (i < 20 ? 1 : null)), dates.map(() => 2));
    expect(gappy).toEqual([]);
  });

  it("finds a one-day shift between station and product rain", () => {
    const n = 200;
    const dates = Array.from({ length: n }, (_, i) => new Date(Date.UTC(2020, 0, 1 + i)).toISOString().slice(0, 10));
    const rain = Array.from({ length: n }, (_, i) => ((i * 37) % 11 > 7 ? (i % 13) * 3 : 0));
    // Product reports each event one day later than the station.
    const model = rain.map((_, i) => (i === 0 ? 0 : rain[i - 1]));
    const r = rainReport(dates, rain, model);
    expect(r.bestLag).toBe(1);
    expect(r.wetDays.pod).toBe(1);
    expect(r.wetDaysOnly).toBe(false);
  });

  it("flags stations that leave dry days blank instead of writing zero", () => {
    const dates = Array.from({ length: 100 }, (_, i) => new Date(Date.UTC(2020, 0, 1 + i)).toISOString().slice(0, 10));
    const obs = dates.map((_, i) => (i % 5 === 0 ? 20 : null));
    const r = rainReport(dates, obs, dates.map(() => 5), 100);
    expect(r.rainCoverage).toBeCloseTo(0.2);
    expect(r.wetDaysOnly).toBe(true);
  });
});

describe("station report", () => {
  const dates = Array.from({ length: 731 }, (_, i) => new Date(Date.UTC(2019, 0, 1 + i)).toISOString().slice(0, 10));
  const obsT = dates.map((d, i) => 30 + 5 * Math.sin((i / 365) * 2 * Math.PI));
  const power: DailyWeather = {
    latitude: 16.9,
    longitude: 96.1,
    elevationM: 20,
    dates,
    series: {
      T2M_MAX: obsT.map((v) => v + 1.2),
      T2M_MIN: obsT.map((v) => v - 10),
      PRECTOTCORR: dates.map((d) => (seasonOf(d) === "monsoon" ? 12 : 0.5)),
    },
    source: { dataset: "NASA POWER", resolution: "0.5", version: null },
    meta: { fillValue: -999, timeStandard: "UTC", sources: [], units: {}, apiVersion: null, start: null, end: null },
  };
  const ghcn = {
    stationId: "BMM00048097",
    prcp: new Map(dates.map((d) => [d, seasonOf(d) === "monsoon" ? 10 : 0.5] as const)),
    tmax: new Map(dates.map((d, i) => [d, obsT[i]] as const)),
    tmin: new Map(dates.map((d, i) => [d, obsT[i] - 10] as const)),
    qcRejected: { prcp: 0, tmax: 0, tmin: 0 },
  };

  it("combines temperature and rain checks for one station", () => {
    const rep = stationReport(MYANMAR_GHCN_STATIONS[0], ghcn, power);
    expect(rep.tmax.daily.bias).toBeCloseTo(1.2);
    expect(rep.tmax.daily.grade).toBe("usable-with-care");
    expect(rep.tmin.daily.grade).toBe("good");
    expect(rep.elevationDiffM).toBe(-13);
    expect(rep.rain.monthsCompared).toBe(24);
    expect(rep.rain.monthly.relBias).toBeGreaterThan(0);
  });

  it("renders a report that names the rules and every station", () => {
    const md = renderWeatherReport({
      generatedAt: "2026-11-15T00:00:00Z",
      product: "NASA POWER",
      powerTimeStandard: "UTC",
      groundTruth: "GHCN-Daily",
      stations: [stationReport(MYANMAR_GHCN_STATIONS[0], ghcn, power)],
    });
    expect(md).toContain("## Acceptance rules");
    expect(md).toContain("Yangon International");
    expect(md).toContain("Usable with care");
  });
});
