import { imergCell } from "../geo/cells";
import { PROCESSING_VERSION } from "../evidence/indicator";
import { earthdataConfigured, type Env } from "../nasa/earthdata";
import { discoverGranules, fetchImergCell, pool, type ImergDay, type ImergGranule } from "../nasa/imerg";
import { cacheKey, serverCache, type ServerCache } from "./cache";

/**
 * Per-cell IMERG daily backfill. Each call fetches at most `batch` missing days (so a request stays
 * short), stores them per cell and year, and reports how much of the period is covered. The engine
 * uses IMERG only once coverage is high enough; until then rainfall is NASA POWER and says so. Days that the
 * archive does not publish are never fetched and are not waited for.
 */

export interface ImergProgress {
  status: "unconfigured" | "pending" | "ok" | "unavailable";
  days: ImergDay[];
  expected: number;
  covered: number;
  partialDays: number;
  granules: number;
  error: string | null;
}

const isoDays = (start: string, end: string) => {
  const out: string[] = [];
  for (let t = Date.parse(start); t <= Date.parse(end); t += 86_400_000) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
};

export async function imergBackfill(
  lat: number,
  lng: number,
  period: { start: string; end: string },
  opts: { cache?: ServerCache; fetch?: typeof fetch; env?: Env; batch?: number; concurrency?: number } = {},
): Promise<ImergProgress> {
  const env = opts.env ?? process.env;
  const dates = isoDays(period.start, period.end);
  const empty = (status: ImergProgress["status"], error: string | null = null): ImergProgress => ({ status, days: [], expected: dates.length, covered: 0, partialDays: 0, granules: 0, error });
  if (!earthdataConfigured("imerg", env)) return empty("unconfigured");

  const cache = opts.cache ?? serverCache();
  const cell = imergCell(lat, lng);
  const yearKey = (y: number) => cacheKey("imerg-year", PROCESSING_VERSION, cell.key, y);
  const years = [...new Set(dates.map((d) => Number(d.slice(0, 4))))];
  const stored = new Map<string, ImergDay>();
  for (const y of years) for (const d of (await cache.get<ImergDay[]>(yearKey(y))) ?? []) stored.set(d.date, d);

  const missing = dates.filter((d) => !stored.has(d));
  let granules: ImergGranule[] = [];
  /** Days the archive actually lists, once discovery has succeeded. Null until then. */
  let published: Set<string> | null = null;
  let error: string | null = null;
  if (missing.length > 0) {
    try {
      const gKey = cacheKey("imerg-granules", PROCESSING_VERSION, period.start, period.end);
      const cachedG = await cache.get<ImergGranule[]>(gKey);
      granules = cachedG ?? (await discoverGranules({ start: `${period.start}T00:00:00Z`, end: `${period.end}T23:59:59Z` }, { fetch: opts.fetch }));
      if (!cachedG) await cache.set(gKey, granules, 60 * 60 * 12);
      const byDate = new Map(granules.map((g) => [g.date, g]));
      published = new Set(byDate.keys());
      const todo = missing.map((d) => byDate.get(d)).filter((g): g is ImergGranule => Boolean(g)).slice(0, opts.batch ?? 120);
      const results = await pool(todo, opts.concurrency ?? 8, (g) => fetchImergCell(g, lat, lng, { fetch: opts.fetch, env }));
      let ok = 0;
      for (const r of results) {
        if (r instanceof Error) error = r.message;
        else {
          stored.set(r.date, r);
          ok++;
        }
      }
      if (ok > 0) {
        for (const y of years) await cache.set(yearKey(y), [...stored.values()].filter((d) => d.date.startsWith(`${y}-`)));
      }
      if (todo.length > 0 && ok === 0) return { ...empty("unavailable", error), granules: granules.length };
    } catch (e) {
      error = e instanceof Error ? e.message : "IMERG discovery failed.";
      return empty("unavailable", error);
    }
  }
  const days = [...stored.values()].sort((a, b) => a.date.localeCompare(b.date));
  const covered = days.filter((d) => d.precipMm !== null).length;
  return {
    // A day the archive does not list (Final V07 stops in September 2025) can never be fetched, so it must not keep
    // the job pending for ever. It stays out of `covered`, and `expected` is unchanged, so the shortfall is shown.
    status: dates.every((d) => stored.has(d) || (published !== null && !published.has(d))) ? "ok" : "pending",
    days,
    expected: dates.length,
    covered,
    partialDays: days.filter((d) => d.partialSampling).length,
    granules: granules.length,
    error,
  };
}
