import { pointKey } from "../geo/cells";
import { PROCESSING_VERSION } from "../evidence/indicator";
import { fetchSoilGrids, SOILGRIDS_SCHEMA, type SoilProfile } from "../soil/soilgrids";
import { cacheKey, serverCache, type ServerCache } from "./cache";

export interface SoilResult {
  soil: SoilProfile | null;
  retrievedAt: string | null;
  error: string | null;
  cached: boolean;
}

/**
 * Server-side SoilGrids loader with caching and error resilience.
 * Snaps coordinates to a ~110 m point key (3 decimals) and caches valid
 * profiles for 30 days. On network errors, reports error without crashing.
 */
/** One-property probe, about a second, to find a cell that has soil values before the full read. */
async function hasSoilValue(lat: number, lng: number, f: typeof fetch = fetch): Promise<boolean> {
  const url = `https://rest.isric.org/soilgrids/v2.0/properties/query?lon=${lng.toFixed(5)}&lat=${lat.toFixed(5)}&property=phh2o&depth=0-5cm&value=mean`;
  const res = await f(url, { signal: AbortSignal.timeout(6_000) });
  if (!res.ok) return false;
  const j = (await res.json()) as { properties?: { layers?: Array<{ depths?: Array<{ values?: { mean?: number | null } }> }> } };
  return j.properties?.layers?.[0]?.depths?.[0]?.values?.mean != null;
}

export async function loadSoil(
  lat: number,
  lng: number,
  opts: { cache?: ServerCache; fetch?: typeof fetch; signal?: AbortSignal } = {},
): Promise<SoilResult> {
  const cache = opts.cache ?? serverCache();
  const key = cacheKey("soilgrids", PROCESSING_VERSION, `${SOILGRIDS_SCHEMA}-near`, pointKey("soil", lat, lng, 3));
  const hit = await cache.get<{ soil: SoilProfile | null; retrievedAt: string }>(key);
  if (hit) {
    return { soil: hit.soil, retrievedAt: hit.retrievedAt, error: null, cached: true };
  }

  try {
    const read = (la: number, ln: number) =>
      fetchSoilGrids(la, ln, { fetch: opts.fetch, signal: opts.signal ?? AbortSignal.timeout(45_000) });
    let soil = await read(lat, lng);
    // A pin in a town, on a road or on water has no soil values. Use the closest cell that does,
    // searching outward in rings, and say how far away it was.
    if (!soil) {
      const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
      for (const step of [0.02, 0.06]) {
        const found = await Promise.all(
          DIRS.map(async ([dLat, dLng]) => {
            try {
              const la = lat + dLat * step;
              const ln = lng + dLng * step;
              return (await hasSoilValue(la, ln, opts.fetch)) ? { la, ln } : null;
            } catch {
              return null;
            }
          }),
        );
        const hit = found.find((p) => p);
        if (hit) {
          const km = Math.max(1, Math.round(step * 111 * Math.hypot(...(DIRS[found.indexOf(hit)] as [number, number]))));
          const near = await read(hit.la, hit.ln);
          if (!near) continue;
          soil = { ...near, source: { ...near.source, resolution: `${near.source.resolution}, nearest cell with data (about ${km} km away)` } };
          break;
        }
      }
    }
    const retrievedAt = new Date().toISOString();
    // Cache valid or null profiles for 30 days
    await cache.set(key, { soil, retrievedAt }, 60 * 60 * 24 * 30);
    return { soil, retrievedAt, error: null, cached: false };
  } catch (e) {
    return {
      soil: null,
      retrievedAt: null,
      error: e instanceof Error ? e.message : "SoilGrids could not be read.",
      cached: false,
    };
  }
}
