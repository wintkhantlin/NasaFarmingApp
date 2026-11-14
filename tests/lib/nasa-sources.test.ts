import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { cellIndices, cmrUrl, discoverGranules, opendapCellUrl, parseCellReply, parseCmrEntries, pool, toImergDay, IMERG } from "../../lib/nasa/imerg";
import { parsePowerDaily, powerDailyUrl } from "../../lib/nasa/power";
import { fillValueOf, layerMeta, scaleOf } from "../../lib/nasa/appeears/products";
import { detectDelivery, toPhysical } from "../../lib/nasa/appeears/scale";
import { parseBundleFileName, parseSmapCsv, smapWindowStats } from "../../lib/nasa/appeears/results";
import { smapPointTask, srtmAreaTask, hlsAreaTask, appeearsDate, SMAP_SAFE_END } from "../../lib/nasa/appeears/tasks";
import { decodeFmask } from "../../lib/nasa/qa/hls-fmask";
import { decodeViQuality, viUsable } from "../../lib/nasa/qa/modis-vi";
import { ecostressClear } from "../../lib/nasa/qa/ecostress";
import { ndvi, ndmi, summariseHls } from "../../lib/nasa/derive/ndvi";
import { slopeGrid } from "../../lib/nasa/derive/slope";
import { penmanMonteithEt0 } from "../../lib/engine/et0";
import { earthdataConfigured } from "../../lib/nasa/earthdata";

const fixture = (name: string): unknown => JSON.parse(readFileSync(join(import.meta.dirname, "../fixtures/myanmar", name), "utf8"));

describe("NASA POWER, Myanmar connectivity example", () => {
  test("the handoff request is reproduced: eight parameters, UTC, AG", () => {
    const url = powerDailyUrl({ lat: 20.15, lon: 94.95, start: "20250101", end: "20250102" });
    expect(url).toContain("community=AG");
    expect(url).toContain("time-standard=UTC");
    expect(decodeURIComponent(url)).toContain("T2M,T2M_MAX,T2M_MIN,RH2M,WS2M,ALLSKY_SFC_SW_DWN,PRECTOTCORR,PS");
  });

  test("the verified response parses with its units, fill value and time standard", () => {
    const w = parsePowerDaily((fixture("power-connectivity-example.json") as { response: unknown }).response);
    expect(w.dates).toEqual(["2025-01-01", "2025-01-02"]);
    expect(w.series.RH2M).toEqual([47.72, 45.45]);
    expect(w.series.PS?.[0]).toBeCloseTo(99.23);
    expect(w.meta.fillValue).toBe(-999);
    expect(w.meta.timeStandard).toBe("UTC");
    expect(w.meta.units.ALLSKY_SFC_SW_DWN).toBe("MJ/m^2/day");
    expect(w.meta.units.PS).toBe("kPa");
    expect(w.meta.sources).toContain("MERRA2");
  });
});

