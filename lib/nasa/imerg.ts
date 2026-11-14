import { imergCell } from "../geo/cells";
import { fetchWithRetry } from "../network/fetch-with-retry";
import { imergToken, SourceUnconfiguredError, type Env } from "./earthdata";

/**
 * GPM IMERG Final daily, version 07 (GPM_3IMERGDF). https://doi.org/10.5067/GPM/IMERGDF/DAY/07
 *
 * Discovery uses the public CMR granule search. Values come from one 0.1 degree cell per day via
 * OPeNDAP, not from downloading the global files. Needs an Earthdata token (EARTHDATA_TOKEN).
 *
 * STATUS: discovery is verified live (handoff, 14 Nov 2026). The OPeNDAP cell request and its reply
 * parser follow the documented DAP4 constraint syntax but have NOT been run against the live service
 * because no Earthdata credentials were available. Verify on the first authenticated call.
 */

export const IMERG = {
  shortName: "GPM_3IMERGDF",
  version: "07",
  doi: "10.5067/GPM/IMERGDF/DAY/07",
  collectionConceptId: "C2723754864-GES_DISC",
  cmrUrl: "https://cmr.earthdata.nasa.gov/search/granules.json",
  /** A complete day has 48 valid half-hour inputs. */
  fullDaySamples: 48,
} as const;

/** Variables read for every day. `precipitation` is mm/day for the day; the _cnt fields count valid half-hours. */
export const IMERG_VARIABLES = ["precipitation", "precipitation_cnt", "randomError", "randomError_cnt"] as const;

export class ImergError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImergError";
  }
}

export interface ImergGranule {
  id: string;
  producerGranuleId: string;
  /** ISO date of the day the file covers. */
  date: string;
  timeStart: string;
  dataUrl: string | null;
  opendapUrl: string | null;
}

export interface CmrQuery {
  /** ISO UTC instants. */
  start: string;
  end: string;
  /** west, south, east, north. Daily files are global, so this only narrows discovery. */
  bbox?: [number, number, number, number];
  pageSize?: number;
}

export function cmrUrl(q: CmrQuery, page: number): string {
  const params = new URLSearchParams({
    short_name: IMERG.shortName,
    version: IMERG.version,
    temporal: `${q.start},${q.end}`,
    page_size: String(q.pageSize ?? 100),
    page_num: String(page),
  });
  if (q.bbox) params.set("bounding_box", q.bbox.join(","));
  return `${IMERG.cmrUrl}?${params.toString()}`;
}

type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);

