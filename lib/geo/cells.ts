import type { LngLat } from "../types";

/**
 * Data cells. Cache keys snap a coordinate to the grid of the dataset being
 * fetched, so two fields in the same cell share one request.
 */

export interface Box {
  west: number;
  south: number;
  east: number;
  north: number;
}

export type FootprintKind = "power" | "imerg" | "smap" | "modis";

const POWER_LAT_STEP = 0.5;
const POWER_LON_STEP = 0.625;
const M_PER_DEG_LAT = 111_320;

export function normaliseLon(lon: number): number {
  const wrapped = ((((lon + 180) % 360) + 360) % 360) - 180;
  return wrapped;
}

/** NASA POWER (MERRA-2) cell: 0.5 degrees of latitude by 0.625 of longitude. */
export function powerCell(lat: number, lon: number) {
  const cLat = Math.round(lat / POWER_LAT_STEP) * POWER_LAT_STEP;
  let cLon = Math.round(normaliseLon(lon) / POWER_LON_STEP) * POWER_LON_STEP;
  if (cLon >= 180) cLon -= 360;
  return {
    key: `power:${cLat.toFixed(1)}:${cLon.toFixed(3)}`,
    lat: cLat,
    lon: cLon,
  };
}

/** GPM IMERG cell: 0.1 degrees, indexed from the south-west corner of the globe. */
export function imergCell(lat: number, lon: number) {
  const iLat = Math.floor((lat + 90) * 10);
  const iLon = Math.floor((normaliseLon(lon) + 180) * 10);
  return {
    key: `imerg:${iLat}:${iLon}`,
    lat: iLat / 10 - 90 + 0.05,
    lon: iLon / 10 - 180 + 0.05,
  };
}

/**
 * Cache key for point-sampled products (SMAP, MODIS, SoilGrids). The point is
 * rounded, so the key is finer than the product's own cell and never merges
 * two cells. 3 decimals is about 110 m; 2 decimals is about 1.1 km.
 */
export function pointKey(prefix: string, lat: number, lon: number, decimals = 3): string {
  return `${prefix}:${lat.toFixed(decimals)}:${normaliseLon(lon).toFixed(decimals)}`;
}

/** Cell edge length in metres, for the footprints that are not degree grids. */
const FOOTPRINT_METRES: Record<"smap" | "modis", number> = {
  smap: 9_000,
  modis: 250,
};

/**
 * The box a satellite pixel covers around a point, for the "what each
 * satellite sees" map overlay. SMAP and MODIS pixels sit on their own
 * projected grids, so this is a box of the right size centred on the point,
 * not the exact pixel edges. The UI says "about".
 */
export function footprintBox(kind: FootprintKind, point: LngLat): Box {
  const [lng, lat] = point;
  if (kind === "power") {
    const c = powerCell(lat, lng);
    return {
      west: c.lon - POWER_LON_STEP / 2,
      east: c.lon + POWER_LON_STEP / 2,
      south: c.lat - POWER_LAT_STEP / 2,
      north: c.lat + POWER_LAT_STEP / 2,
    };
  }
  if (kind === "imerg") {
    const c = imergCell(lat, lng);
    return { west: c.lon - 0.05, east: c.lon + 0.05, south: c.lat - 0.05, north: c.lat + 0.05 };
  }
  const half = FOOTPRINT_METRES[kind] / 2;
  const dLat = half / M_PER_DEG_LAT;
  const cos = Math.max(Math.cos((lat * Math.PI) / 180), 0.01);
  const dLon = half / (M_PER_DEG_LAT * cos);
  return { west: lng - dLon, east: lng + dLon, south: lat - dLat, north: lat + dLat };
}