describe("GPM IMERG", () => {
  const entries = parseCmrEntries((fixture("imerg-discovery-example.json") as { response: unknown }).response);

  test("reads the verified CMR granule record", () => {
    expect(entries).toHaveLength(1);
    expect(entries[0].date).toBe("2025-01-01");
    expect(entries[0].producerGranuleId).toContain("V07B.nc4");
    expect(entries[0].dataUrl).toContain("data.gesdisc.earthdata.nasa.gov");
    expect(entries[0].opendapUrl).toContain("opendap.earthdata.nasa.gov");
  });

  test("builds the CMR query with the handoff keys and pages from 1", () => {
    const u = cmrUrl({ start: "2025-01-01T00:00:00Z", end: "2025-01-02T23:59:59Z", bbox: [94, 19, 96, 21] }, 1);
    expect(u).toContain("short_name=GPM_3IMERGDF");
    expect(u).toContain("version=07");
    expect(u).toContain("page_num=1");
    expect(u).toContain("bounding_box=94%2C19%2C96%2C21");
  });

  test("follows pages until a short page is returned, one record per day", async () => {
    const mk = (d: string) => ({ id: d, producer_granule_id: d, time_start: `${d}T00:00:00.000Z`, links: [] });
    const pages = [[mk("2025-01-01"), mk("2025-01-02")], [mk("2025-01-03")]];
    let calls = 0;
    const f = (async () => ({ ok: true, json: async () => ({ feed: { entry: pages[calls++] ?? [] } }) })) as unknown as typeof fetch;
    const out = await discoverGranules({ start: "2025-01-01T00:00:00Z", end: "2025-01-03T23:59:59Z", pageSize: 2 }, { fetch: f });
    expect(out.map((g) => g.date)).toEqual(["2025-01-01", "2025-01-02", "2025-01-03"]);
    expect(calls).toBe(2);
  });

  test("indexes the 0.1 degree cell and builds a one-cell request, not a global download", () => {
    const { latIdx, lonIdx } = cellIndices(20.15, 94.95);
    expect(latIdx).toBe(Math.floor((20.15 + 90) * 10));
    expect(lonIdx).toBe(Math.floor((94.95 + 180) * 10));
    const u = opendapCellUrl("https://opendap.example/granule", 20.15, 94.95);
    expect(decodeURIComponent(u)).toContain(`/precipitation[0][${lonIdx}][${latIdx}]`);
    expect(decodeURIComponent(u)).toContain("randomError_cnt");
  });

  test("a day with fewer than 48 valid half-hours is flagged partial; fill is missing, never zero", () => {
    const g = entries[0];
    const partial = toImergDay(g, "precipitation[0][2749][1101]\n3.2\nprecipitation_cnt[0][2749][1101]\n30\nrandomError[0][2749][1101]\n1.1\nrandomError_cnt[0][2749][1101]\n30");
    expect(partial.samples).toBe(30);
    expect(partial.partialSampling).toBe(true);
    const full = toImergDay(g, "precipitation[0][1][1]\n0\nprecipitation_cnt[0][1][1]\n48\n");
    expect(full.precipMm).toBe(0); // a real zero stays a zero
    expect(full.partialSampling).toBe(false);
    const fill = parseCellReply("precipitation[0][1][1]\n-9999.9\nprecipitation_cnt[0][1][1]\n48");
    expect(fill.precipitation).toBeNull();
    expect(IMERG.fullDaySamples).toBe(48);
  });

  test("the pool keeps order, limits concurrency and returns failures instead of throwing", async () => {
    let active = 0;
    let peak = 0;
    const out = await pool([1, 2, 3, 4, 5], 2, async (n) => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 2));
      active--;
      if (n === 3) throw new Error("boom");
      return n * 2;
    });
    expect(peak).toBeLessThanOrEqual(2);
    expect(out[0]).toBe(2);
    expect(out[2]).toBeInstanceOf(Error);
    expect(out[4]).toBe(10);
  });
});

