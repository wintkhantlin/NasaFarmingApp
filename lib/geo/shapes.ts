import type { FieldGeometry, LngLat } from "../types";

const EARTH_RADIUS_M = 6_378_137;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Area of one ring in square metres (Chamberlain-Duquette, as used by geojson-area). */
export function ringAreaM2(ring: LngLat[]): number {
  if (ring.length < 4) return 0;
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [lng1, lat1] = ring[i];
    const [lng2, lat2] = ring[i + 1];
    sum += toRad(lng2 - lng1) * (2 + Math.sin(toRad(lat1)) + Math.sin(toRad(lat2)));
  }
  return Math.abs((sum * EARTH_RADIUS_M * EARTH_RADIUS_M) / 2);
}

/** Area in hectares: outer ring minus holes. null for a pin. */
export function areaHa(geometry: FieldGeometry): number | null {
  if (geometry.type === "Point") return null;
  const [outer, ...holes] = geometry.coordinates;
  const m2 = ringAreaM2(outer) - holes.reduce((s, h) => s + ringAreaM2(h), 0);
  return Math.max(m2, 0) / 10_000;
}

export const acresFromHa = (ha: number) => ha * 2.471_053_8;

/** Area-weighted centroid of the outer ring, in degrees. Fine at field scale. */
export function centroid(geometry: FieldGeometry): LngLat {
  if (geometry.type === "Point") return geometry.coordinates;
  const ring = geometry.coordinates[0];
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[i + 1];
    const cross = x1 * y2 - x2 * y1;
    a += cross;
    cx += (x1 + x2) * cross;
    cy += (y1 + y2) * cross;
  }
  if (Math.abs(a) < 1e-12) {
    const pts = ring.slice(0, -1);
    return [
      pts.reduce((s, p) => s + p[0], 0) / pts.length,
      pts.reduce((s, p) => s + p[1], 0) / pts.length,
    ];
  }
  return [cx / (3 * a), cy / (3 * a)];
}

/** Ray-casting test against one ring. */
export function pointInRing(point: LngLat, ring: LngLat[]): boolean {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function pointInPolygon(point: LngLat, rings: LngLat[][]): boolean {
  const [outer, ...holes] = rings;
  return pointInRing(point, outer) && !holes.some((h) => pointInRing(point, h));
}

function orient(a: LngLat, b: LngLat, c: LngLat): number {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

function segmentsCross(p1: LngLat, p2: LngLat, p3: LngLat, p4: LngLat): boolean {
  const d1 = orient(p3, p4, p1);
  const d2 = orient(p3, p4, p2);
  const d3 = orient(p1, p2, p3);
  const d4 = orient(p1, p2, p4);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

/** True when two non-adjacent edges of the ring cross each other. */
export function isSelfIntersecting(ring: LngLat[]): boolean {
  const n = ring.length - 1; // closed ring: last point repeats the first
  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue; // first and last edges share a vertex
      if (segmentsCross(ring[i], ring[i + 1], ring[j], ring[j + 1])) return true;
    }
  }
  return false;
}

/**
 * Up to `max` points inside the field, spread out, for point-sampling
 * services. Starts at the centroid when it is inside, then adds the grid
 * point farthest from those already chosen.
 */
export function samplePoints(geometry: FieldGeometry, max = 5): LngLat[] {
  if (geometry.type === "Point") return [geometry.coordinates];
  const rings = geometry.coordinates;
  const xs = rings[0].map((p) => p[0]);
  const ys = rings[0].map((p) => p[1]);
  const [minX, maxX] = [Math.min(...xs), Math.max(...xs)];
  const [minY, maxY] = [Math.min(...ys), Math.max(...ys)];

  const candidates: LngLat[] = [];
  const steps = 6;
  for (let i = 0; i < steps; i++) {
    for (let j = 0; j < steps; j++) {
      const p: LngLat = [
        minX + ((i + 0.5) / steps) * (maxX - minX),
        minY + ((j + 0.5) / steps) * (maxY - minY),
      ];
      if (pointInPolygon(p, rings)) candidates.push(p);
    }
  }

  const c = centroid(geometry);
  const chosen: LngLat[] = pointInPolygon(c, rings) ? [c] : candidates.slice(0, 1);
  if (chosen.length === 0) return [c];

  const dist2 = (a: LngLat, b: LngLat) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
  while (chosen.length < max && candidates.length > 0) {
    let best: LngLat | null = null;
    let bestD = -1;
    for (const cand of candidates) {
      const d = Math.min(...chosen.map((p) => dist2(p, cand)));
      if (d > bestD) {
        bestD = d;
        best = cand;
      }
    }
    if (!best || bestD === 0) break;
    chosen.push(best);
  }
  return chosen;
}
