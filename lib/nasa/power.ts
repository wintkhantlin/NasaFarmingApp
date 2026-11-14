/**
 * NASA POWER adapter (https://power.larc.nasa.gov). No API key.
 * Daily point data for the AG community, plus monthly climatology.
 */

import { fetchWithRetry } from "../network/fetch-with-retry";

/**
 * The eight parameters in the 14 Nov 2026 data handoff. Units returned by the API:
 * T2M* in C, RH2M in %, WS2M in m/s, ALLSKY_SFC_SW_DWN in MJ/m^2/day, PRECTOTCORR in mm/day, PS in kPa.
 */
export const POWER_DAILY_PARAMS = [
  "T2M",
  "T2M_MAX",
  "T2M_MIN",
  "RH2M",
  "WS2M",
  "ALLSKY_SFC_SW_DWN",
  "PRECTOTCORR",
  "PS",
] as const;

/** Extra modelled wetness fields. Still readable if present, but not requested by default. */
export const POWER_WETNESS_PARAMS = ["GWETTOP", "GWETROOT", "GWETPROF"] as const;

export type PowerParam = (typeof POWER_DAILY_PARAMS)[number] | (typeof POWER_WETNESS_PARAMS)[number];

/** Daily indexing standard. UTC matches IMERG's UTC days; it is not the Myanmar local day. */
export type PowerTimeStandard = "UTC" | "LST";

export interface DailyWeather {
  latitude: number;
  longitude: number;
  elevationM: number | null;
  /** ISO dates, YYYY-MM-DD, ascending. */
  dates: string[];
  /** One value per date; null where POWER has no data (its -999 fill value). */
  series: Partial<Record<PowerParam, Array<number | null>>>;
  source: { dataset: string; resolution: string; version: string | null };
  /** What the response said about itself. Kept so provenance never relies on this file's assumptions. */
  meta: {
    fillValue: number;
    timeStandard: string | null;
    /** Source models named in the header, e.g. MERRA2, SYN1DEG, POWER. */
    sources: string[];
    units: Partial<Record<string, string>>;
    apiVersion: string | null;
    start: string | null;
    end: string | null;
  };
}

export interface Climatology {
  /** 12 values per parameter, January first. */
  months: Partial<Record<string, number[]>>;
  annual: Partial<Record<string, number>>;
}

export class PowerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PowerError";
  }
}

const BASE = "https://power.larc.nasa.gov/api/temporal";
const MONTH_KEYS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

export interface PowerDailyRequest {
  lat: number;
  lon: number;
  /** YYYYMMDD */
  start: string;
  /** YYYYMMDD */
  end: string;
  parameters?: readonly PowerParam[];
  /** Defaults to UTC so daily values line up with IMERG. */
  timeStandard?: PowerTimeStandard;
}

export function powerDailyUrl(req: PowerDailyRequest): string {
  const params = req.parameters ?? POWER_DAILY_PARAMS;
  if (params.length > 20) throw new PowerError("POWER allows at most 20 parameters per point request.");
  const q = new URLSearchParams({
    parameters: params.join(","),
    community: "AG",
    longitude: req.lon.toFixed(4),
    latitude: req.lat.toFixed(4),
    start: req.start,
    end: req.end,
    format: "JSON",
    "time-standard": req.timeStandard ?? "UTC",
  });
  return `${BASE}/daily/point?${q.toString()}`;
}

export function powerClimatologyUrl(lat: number, lon: number, parameters: readonly string[]): string {
  const q = new URLSearchParams({
    parameters: parameters.join(","),
    community: "AG",
    longitude: lon.toFixed(4),
    latitude: lat.toFixed(4),
    format: "JSON",
  });
  return `${BASE}/climatology/point?${q.toString()}`;
}

type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);

function isoFromCompact(d: string): string {
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
}

function readParameters(json: unknown): { props: Json; parameter: Json; header: Json; fill: number } {
  if (!isObj(json) || !isObj(json.properties) || !isObj(json.properties.parameter)) {
    const msg = isObj(json) && Array.isArray(json.messages) ? json.messages.join(" ") : "";
    throw new PowerError(`Unexpected NASA POWER response.${msg ? ` ${msg}` : ""}`);
  }
  const header = isObj(json.header) ? json.header : {};
  const fill = typeof header.fill_value === "number" ? header.fill_value : -999;
  return { props: json.properties, parameter: json.properties.parameter, header, fill };
}

