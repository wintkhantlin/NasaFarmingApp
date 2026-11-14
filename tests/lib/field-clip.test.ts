import { describe, expect, test, vi } from "vitest";
import { toUtm, utmZoneFromEpsg } from "../../lib/geo/utm";
import type { FieldGeometry, LngLat } from "../../lib/types";

/**
 * A fake UTM 46N tile, 30 m pixels, for `readCogWindow`. Pixel values are their own index in the
 * whole tile, so a test can tell exactly which pixels were read.
 */
const TILE = { minX: 690_000, maxY: 2_230_020, width: 1000, height: 1000, res: 30 };
let geoKeys: Record<string, unknown> = { GTModelTypeGeoKey: 1, ProjectedCSTypeGeoKey: 32646 };

vi.mock("geotiff", () => ({
  fromUrl: async () => ({
    getImage: async () => ({
      getGeoKeys: () => geoKeys,
      getBoundingBox: () => [TILE.minX, TILE.maxY - TILE.height * TILE.res, TILE.minX + TILE.width * TILE.res, TILE.maxY],
      getWidth: () => TILE.width,
      getHeight: () => TILE.height,
      readRasters: async ({ window: [l, t, r, b] }: { window: [number, number, number, number] }) => {
        const out: number[] = [];
        for (let row = t; row < b; row++) for (let col = l; col < r; col++) out.push(row * TILE.width + col);
        return [out];
      },
    }),
  }),
}));

const { readCogWindow, projectorFor, fieldRings } = await import("../../lib/nasa/planetary-computer");

describe("WGS84 to UTM", () => {
  // Reference values from PROJ 9 (pyproj Transformer EPSG:4326 -> EPSG:326xx/327xx).
  const cases: Array<[number, LngLat, [number, number]]> = [
    [32646, [93, 20], [500_000, 2_211_481.308]],
    [32646, [94.91, 20.11], [699_685.266, 2_224_798.64]],
    [32646, [96.5, 16.8], [873_138.847, 1_860_727.26]],
    [32647, [97.3, 21.0], [323_301.618, 2_323_087.246]],
    [32733, [15.0, -10.0], [500_000, 8_894_587.509]],
  ];
  test.each(cases)("EPSG:%i %j matches PROJ to within 0.1 m", (epsg, p, [e, n]) => {
    const [x, y] = toUtm(p, utmZoneFromEpsg(epsg)!);
    expect(Math.abs(x - e)).toBeLessThan(0.1);
    expect(Math.abs(y - n)).toBeLessThan(0.1);
  });

  test("only WGS84 UTM codes are recognised as UTM", () => {
    expect(utmZoneFromEpsg(32646)).toEqual({ zone: 46, south: false });
    expect(utmZoneFromEpsg(32733)).toEqual({ zone: 33, south: true });
    expect(utmZoneFromEpsg(4326)).toBeNull();
    expect(utmZoneFromEpsg(3857)).toBeNull();
  });
});

describe("Raster CRS handling", () => {
  test("a UTM tile gets projected coordinates, a WGS84 tile gets degrees", () => {
    expect(projectorFor({ GTModelTypeGeoKey: 1, ProjectedCSTypeGeoKey: 32646 })([93, 20])[0]).toBeCloseTo(500_000, 3);
    expect(projectorFor({ GTModelTypeGeoKey: 2, GeographicTypeGeoKey: 4326 })([93, 20])).toEqual([93, 20]);
  });

  test("an unknown projection is refused, not compared as degrees", () => {
    expect(() => projectorFor({ GTModelTypeGeoKey: 1, ProjectedCSTypeGeoKey: 32767, GTCitationGeoKey: "Sinusoidal" })).toThrow(/Unsupported raster CRS/);
  });

  test("a point becomes its padded box", () => {
    const [ring] = fieldRings({ type: "Point", coordinates: [95, 20] });
    expect(ring).toHaveLength(5);
    expect(ring[0]).toEqual([94.995, 19.995]);
  });
});

describe("readCogWindow clips to the field", () => {
  geoKeys = { GTModelTypeGeoKey: 1, ProjectedCSTypeGeoKey: 32646 };
  // An L-shaped field around 94.91 E, 20.11 N, roughly 300 m across.
  const L: LngLat[] = [
    [94.909, 20.109],
    [94.912, 20.109],
    [94.912, 20.1101],
    [94.9101, 20.1101],
    [94.9101, 20.112],
    [94.909, 20.112],
    [94.909, 20.109],
  ];
  const field: FieldGeometry = { type: "Polygon", coordinates: [L] };

  test("reads the field's own UTM window, not a corner of the scene", async () => {
    const w = await readCogWindow("https://example.test/red.tif", field);
    expect(w.width).toBeGreaterThan(5);
    expect(w.width).toBeLessThan(20);
    // Every pixel read sits near the field's projected position, not at tile index 0.
    const [fx, fy] = toUtm([94.91, 20.11], { zone: 46, south: false });
    const col = Math.floor((fx - TILE.minX) / TILE.res);
    const row = Math.floor((TILE.maxY - fy) / TILE.res);
    for (const v of w.values) {
      expect(Math.abs((v % TILE.width) - col)).toBeLessThan(20);
      expect(Math.abs(Math.floor(v / TILE.width) - row)).toBeLessThan(20);
    }
  });

  test("pixels in the notch of the L are outside the field", async () => {
    const w = await readCogWindow("https://example.test/red.tif", field);
    const inside = w.inside.filter(Boolean).length;
    expect(inside).toBeGreaterThan(0);
    expect(inside).toBeLessThan(w.values.length * 0.75);
    // The top-right corner of the window is in the notch.
    expect(w.inside[w.width - 1]).toBe(false);
    // The bottom-left corner pixel is inside the L.
    expect(w.inside[(w.height - 2) * w.width + 1]).toBe(true);
  });

  test("a field off the tile returns no pixels", async () => {
    const far: FieldGeometry = { type: "Polygon", coordinates: [[[96.5, 16.8], [96.501, 16.8], [96.501, 16.801], [96.5, 16.8]]] };
    const w = await readCogWindow("https://example.test/red.tif", far);
    expect(w).toEqual({ width: 0, height: 0, values: [], inside: [] });
  });
});

describe("Vegetation provenance follows the provider", async () => {
  const { hlsIndicator } = await import("../../lib/engine/provenance");
  const { engineData, syntheticField } = await import("../helpers/synthetic");
  const field = syntheticField();
  const indicator = (provider: "planetary-computer" | "appeears") =>
    hlsIndicator({
      data: engineData(field, null, { hlsInfo: { status: "ok", provider, retrievedAt: "2026-11-14T00:00:00Z", start: "2021-01-01", end: "2025-12-31" } }),
      name: "Clear satellite observations of the field",
      value: 12,
      units: "clear observations",
      statistic: "count",
      start: "2021-01-01",
      end: "2025-12-31",
    });

  test("Planetary Computer data is labelled Landsat Collection 2 with QA_PIXEL, not HLS", () => {
    const i = indicator("planetary-computer");
    expect(i.product).toMatch(/Landsat Collection 2 Level-2/);
    expect(i.product).not.toMatch(/HLS/);
    expect(i.qaPolicy).toMatch(/QA_PIXEL/);
    expect(i.qaPolicy).toMatch(/inside the field outline/);
    expect(i.doi).toBeNull();
    expect(i.value).toBe(12);
  });

  test("AppEEARS data keeps the HLS label", () => {
    const i = indicator("appeears");
    expect(i.product).toMatch(/HLSL30/);
    expect(i.qaPolicy).not.toMatch(/QA_PIXEL/);
  });
});