export function parseCmrEntries(json: unknown): ImergGranule[] {
  const entries = isObj(json) && isObj(json.feed) && Array.isArray(json.feed.entry) ? json.feed.entry : [];
  const out: ImergGranule[] = [];
  for (const e of entries) {
    if (!isObj(e) || typeof e.time_start !== "string") continue;
    const links = Array.isArray(e.links) ? e.links.filter(isObj) : [];
    const href = (re: RegExp, pred?: (l: Json) => boolean) => {
      const l = links.find((x) => typeof x.rel === "string" && re.test(x.rel) && typeof x.href === "string" && (!pred || pred(x)));
      return l ? String(l.href) : null;
    };
    out.push({
      id: String(e.id ?? ""),
      producerGranuleId: String(e.producer_granule_id ?? e.title ?? ""),
      date: e.time_start.slice(0, 10),
      timeStart: e.time_start,
      // the direct https download, not the S3 or inherited documentation links
      dataUrl: href(/\/data#$/, (l) => String(l.href).startsWith("https://data.gesdisc") && String(l.href).endsWith(".nc4")),
      opendapUrl: href(/\/service#$/, (l) => String(l.href).includes("opendap")),
    });
  }
  return out;
}

export interface FetchOptions {
  fetch?: typeof fetch;
  signal?: AbortSignal;
}

/** All granules in the period, following pages until a short page is returned. */
export async function discoverGranules(q: CmrQuery, opts: FetchOptions = {}, maxPages = 60): Promise<ImergGranule[]> {
  const size = q.pageSize ?? 100;
  const all: ImergGranule[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const res = await fetchWithRetry(
      cmrUrl(q, page),
      { signal: opts.signal, headers: { accept: "application/json" } },
      { signal: opts.signal, maxRetries: 3, initialDelayMs: 400 },
      opts.fetch ?? fetch,
    );
    if (!res.ok) throw new ImergError(`CMR answered ${res.status}.`);
    const batch = parseCmrEntries(await res.json());
    all.push(...batch);
    if (batch.length < size) break;
  }
  // one record per day
  const byDate = new Map<string, ImergGranule>();
  for (const g of all) byDate.set(g.date, g);
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** Grid indices of the 0.1 degree cell holding a point. Files are (time, lon, lat). */
export function cellIndices(lat: number, lon: number): { latIdx: number; lonIdx: number } {
  const c = imergCell(lat, lon);
  const m = c.key.match(/^imerg:(\d+):(\d+)$/);
  if (!m) throw new ImergError("Could not index the IMERG cell.");
  return { latIdx: Number(m[1]), lonIdx: Number(m[2]) };
}

/** DAP4 request for one cell of every variable, as CSV. */
export function opendapCellUrl(opendapUrl: string, lat: number, lon: number): string {
  const { latIdx, lonIdx } = cellIndices(lat, lon);
  const ce = IMERG_VARIABLES.map((v) => `/${v}[0][${lonIdx}][${latIdx}]`).join(";");
  return `${opendapUrl}.dap.csv?dap4.ce=${encodeURIComponent(ce)}`;
}

export interface ImergDay {
  date: string;
  /** mm for the day, or null when missing. */
  precipMm: number | null;
  /** Valid half-hour inputs behind the day (48 is complete). */
  samples: number | null;
  /** Product's random-error estimate for the day. Not a total uncertainty. */
  randomError: number | null;
  randomErrorSamples: number | null;
  partialSampling: boolean;
  granule: string;
}

/** Pulls the number after each variable name out of an OPeNDAP CSV/text reply. */
export function parseCellReply(text: string, fillValue = -9999.9): Partial<Record<(typeof IMERG_VARIABLES)[number], number | null>> {
  const out: Partial<Record<(typeof IMERG_VARIABLES)[number], number | null>> = {};
  for (const v of IMERG_VARIABLES) {
    // match the variable name that is not a prefix of a longer one, then the last number on that line or the next
    const re = new RegExp(`(?:^|[\\s/,])${v}(?![A-Za-z_])[^\\n]*\\n?([^\\n]*)`, "m");
    const m = text.match(re);
    if (!m) continue;
    const nums = (m[0].match(/-?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?/g) ?? []).map(Number);
    // drop the index digits that appear in "[0][12][34]" by taking the final value
    const value = nums.length ? nums[nums.length - 1] : null;
    out[v] = value === null || !Number.isFinite(value) || value === fillValue || value < 0 ? null : value;
  }
  return out;
}

export function toImergDay(g: ImergGranule, text: string): ImergDay {
  const r = parseCellReply(text);
  const samples = r.precipitation_cnt ?? null;
  return {
    date: g.date,
    precipMm: r.precipitation ?? null,
    samples,
    randomError: r.randomError ?? null,
    randomErrorSamples: r.randomError_cnt ?? null,
    // fewer than 48 valid half-hours is flagged, never read as a fully observed day
    partialSampling: samples !== null && samples < IMERG.fullDaySamples,
    granule: g.producerGranuleId,
  };
}

export async function fetchImergCell(
  g: ImergGranule,
  lat: number,
  lon: number,
  opts: FetchOptions & { env?: Env } = {},
): Promise<ImergDay> {
  const token = imergToken(opts.env);
  if (!token) throw new SourceUnconfiguredError("imerg");
  if (!g.opendapUrl) throw new ImergError("This granule has no OPeNDAP link.");
  const res = await fetchWithRetry(
    opendapCellUrl(g.opendapUrl, lat, lon),
    {
      signal: opts.signal,
      headers: { Authorization: `Bearer ${token}` },
    },
    { signal: opts.signal, maxRetries: 3, initialDelayMs: 400 },
    opts.fetch ?? fetch,
  );
  if (!res.ok) throw new ImergError(`OPeNDAP answered ${res.status} for ${g.date}.`);
  return toImergDay(g, await res.text());
}

/** Runs `fn` over items with at most `limit` in flight. Results keep input order; a failure is returned, not thrown. */
export async function pool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<Array<R | Error>> {
  const results: Array<R | Error> = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      try {
        results[i] = await fn(items[i]);
      } catch (e) {
        results[i] = e instanceof Error ? e : new Error(String(e));
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