describe("AppEEARS metadata, scaling and tasks", () => {
  test("verified fill values and scales", () => {
    expect(fillValueOf("HLSL30.020", "B04")).toBe(-9999);
    expect(scaleOf("HLSL30.020", "B04")).toEqual({ scale: 0.0001, offset: 0 });
    expect(fillValueOf("HLSL30.020", "Fmask")).toBe(255);
    expect(fillValueOf("SPL4SMGP.008", "Geophysical_Data_sm_surface")).toBe(-9999);
    expect(fillValueOf("MOD13Q1.061", "_250m_16_days_NDVI")).toBe(-3000);
    expect(fillValueOf("SRTMGL1_NC.003", "SRTMGL1_DEM")).toBe(-32768);
    expect(layerMeta("SPL4SMGP.008", "Geophysical_Data_sm_rootzone").Units).toBe("m^3/m^3");
    expect(() => layerMeta("HLSL30.020", "NOPE")).toThrow();
  });

  test("scale is applied once: raw is scaled, already-scaled is left alone, fill becomes null", () => {
    expect(toPhysical("HLSL30.020", "B04", 1500, "raw")).toBeCloseTo(0.15);
    expect(toPhysical("HLSL30.020", "B04", 0.15, "scaled")).toBeCloseTo(0.15);
    expect(toPhysical("HLSL30.020", "B04", -9999, "raw")).toBeNull();
    expect(toPhysical("SPL4SMGP.008", "Geophysical_Data_sm_surface", -9999, "scaled")).toBeNull();
    expect(toPhysical("SPL4SMGP.008", "Geophysical_Data_sm_surface", 0.31, "raw")).toBeCloseTo(0.31); // no scale in the metadata
    expect(detectDelivery("HLSL30.020", "B04", [0.12, 0.2, 0.31])).toBe("scaled");
    expect(detectDelivery("HLSL30.020", "B04", [1200, 2000, 3100, -9999])).toBe("raw");
  });

  test("a task body uses MM-DD-YYYY, real layer keys and longitude, latitude", () => {
    expect(appeearsDate("2025-03-07")).toBe("03-07-2025");
    const t = smapPointTask({ name: "n", id: "EXAMPLE-NOT-A-FARM", point: [94.95, 20.15], start: "2025-01-01", end: SMAP_SAFE_END });
    expect(t.task_type).toBe("point");
    expect(t.params.dates[0]).toEqual({ startDate: "01-01-2025", endDate: "12-31-2025" });
    expect(t.params.layers.map((l) => l.layer)).toEqual(["Geophysical_Data_sm_surface", "Geophysical_Data_sm_rootzone", "Geophysical_Data_sm_rootzone_pctl"]);
    expect(t.params.coordinates[0]).toEqual({ id: "EXAMPLE-NOT-A-FARM", longitude: 94.95, latitude: 20.15 });
    const hls = hlsAreaTask({ name: "n", geometry: { type: "Point", coordinates: [97, 20.8] }, start: "2021-01-01", end: "2021-12-31" });
    expect(hls.params.output).toEqual({ format: { type: "geotiff" }, projection: "native" });
    expect(hls.params.layers.every((l) => l.product === "HLSL30.020")).toBe(true);
    const srtm = srtmAreaTask({ name: "n", geometry: { type: "Point", coordinates: [97, 20.8] } });
    expect(srtm.params.dates[0].startDate).toBe("02-11-2000");
    expect(srtm.params.layers[0]).toEqual({ product: "SRTMGL1_NC.003", layer: "SRTMGL1_DEM" });
  });

  test("SMAP CSV becomes daily means with valid counts; fill stays missing", () => {
    const csv = [
      "ID,Latitude,Longitude,Date,SPL4SMGP_008_Geophysical_Data_sm_surface,SPL4SMGP_008_Geophysical_Data_sm_rootzone,SPL4SMGP_008_Geophysical_Data_sm_rootzone_pctl",
      "a,20.15,94.95,2025-06-01,0.2,0.3,40",
      "a,20.15,94.95,2025-06-01,0.4,-9999,-9999",
      "a,20.15,94.95,2025-06-02,-9999,-9999,-9999",
    ].join("\n");
    const days = parseSmapCsv(csv);
    expect(days[0].surface).toBeCloseTo(0.3);
    expect(days[0].rootzone).toBeCloseTo(0.3);
    expect(days[0].validRootzone).toBe(1);
    expect(days[0].rows).toBe(2);
    expect(days[1].rootzone).toBeNull();
    const stats = smapWindowStats(days, "2025-06-01", "2025-06-03");
    expect(stats.validDays).toBe(1);
    expect(stats.expectedDays).toBe(3);
  });

  test("bundle file names give product, layer and date", () => {
    expect(parseBundleFileName("HLSL30.020_B04_doy2025045_aid0001.tif")).toEqual({ product: "HLSL30.020", layer: "B04", date: "2025-02-14" });
    expect(parseBundleFileName("SRTMGL1_NC.003_SRTMGL1_DEM_aid0001.tif")?.date).toBeNull();
  });

  test("Earthdata is only configured when the server has credentials", () => {
    expect(earthdataConfigured("appeears", {})).toBe(false);
    expect(earthdataConfigured("appeears", { EARTHDATA_USERNAME: "u", EARTHDATA_PASSWORD: "p" })).toBe(true);
    expect(earthdataConfigured("imerg", {})).toBe(false);
    expect(earthdataConfigured("imerg", { EARTHDATA_TOKEN: "t" })).toBe(true);
  });
});

describe("quality screening", () => {
  test("HLS Fmask: bit 0 is reserved, bits 1 to 4 reject, water is kept apart, 255 is fill", () => {
    expect(decodeFmask(0).validLand).toBe(true);
    expect(decodeFmask(1).validLand).toBe(true); // bit 0 reserved in HLS V2
    expect(decodeFmask(0b10).cloud).toBe(true);
    expect(decodeFmask(0b100).adjacent).toBe(true);
    expect(decodeFmask(0b1000).shadow).toBe(true);
    expect(decodeFmask(0b10000).snow).toBe(true);
    const water = decodeFmask(0b100000);
    expect(water.water).toBe(true);
    expect(water.validLand).toBe(false);
    expect(decodeFmask(0b11000000).aerosol).toBe(3);
    expect(decodeFmask(0b11000000).validLand).toBe(false);
    expect(decodeFmask(255).fill).toBe(true);
  });

  test("MODIS VI quality uses its own bit fields", () => {
    const landGood = 1 << 11; // MODLAND good, land (bits 11 to 13 = 1)
    expect(decodeViQuality(landGood)?.modland).toBe(0);
    expect(viUsable(landGood, 0)).toBe(true);
    expect(viUsable(landGood, 3)).toBe(false); // reliability says cloudy
    expect(viUsable(landGood, null)).toBe(false); // missing QA never passes
    expect(viUsable(landGood | (1 << 10), 0)).toBe(false); // mixed clouds
    expect(viUsable(landGood | (1 << 15), 0)).toBe(false); // shadow
    expect(viUsable((landGood & ~(0b111 << 11)) | (3 << 11), 0)).toBe(false); // inland water is set aside
    expect(decodeViQuality(65535)).toBeNull(); // fill
  });

  test("ECOSTRESS: an unknown mask is not clear", () => {
    expect(ecostressClear(0, 0)).toBe(true);
    expect(ecostressClear(1, 0)).toBe(false);
    expect(ecostressClear(255, 0)).toBe(false);
    expect(ecostressClear(null, 0)).toBe(false);
  });
});

