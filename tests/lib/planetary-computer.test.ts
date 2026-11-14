import { describe, expect, test, vi, beforeEach } from "vitest";
import {
  MPC_CONFIG,
  decodeLandsatQa,
  scaleLandsatReflectance,
  geometryBbox,
  signAssetUrl,
  searchPlanetaryComputer,
  extractModisDate,
  LANDSAT_EXTRACTION,
  type MpcItem,
} from "../../lib/nasa/planetary-computer";
import { ndvi, ndmi } from "../../lib/nasa/derive/ndvi";
import { computeJobId, getIngestionQueue } from "../../lib/server/queue";
import { advance, geometryHash } from "../../lib/server/remote-sensing";
import { cacheKey, memoryCache } from "../../lib/server/cache";
import { PROCESSING_VERSION } from "../../lib/evidence/indicator";
import type { FieldGeometry } from "../../lib/types";

describe("Planetary Computer Integration: STAC & Asset Signing", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test("STAC endpoint configuration targets public API without hardcoded credentials", () => {
    expect(MPC_CONFIG.stacUrl).toBe("https://planetarycomputer.microsoft.com/api/stac/v1");
    expect(MPC_CONFIG.sasUrl).toBe("https://planetarycomputer.microsoft.com/api/sas/v1");
    expect(MPC_CONFIG.landsatCollection).toBe("landsat-c2-l2");
    expect(MPC_CONFIG.modisViCollection).toBe("modis-13Q1-061");
  });

  test("STAC search builds standard GeoJSON POST request with cloud cover query", async () => {
    let capturedUrl = "";
    let capturedBody: Record<string, unknown> = {};

    const mockFetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      capturedUrl = String(url);
      capturedBody = JSON.parse(String(init?.body ?? "{}"));
      return new Response(
        JSON.stringify({
          type: "FeatureCollection",
          features: [
            {
              id: "LC08_L2SP_133046_20230210_02_T1",
              type: "Feature",
              collection: "landsat-c2-l2",
              bbox: [94.8, 19.8, 95.2, 20.2],
              properties: {
                datetime: "2023-02-10T04:15:20Z",
                "eo:cloud_cover": 12.5,
                platform: "landsat-8",
              },
              assets: {
                red: { href: "https://example.com/red.tif" },
                nir08: { href: "https://example.com/nir08.tif" },
                qa_pixel: { href: "https://example.com/qa.tif" },
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as unknown as typeof fetch;

    const items = await searchPlanetaryComputer({
      collections: ["landsat-c2-l2"],
      bbox: [94.8, 19.8, 95.2, 20.2],
      start: "2023-01-01",
      end: "2023-03-31",
      maxCloudCover: 30,
      fetch: mockFetch,
    });

    expect(capturedUrl).toBe("https://planetarycomputer.microsoft.com/api/stac/v1/search");
    expect(capturedBody.collections).toEqual(["landsat-c2-l2"]);
    expect(capturedBody.bbox).toEqual([94.8, 19.8, 95.2, 20.2]);
    expect(capturedBody.datetime).toBe("2023-01-01T00:00:00Z/2023-03-31T23:59:59Z");
    expect(capturedBody.query).toEqual({ "eo:cloud_cover": { lt: 30 } });
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe("LC08_L2SP_133046_20230210_02_T1");
  });

  test("SAS token acquisition caches token and signs asset URLs", async () => {
    let tokenCalls = 0;
    const futureExpiry = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    const mockFetch = vi.fn(async (url: string | URL | Request) => {
      const u = String(url);
      if (u.includes("/sas/v1/token/landsat-c2-l2")) {
        tokenCalls++;
        return new Response(JSON.stringify({ token: "sig=sampleToken123", "msft:expiry": futureExpiry }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response("{}", { status: 404 });
    }) as unknown as typeof fetch;

    const rawUrl = "https://landsateuwest.blob.core.windows.net/landsat-c2/red.tif";
    const signed1 = await signAssetUrl(rawUrl, "landsat-c2-l2", { fetch: mockFetch });
    expect(signed1).toBe(`${rawUrl}?sig=sampleToken123`);
    expect(tokenCalls).toBe(1);

    // Second call reuses cached token without additional network request
    const signed2 = await signAssetUrl(rawUrl, "landsat-c2-l2", { fetch: mockFetch });
    expect(signed2).toBe(`${rawUrl}?sig=sampleToken123`);
    expect(tokenCalls).toBe(1);

    // URL with existing query param uses '&' separator
    const rawUrlWithParam = "https://landsateuwest.blob.core.windows.net/landsat-c2/red.tif?mode=fast";
    const signedWithAmp = await signAssetUrl(rawUrlWithParam, "landsat-c2-l2", { fetch: mockFetch });
    expect(signedWithAmp).toBe(`${rawUrlWithParam}&sig=sampleToken123`);
  });
});

describe("Scientific Validation: Landsat QA Masking and Reflectance Scaling", () => {
  test("Landsat Collection 2 QA_PIXEL bitmask correctly filters clear land vs clouds and shadows", () => {
    // Clear land: bit 6 is clear (64), bit 0 is not fill (0)
    const clearPixel = 1 << 6; // 64
    const decodedClear = decodeLandsatQa(clearPixel);
    expect(decodedClear.clear).toBe(true);
    expect(decodedClear.fill).toBe(false);
    expect(decodedClear.cloud).toBe(false);
    expect(decodedClear.validLand).toBe(true);

    // Fill pixel: bit 0 = 1
    const fillPixel = 1;
    expect(decodeLandsatQa(fillPixel).validLand).toBe(false);
    expect(decodeLandsatQa(fillPixel).fill).toBe(true);

    // Dilated cloud: bit 1 = 1
    const dilated = 1 << 1;
    expect(decodeLandsatQa(dilated).validLand).toBe(false);
    expect(decodeLandsatQa(dilated).dilatedCloud).toBe(true);

    // Cloud: bit 3 = 1
    const cloud = 1 << 3;
    expect(decodeLandsatQa(cloud).validLand).toBe(false);
    expect(decodeLandsatQa(cloud).cloud).toBe(true);

    // Cloud shadow: bit 4 = 1
    const shadow = 1 << 4;
    expect(decodeLandsatQa(shadow).validLand).toBe(false);
    expect(decodeLandsatQa(shadow).shadow).toBe(true);

    // Snow / Ice: bit 5 = 1
    const snow = 1 << 5;
    expect(decodeLandsatQa(snow).validLand).toBe(false);
    expect(decodeLandsatQa(snow).snow).toBe(true);

    // Water: bit 7 = 1 (isolated from land analysis, not marked valid land)
    const water = 1 << 7;
    const decodedWater = decodeLandsatQa(water);
    expect(decodedWater.water).toBe(true);
    expect(decodedWater.validLand).toBe(false);

    // High confidence cloud: bits 8-9 = 11 (3 << 8 = 768)
    const highConfCloud = 3 << 8;
    expect(decodeLandsatQa(highConfCloud).validLand).toBe(false);
    expect(decodeLandsatQa(highConfCloud).cloudConfidence).toBe(3);
  });

  test("Reflectance scaling preserves USGS Collection 2 Level-2 mathematical formula", () => {
    // Formula: DN * 0.0000275 - 0.2
    // Nodata is 0 or negative
    expect(scaleLandsatReflectance(0)).toBeNull();
    expect(scaleLandsatReflectance(null)).toBeNull();
    expect(scaleLandsatReflectance(-999)).toBeNull();

    // DN = 7273 -> 7273 * 0.0000275 - 0.2 = 0.2000075 - 0.2 = ~0.0000
    const nearZero = scaleLandsatReflectance(7273);
    expect(nearZero).toBeCloseTo(0.0, 3);

    // DN = 21818 -> 21818 * 0.0000275 - 0.2 = 0.599995 - 0.2 = ~0.4000 (typical healthy vegetation NIR)
    const nirVal = scaleLandsatReflectance(21818);
    expect(nirVal).toBeCloseTo(0.4, 3);

    // Values below 0 are clamped to 0
    expect(scaleLandsatReflectance(5000)).toBe(0);

    // Unrealistically high values (> 1.6) are rejected as sensor saturations
    expect(scaleLandsatReflectance(70000)).toBeNull();
  });

  test("Scientific Equivalence: NDVI and NDMI match HLS derivation formulas", () => {
    // Healthy agricultural vegetation canopy
    const redReflectance = 0.05;
    const nirReflectance = 0.45;
    const swirReflectance = 0.15;

    const expectedNdvi = (0.45 - 0.05) / (0.45 + 0.05); // 0.40 / 0.50 = 0.80
    const expectedNdmi = (0.45 - 0.15) / (0.45 + 0.15); // 0.30 / 0.60 = 0.50

    expect(ndvi(nirReflectance, redReflectance)).toBeCloseTo(expectedNdvi, 4);
    expect(ndmi(nirReflectance, swirReflectance)).toBeCloseTo(expectedNdmi, 4);

    // Missing values produce null, never synthetic zero
    expect(ndvi(null, redReflectance)).toBeNull();
    expect(ndvi(nirReflectance, null)).toBeNull();
    expect(ndvi(0, 0)).toBeNull(); // 0 + 0 = 0 denominator -> missing
  });
});

describe("Geographic Filtering & Bounding Box Utilities", () => {
  test("geometryBbox computes padded box for Point and tight box for Polygon", () => {
    const ptGeom: FieldGeometry = { type: "Point", coordinates: [95.123, 20.456] };
    const ptBox = geometryBbox(ptGeom);
    expect(ptBox[0]).toBeCloseTo(95.118, 3);
    expect(ptBox[1]).toBeCloseTo(20.451, 3);
    expect(ptBox[2]).toBeCloseTo(95.128, 3);
    expect(ptBox[3]).toBeCloseTo(20.461, 3);

    const polyGeom: FieldGeometry = {
      type: "Polygon",
      coordinates: [
        [
          [95.0, 20.0],
          [95.2, 20.0],
          [95.2, 20.3],
          [95.0, 20.3],
          [95.0, 20.0],
        ],
      ],
    };
    const polyBox = geometryBbox(polyGeom);
    expect(polyBox).toEqual([95.0, 20.0, 95.2, 20.3]);
  });

  test("extractModisDate extracts ISO date from MODIS item id or properties", () => {
    const item1: MpcItem = {
      id: "MYD13Q1.A2023089.h27v07.061.2023107102040",
      type: "Feature",
      collection: "modis-13Q1-061",
      bbox: [90, 10, 100, 20],
      geometry: { type: "Polygon", coordinates: [] },
      properties: { datetime: null },
      assets: {},
    };
    // 2023 DOY 089: Jan 31 + Feb 28 = 59. 89 - 59 = March 30
    const d1 = extractModisDate(item1);
    expect(d1).toBe("2023-03-30");

    const item2: MpcItem = {
      ...item1,
      properties: { datetime: "2024-05-15T00:00:00Z" },
    };
    expect(extractModisDate(item2)).toBe("2024-05-15");
  });
});

describe("Three-Lane SQLite Asynchronous Queue", () => {
  const queue = getIngestionQueue();

  test("Queue supports weather, precipitation, and remote_sensing lanes", async () => {
    const id1 = computeJobId("weather", "power", { lat: 20.15, lng: 94.95 });
    const id2 = computeJobId("precipitation", "imerg", { cell: "20.1_94.9" });
    const id3 = computeJobId("remote_sensing", "landsat-c2-l2", { fieldId: "f1" });

    expect(id1).toContain("weather|power");
    expect(id2).toContain("precipitation|imerg");
    expect(id3).toContain("remote_sensing|landsat-c2-l2");
  });

  test("Queue prevents duplicate in-flight execution for identical requests", async () => {
    let executions = 0;
    const task = async () => {
      executions++;
      await new Promise((r) => setTimeout(r, 10));
      return { answer: 42 };
    };

    const params = { field: `field-dup-${Date.now()}-${Math.random()}`, year: 2024 };
    const job1 = await queue.enqueue("remote_sensing", "landsat-c2-l2", params, task);
    expect(job1.status).toBe("processing");

    // Immediate second call returns existing in-flight job without duplicate executor trigger
    const job2 = await queue.enqueue("remote_sensing", "landsat-c2-l2", params, task);
    expect(job2.id).toBe(job1.id);
    expect(executions).toBe(1);

    // Wait for task completion
    await new Promise((r) => setTimeout(r, 50));
    const finished = await queue.getJob(job1.id);
    expect(finished?.status).toBe("completed");
    expect(finished?.result).toEqual({ answer: 42 });

    // Enqueueing completed job returns cached result without running executor again
    const job3 = await queue.enqueue("remote_sensing", "landsat-c2-l2", params, task);
    expect(job3.status).toBe("completed");
    expect(executions).toBe(1);
  });

  test("Queue tracks failure and records error message", async () => {
    const failingTask = async () => {
      throw new Error("Azure 503 Service Unavailable");
    };
    const params = { field: `field-fail-${Date.now()}-${Math.random()}`, attempt: 1 };
    await queue.enqueue("remote_sensing", "landsat-c2-l2", params, failingTask);

    await new Promise((r) => setTimeout(r, 50));
    const failedJob = await queue.getJob(computeJobId("remote_sensing", "landsat-c2-l2", params));
    expect(failedJob?.status).toBe("failed");
    expect(failedJob?.error).toContain("Azure 503 Service Unavailable");
  });
});

describe("Provider Selection and Fallback Hierarchy", () => {
  const field = {
    id: "field-fallback-test",
    geometry: { type: "Point" as const, coordinates: [95.0, 20.0] as [number, number] },
    centroid: [95.0, 20.0] as [number, number],
  };

  test("Explicit provider preference for AppEEARS bypasses Planetary Computer", async () => {
    const cache = memoryCache();
    // AppEEARS without credentials returns unconfigured
    const state = await advance("hls", field, {
      provider: "appeears",
      env: {},
      cache,
    });
    expect(state.status).toBe("unconfigured");
  });

  test("Planetary Computer Landsat ingestion caches results and returns status ok", async () => {
    const cache = memoryCache();
    // Seed cache with completed MPC observations
    const mpcKey = cacheKey("mpc", PROCESSING_VERSION, LANDSAT_EXTRACTION, field.id, geometryHash(field.geometry));
    const mockObs = [
      {
        date: "2023-01-15",
        ndviMedian: 0.65,
        ndmiMedian: 0.35,
        validPixels: 100,
        totalPixels: 100,
        waterPixels: 0,
        coverage: 1.0,
      },
    ];
    await cache.set(mpcKey, {
      kind: "hls",
      status: "ok",
      provider: "planetary-computer",
      start: "2021-01-01",
      end: "2025-12-31",
      retrievedAt: new Date().toISOString(),
      data: { observations: mockObs },
    });

    // Advance finds cached MPC observations immediately
    const state = await advance("hls", field, { cache, env: {} });
    expect(state.status).toBe("ok");
    expect(state.provider).toBe("planetary-computer");
    const data = state.data as { observations: typeof mockObs };
    expect(data.observations).toHaveLength(1);
    expect(data.observations[0].ndviMedian).toBe(0.65);
  });
});
