import { pointKey } from "../geo/cells";
import { PROCESSING_VERSION } from "../evidence/indicator";
import { fetchPowerDaily, POWER_DAILY_PARAMS, type DailyWeather, type PowerParam } from "../nasa/power";
import { cacheKey, serverCache, type ServerCache } from "./cache";

/**
 * Server-side POWER daily history for a field. Requests the eight handoff parameters, plus GWETROOT
 * (modelled root-zone wetness, shown on Conditions as regional context), in UTC for
 * 2016 up to the end of last month, so the cache key is stable for a month. A failure is returned as
 * `null` with a message: the engine then reports weather as unknown instead of inventing it.
 */

export const WEATHER_START = "20160101";

export const WEATHER_PARAMS: readonly PowerParam[] = [...POWER_DAILY_PARAMS, "GWETROOT"];

export function weatherEnd(now = new Date()): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0)); // last day of previous month
  return d.toISOString().slice(0, 10).replaceAll("-", "");
}

export interface WeatherResult {
  weather: DailyWeather | null;
  retrievedAt: string | null;
  error: string | null;
  cached: boolean;
}

export async function loadWeather(
  lat: number,
  lng: number,
  opts: { cache?: ServerCache; fetch?: typeof fetch; now?: Date; signal?: AbortSignal } = {},
): Promise<WeatherResult> {
  const cache = opts.cache ?? serverCache();
  const end = weatherEnd(opts.now);
  const key = cacheKey("power-daily", PROCESSING_VERSION, WEATHER_PARAMS.join("+"), pointKey("pt", lat, lng, 3), WEATHER_START, end);
  const hit = await cache.get<{ weather: DailyWeather; retrievedAt: string }>(key);
  if (hit) return { weather: hit.weather, retrievedAt: hit.retrievedAt, error: null, cached: true };
  try {
    const weather = await fetchPowerDaily({ lat, lon: lng, start: WEATHER_START, end, parameters: WEATHER_PARAMS, timeStandard: "UTC" }, { fetch: opts.fetch, signal: opts.signal ?? AbortSignal.timeout(45_000) });
    const retrievedAt = new Date().toISOString();
    await cache.set(key, { weather, retrievedAt }, 60 * 60 * 24 * 7);
    return { weather, retrievedAt, error: null, cached: false };
  } catch (e) {
    return { weather: null, retrievedAt: null, error: e instanceof Error ? e.message : "NASA POWER could not be read.", cached: false };
  }
}
