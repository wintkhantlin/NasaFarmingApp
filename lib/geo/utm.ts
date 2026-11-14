import type { LngLat } from "../types";

/**
 * WGS84 longitude/latitude to UTM easting/northing (metres), so a field outline can be laid over a
 * satellite tile stored in UTM (Landsat Collection 2, HLS, Sentinel-2). Transverse Mercator series
 * from Snyder (1987), "Map Projections: A Working Manual", USGS PP 1395, eqs. 8-9 to 8-10; sub-metre
 * inside a zone, which is far below a 30 m pixel.
 */

const A = 6_378_137;
const F = 1 / 298.257_223_563;
const E2 = F * (2 - F);
const EP2 = E2 / (1 - E2);
const K0 = 0.9996;
const RAD = Math.PI / 180;

export interface UtmZone {
  zone: number;
  south: boolean;
}

/** UTM zone from an EPSG code: 326xx is WGS84 / UTM north, 327xx south. Anything else is null. */
export function utmZoneFromEpsg(epsg: number): UtmZone | null {
  if (epsg >= 32601 && epsg <= 32660) return { zone: epsg - 32600, south: false };
  if (epsg >= 32701 && epsg <= 32760) return { zone: epsg - 32700, south: true };
  return null;
}

/** Projects one point into the given UTM zone. Works a few degrees outside the zone too. */
export function toUtm([lon, lat]: LngLat, { zone, south }: UtmZone): [easting: number, northing: number] {
  const lon0 = ((zone - 1) * 6 - 180 + 3) * RAD;
  const phi = lat * RAD;
  const sin = Math.sin(phi);
  const cos = Math.cos(phi);
  const tan = Math.tan(phi);
  const n = A / Math.sqrt(1 - E2 * sin * sin);
  const t = tan * tan;
  const c = EP2 * cos * cos;
  const a = cos * (lon * RAD - lon0);
  const e4 = E2 * E2;
  const e6 = e4 * E2;
  const m =
    A *
    ((1 - E2 / 4 - (3 * e4) / 64 - (5 * e6) / 256) * phi -
      ((3 * E2) / 8 + (3 * e4) / 32 + (45 * e6) / 1024) * Math.sin(2 * phi) +
      ((15 * e4) / 256 + (45 * e6) / 1024) * Math.sin(4 * phi) -
      ((35 * e6) / 3072) * Math.sin(6 * phi));
  const easting =
    K0 * n * (a + ((1 - t + c) * a ** 3) / 6 + ((5 - 18 * t + t * t + 72 * c - 58 * EP2) * a ** 5) / 120) + 500_000;
  const northing =
    K0 *
      (m +
        n *
          tan *
          ((a * a) / 2 + ((5 - t + 9 * c + 4 * c * c) * a ** 4) / 24 + ((61 - 58 * t + t * t + 600 * c - 330 * EP2) * a ** 6) / 720)) +
    (south ? 10_000_000 : 0);
  return [easting, northing];
}