export function parsePowerDaily(json: unknown): DailyWeather {
  const { parameter, header, fill } = readParameters(json);
  const root = json as Json;
  const coords = isObj(root.geometry) && Array.isArray(root.geometry.coordinates) ? root.geometry.coordinates : [];

  const names = Object.keys(parameter) as PowerParam[];
  if (names.length === 0) throw new PowerError("NASA POWER returned no parameters.");
  const first = parameter[names[0]];
  if (!isObj(first)) throw new PowerError("NASA POWER returned an unreadable series.");
  const compactDates = Object.keys(first).sort();

  const series: DailyWeather["series"] = {};
  for (const name of names) {
    const byDate = parameter[name];
    if (!isObj(byDate)) continue;
    series[name] = compactDates.map((d) => {
      const v = byDate[d];
      return typeof v === "number" && v !== fill && Number.isFinite(v) ? v : null;
    });
  }

  const api = isObj(header.api) ? header.api : {};
  const unitsBlock = isObj(root.parameters) ? root.parameters : {};
  const units: Record<string, string> = {};
  for (const [name, info] of Object.entries(unitsBlock)) {
    if (isObj(info) && typeof info.units === "string") units[name] = info.units;
  }
  return {
    longitude: typeof coords[0] === "number" ? coords[0] : Number.NaN,
    latitude: typeof coords[1] === "number" ? coords[1] : Number.NaN,
    elevationM: typeof coords[2] === "number" ? coords[2] : null,
    dates: compactDates.map(isoFromCompact),
    series,
    source: {
      dataset: "NASA POWER",
      resolution: "about 0.5° (MERRA-2 and CERES)",
      version: typeof api.version === "string" ? api.version : null,
    },
    meta: {
      fillValue: fill,
      timeStandard: typeof header.time_standard === "string" ? header.time_standard : null,
      sources: Array.isArray(header.sources) ? header.sources.filter((x): x is string => typeof x === "string") : [],
      units,
      apiVersion: typeof api.version === "string" ? api.version : null,
      start: typeof header.start === "string" ? header.start : null,
      end: typeof header.end === "string" ? header.end : null,
    },
  };
}

export function parsePowerClimatology(json: unknown): Climatology {
  const { parameter, fill } = readParameters(json);
  const months: Climatology["months"] = {};
  const annual: Climatology["annual"] = {};
  for (const [name, values] of Object.entries(parameter)) {
    if (!isObj(values)) continue;
    const row = MONTH_KEYS.map((m) => values[m]);
    if (row.every((v): v is number => typeof v === "number" && v !== fill)) months[name] = row;
    const ann = values.ANN;
    if (typeof ann === "number" && ann !== fill) annual[name] = ann;
  }
  return { months, annual };
}

export interface FetchOptions {
  fetch?: typeof fetch;
  signal?: AbortSignal;
}

async function getJson(url: string, opts: FetchOptions): Promise<unknown> {
  const res = await fetchWithRetry(
    url,
    { signal: opts.signal, headers: { accept: "application/json" } },
    { signal: opts.signal, maxRetries: 3, initialDelayMs: 500, maxDelayMs: 4000 },
    opts.fetch ?? fetch,
  );
  if (!res.ok) throw new PowerError(`NASA POWER answered ${res.status}.`);
  return res.json();
}

export async function fetchPowerDaily(req: PowerDailyRequest, opts: FetchOptions = {}): Promise<DailyWeather> {
  return parsePowerDaily(await getJson(powerDailyUrl(req), opts));
}

export async function fetchPowerClimatology(
  lat: number,
  lon: number,
  parameters: readonly string[] = ["T2M", "PRECTOTCORR"],
  opts: FetchOptions = {},
): Promise<Climatology> {
  return parsePowerClimatology(await getJson(powerClimatologyUrl(lat, lon, parameters), opts));
}
