import { describe, expect, test } from "vitest";
import { footprintBox, imergCell, pointKey, powerCell } from "../../lib/geo/cells";
import {
  areaHa,
  centroid,
  isSelfIntersecting,
  pointInPolygon,
  samplePoints,
} from "../../lib/geo/shapes";
import type { FieldGeometry, LngLat } from "../../lib/types";

const square = (lng: number, lat: number, size: number): LngLat[] => [
  [lng, lat],
  [lng + size, lat],
  [lng + size, lat + size],
  [lng, lat + size],
  [lng, lat],
];

describe("data cells", () => {
  test("POWER cell snaps to 0.5 by 0.625 degrees", () => {
    const c = powerCell(42.03, -93.62);
    expect(c.lat).toBe(42);
    expect(c.lon).toBe(-93.75);
    expect(c.key).toBe("power:42.0:-93.750");
  });

  test("two fields a few km apart share a POWER cell key", () => {
    expect(powerCell(42.03, -93.62).key).toBe(powerCell(42.1, -93.7).key);
  });

  test("longitude wraps at the antimeridian", () => {
    // 180.1 is -179.9, which is nearest the grid centre at -180.
    expect(powerCell(10, 180.1).lon).toBe(-180);
    expect(powerCell(10, -180).lon).toBe(-180);
    // The last centre before the seam is 179.375.
    expect(powerCell(10, 179.5).lon).toBeCloseTo(179.375, 6);
  });

  test("IMERG cell is 0.1 degrees with a centre at x.x5", () => {
    const c = imergCell(42.03, -93.62);
    expect(c.lat).toBeCloseTo(42.05, 6);
    expect(c.lon).toBeCloseTo(-93.65, 6);
  });

  test("point keys round to the requested decimals", () => {
    expect(pointKey("soil", 42.03456, -93.62987)).toBe("soil:42.035:-93.630");
    expect(pointKey("smap", 42.03456, -93.62987, 2)).toBe("smap:42.03:-93.63");
  });

  test("footprint boxes have the right size and contain the point", () => {
    const pt: LngLat = [-93.62, 42.03];
    const modis = footprintBox("modis", pt);
    const heightM = (modis.north - modis.south) * 111_320;
    expect(heightM).toBeGreaterThan(245);
    expect(heightM).toBeLessThan(255);
    const smap = footprintBox("smap", pt);
    expect((smap.north - smap.south) * 111_320).toBeCloseTo(9000, -1);
    for (const kind of ["power", "imerg", "smap", "modis"] as const) {
      const b = footprintBox(kind, pt);
      expect(b.west).toBeLessThan(pt[0]);
      expect(b.east).toBeGreaterThan(pt[0]);
      expect(b.south).toBeLessThan(pt[1]);
      expect(b.north).toBeGreaterThan(pt[1]);
    }
  });
});

describe("field shapes", () => {
  test("a 0.009 degree square at the equator is about 100 ha", () => {
    const g: FieldGeometry = { type: "Polygon", coordinates: [square(10, 0, 0.009)] };
    const ha = areaHa(g);
    expect(ha).not.toBeNull();
    expect(ha!).toBeGreaterThan(99);
    expect(ha!).toBeLessThan(101.5);
  });

  test("a pin has no area", () => {
    expect(areaHa({ type: "Point", coordinates: [10, 10] })).toBeNull();
  });

  test("a hole is subtracted from the area", () => {
    const outer = square(10, 0, 0.01);
    const hole = square(10.002, 0.002, 0.004);
    const full = areaHa({ type: "Polygon", coordinates: [outer] })!;
    const holed = areaHa({ type: "Polygon", coordinates: [outer, hole] })!;
    expect(holed).toBeLessThan(full * 0.9);
  });

  test("centroid of a square is its middle", () => {
    const c = centroid({ type: "Polygon", coordinates: [square(10, 20, 0.01)] });
    expect(c[0]).toBeCloseTo(10.005, 6);
    expect(c[1]).toBeCloseTo(20.005, 6);
  });

  test("detects a bow-tie but not a square", () => {
    const bowtie: LngLat[] = [
      [0, 0],
      [1, 1],
      [1, 0],
      [0, 1],
      [0, 0],
    ];
    expect(isSelfIntersecting(bowtie)).toBe(true);
    expect(isSelfIntersecting(square(0, 0, 1))).toBe(false);
  });

  test("sample points all fall inside, even for an L-shaped field", () => {
    const L: LngLat[] = [
      [0, 0],
      [0.01, 0],
      [0.01, 0.003],
      [0.003, 0.003],
      [0.003, 0.01],
      [0, 0.01],
      [0, 0],
    ];
    const g: FieldGeometry = { type: "Polygon", coordinates: [L] };
    const pts = samplePoints(g, 5);
    expect(pts.length).toBeGreaterThan(1);
    expect(pts.length).toBeLessThanOrEqual(5);
    for (const p of pts) expect(pointInPolygon(p, g.coordinates)).toBe(true);
  });

  test("a pin returns itself as the only sample point", () => {
    expect(samplePoints({ type: "Point", coordinates: [5, 6] })).toEqual([[5, 6]]);
  });
});