describe("derived indices", () => {
  test("NDVI and NDMI; a zero or invalid denominator is missing, not zero", () => {
    expect(ndvi(0.4, 0.1)).toBeCloseTo(0.6);
    expect(ndmi(0.4, 0.2)).toBeCloseTo(1 / 3);
    expect(ndvi(0, 0)).toBeNull();
    expect(ndvi(null, 0.1)).toBeNull();
    expect(ndvi(-0.1, 0.05)).toBeNull();
  });

  test("a field summary drops cloud and fill, sets water aside, and reports coverage", () => {
    const [d1, d2] = summariseHls({
      dates: ["2025-05-01", "2025-05-17"],
      pixels: [
        [
          [0.1, 0.4, 0.2, 0], // clear land
          [0.1, 0.4, 0.2, 0b10], // cloud
          [-9999, -9999, -9999, 255], // fill outside the polygon
          [0.05, 0.02, 0.01, 0b100000], // water
        ],
        [[0.1, 0.4, 0.2, 0b10]], // a fully cloudy date
      ],
    });
    expect(d1.validPixels).toBe(1);
    expect(d1.totalPixels).toBe(4);
    expect(d1.waterPixels).toBe(1);
    expect(d1.ndviMedian).toBeCloseTo(0.6);
    expect(d2.ndviMedian).toBeNull(); // not zero vegetation
    expect(d2.coverage).toBe(0);
  });

  test("slope uses metres, not degrees, and needs a full neighbourhood", () => {
    // a plane rising 10 m per cell towards the east, cells about 30 m wide at the equator
    const w = 5;
    const h = 5;
    const dLon = 30 / 111_320;
    const values = Array.from({ length: w * h }, (_, i) => (i % w) * 10);
    const s = slopeGrid({ values, width: w, height: h, dLonDeg: dLon, dLatDeg: dLon, centreLatDeg: 0 });
    expect(s.medianDeg).toBeCloseTo((Math.atan(10 / 30) * 180) / Math.PI, 1);
    expect(s.validCells).toBe(9);
    // the same grid at 60 degrees north has narrower cells, so it is steeper
    const north = slopeGrid({ values, width: w, height: h, dLonDeg: dLon, dLatDeg: dLon, centreLatDeg: 60 });
    expect(north.medianDeg as number).toBeGreaterThan(s.medianDeg as number);
    // a missing neighbour leaves the cell without a slope
    const holed = [...values] as Array<number | null>;
    holed[6] = null;
    expect(slopeGrid({ values: holed, width: w, height: h, dLonDeg: dLon, dLatDeg: dLon, centreLatDeg: 0 }).validCells).toBeLessThan(9);
    // a single sampled cell has no slope at all
    expect(slopeGrid({ values: [5], width: 1, height: 1, dLonDeg: dLon, dLatDeg: dLon, centreLatDeg: 0 }).medianDeg).toBeNull();
  });
});

describe("FAO-56 Penman-Monteith", () => {
  test("reproduces FAO-56 Example 18 (Brussels, 6 July): about 3.9 mm/day", () => {
    const eto = penmanMonteithEt0({
      latDeg: 50.8,
      doy: 187,
      elevationM: 100,
      tmaxC: 21.5,
      tminC: 12.3,
      tmeanC: 16.9,
      rhMeanPct: 73.5,
      eaKpa: 1.409,
      u2: 2.078,
      rsMj: 22.07,
      pressureKpa: 100.1,
    });
    expect(eto).toBeGreaterThan(3.75);
    expect(eto).toBeLessThan(4.05);
  });

  test("a mean-RH approximation stays close to the exact vapour pressure", () => {
    const common = { latDeg: 50.8, doy: 187, elevationM: 100, tmaxC: 21.5, tminC: 12.3, tmeanC: 16.9, u2: 2.078, rsMj: 22.07, pressureKpa: 100.1 };
    const exact = penmanMonteithEt0({ ...common, rhMeanPct: 73.5, eaKpa: 1.409 });
    const approx = penmanMonteithEt0({ ...common, rhMeanPct: 73.5 });
    expect(Math.abs(exact - approx)).toBeLessThan(0.3);
  });
});
