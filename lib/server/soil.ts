import { pointKey } from "../geo/cells";
import { PROCESSING_VERSION } from "../evidence/indicator";
import { fetchSoilGrids, type SoilProfile } from "../soil/soilgrids";
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
export async function loadSoil(
  lat: number,
  lng: number,
  opts: { cache?: ServerCache; fetch?: typeof fetch; signal?: AbortSignal } = {},
): Promise<SoilResult> {
  const cache = opts.cache ?? serverCache();
  const key = cacheKey("soilgrids", PROCESSING_VERSION, pointKey("soil", lat, lng, 3));
  const hit = await cache.get<{ soil: SoilProfile | null; retrievedAt: string }>(key);
  if (hit) {
    return { soil: hit.soil, retrievedAt: hit.retrievedAt, error: null, cached: true };
  }

  try {
    const soil = await fetchSoilGrids(lat, lng, {
      fetch: opts.fetch,
      signal: opts.signal ?? AbortSignal.timeout(15_000),
    });
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
