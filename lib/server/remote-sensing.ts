import { PROCESSING_VERSION } from "../evidence/indicator";
import {
  getTask,
  listBundle,
  downloadFile,
  submitTask,
  AppeearsError,
  type BundleFile,
  type ClientOptions,
} from "../nasa/appeears/client";
import { earthdataConfigured } from "../nasa/earthdata";
import { detectDelivery } from "../nasa/appeears/scale";
import { parseBundleFileName, parseSmapCsv, rasterToPhysical, readGeoTiff, type SmapDay } from "../nasa/appeears/results";
import { hlsAreaTask, smapPointTask, srtmAreaTask, SMAP_SAFE_END } from "../nasa/appeears/tasks";
import { summariseHls, type HlsPixelSeries, type ObservationSummary } from "../nasa/derive/ndvi";
import { slopeGrid, slopeStats, type SlopeStats } from "../nasa/derive/slope";
import { ingestPlanetaryComputerLandsat, LANDSAT_EXTRACTION, type PlanetaryComputerResult } from "../nasa/planetary-computer";
import type { FieldGeometry, LngLat } from "../types";
import { cacheKey, serverCache, type ServerCache } from "./cache";
import { getIngestionQueue } from "./queue";

/**
 * Satellite data ingestion for SMAP (regional soil moisture), HLS/Landsat (field vegetation),
 * and SRTM (terrain slope).
 *
 * Vegetation Route:
 *  - Primary: Microsoft Planetary Computer Landsat Collection 2 Level-2 (cloud-native COGs via STAC).
 *  - Fallback: NASA AppEEARS Harmonized Landsat-Sentinel (HLS) when configured or when requested.
 *
 * SMAP & SRTM:
 *  - Ingested via NASA AppEEARS state machine.
 */

export type RemoteKind = "smap" | "hls" | "srtm";
export type RemoteStatus = "unconfigured" | "pending" | "ok" | "unavailable";
export type RemoteProvider = "planetary-computer" | "appeears" | "heartland-offline";

export interface RemoteState<T> {
  kind: RemoteKind;
  status: RemoteStatus;
  provider?: RemoteProvider;
  taskId?: string;
  submittedAt?: string;
  retrievedAt?: string;
  start: string;
  end: string;
  data?: T;
  error?: string;
}

export interface SmapData {
  days: SmapDay[];
}
export interface HlsData {
  observations: ObservationSummary[];
}
export interface SrtmData {
  slope: SlopeStats;
}

export interface RemoteContext extends ClientOptions {
  cache?: ServerCache;
  now?: Date;
  provider?: RemoteProvider;
}

/** Stable short hash of a geometry, so the same field reuses its job. */
export function geometryHash(g: FieldGeometry): string {
  const pts = g.type === "Point" ? [g.coordinates] : g.coordinates[0];
  const text = pts.map((p) => `${p[0].toFixed(5)},${p[1].toFixed(5)}`).join(";");
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

/** The period each product is asked for. SMAP stops at the end of 2025 until the 2026 notice is rechecked. */
export function periodFor(kind: RemoteKind): { start: string; end: string } {
  if (kind === "smap") return { start: "2016-01-01", end: SMAP_SAFE_END };
  if (kind === "hls") return { start: "2021-01-01", end: "2025-12-31" };
  return { start: "2000-02-11", end: "2000-02-21" };
}

const unconfigured = <T,>(kind: RemoteKind): RemoteState<T> => ({ kind, status: "unconfigured", ...periodFor(kind) });

function taskFor(kind: RemoteKind, fieldId: string, geometry: FieldGeometry, centroid: LngLat) {
  const p = periodFor(kind);
  const name = `${fieldId.slice(0, 8)}-${kind}-${geometryHash(geometry)}`;
  if (kind === "smap") return smapPointTask({ name, id: `field-${fieldId.slice(0, 8)}`, point: centroid, ...p });
  if (kind === "hls") return hlsAreaTask({ name, geometry, ...p });
  return srtmAreaTask({ name, geometry });
}

/** Moves one job forward and returns its state. Safe to call repeatedly. */
export async function advance<T>(
  kind: RemoteKind,
  field: { id: string; geometry: FieldGeometry; centroid: LngLat },
  ctx: RemoteContext = {},
): Promise<RemoteState<T>> {
  const env = ctx.env ?? process.env;
  const cache = ctx.cache ?? serverCache();
  const now = (ctx.now ?? new Date()).toISOString();
  const p = periodFor(kind);

  // 1. For vegetation ("hls"), attempt Microsoft Planetary Computer Landsat C2 L2 first
  if (kind === "hls" && ctx.provider !== "appeears" && env.PREFER_APPEEARS !== "true") {
    const mpcKey = cacheKey("mpc", PROCESSING_VERSION, LANDSAT_EXTRACTION, field.id, geometryHash(field.geometry));
    const cached = await cache.get<RemoteState<T>>(mpcKey);
    if (cached && cached.status === "ok") return cached;

    try {
      const queue = getIngestionQueue();
      const job = await queue.enqueue(
        "remote_sensing",
        "landsat-c2-l2",
        { fieldId: field.id, geom: geometryHash(field.geometry), start: p.start, end: p.end },
        () =>
          ingestPlanetaryComputerLandsat(field, p, {
            fetch: ctx.fetch,
            signal: ctx.signal,
            apiKey: env.PLANETARY_COMPUTER_API_KEY,
          }),
      );

      if (job.status === "completed" && job.result) {
        const res = job.result as PlanetaryComputerResult;
        if (res.observations && res.observations.length > 0) {
          const state: RemoteState<T> = {
            kind: "hls",
            status: "ok",
            provider: "planetary-computer",
            start: p.start,
            end: p.end,
            retrievedAt: res.retrievedAt,
            data: { observations: res.observations } as T,
          };
          await cache.set(mpcKey, state, 60 * 60 * 24 * 30);
          return state;
        }
      }

      if (job.status === "processing" || job.status === "pending") {
        return {
          kind: "hls",
          status: "pending",
          provider: "planetary-computer",
          start: p.start,
          end: p.end,
        };
      }
    } catch (e) {
      console.warn("Planetary Computer Landsat ingestion encountered an error; evaluating AppEEARS fallback:", e);
    }

    // If MPC failed or yielded no observations, fall back to AppEEARS if configured
    if (!earthdataConfigured("appeears", env)) {
      return {
        kind: "hls",
        status: "unavailable",
        provider: "planetary-computer",
        start: p.start,
        end: p.end,
        error: "Planetary Computer observations unavailable and Earthdata login is unconfigured for AppEEARS.",
      };
    }
  }

  // 2. AppEEARS state machine (for SMAP, SRTM, or HLS fallback)
  if (!earthdataConfigured("appeears", env)) return unconfigured<T>(kind);
  const key = cacheKey("appeears", PROCESSING_VERSION, kind, field.id, geometryHash(field.geometry), kind === "smap" ? field.centroid.map((c) => c.toFixed(4)).join(",") : "area");
  let state = await cache.get<RemoteState<T>>(key);
  const opts: ClientOptions = { fetch: ctx.fetch, signal: ctx.signal, env };

  try {
    if (!state) {
      const { taskId } = await submitTask(taskFor(kind, field.id, field.geometry, field.centroid), opts);
      state = { kind, status: "pending", provider: "appeears", taskId, submittedAt: now, ...periodFor(kind) };
      await cache.set(key, state, 60 * 60 * 24);
      return state;
    }
    if (state.status !== "pending" || !state.taskId) return state;
    const task = await getTask(state.taskId, opts);
    if (task.status === "error") {
      state = { ...state, status: "unavailable", provider: "appeears", error: "AppEEARS could not finish this job." };
      await cache.set(key, state, 60 * 60);
      return state;
    }
    if (task.status !== "done") return state;
    const files = await listBundle(state.taskId, opts);
    const data = await readResults<T>(kind, state.taskId, files, opts);
    state = { ...state, status: "ok", provider: "appeears", retrievedAt: now, data };
    await cache.set(key, state, 60 * 60 * 24 * 30);
    return state;
  } catch (e) {
    const status = e instanceof AppeearsError && e.status && e.status >= 500 ? "pending" : "unavailable";
    return { ...(state ?? { kind, ...periodFor(kind) }), kind, status, provider: "appeears", error: e instanceof Error ? e.message : "AppEEARS request failed." } as RemoteState<T>;
  }
}

async function readResults<T>(kind: RemoteKind, taskId: string, files: BundleFile[], opts: ClientOptions): Promise<T> {
  if (kind === "smap") {
    const csv = files.find((f) => /\.csv$/i.test(f.file_name) && /results/i.test(f.file_name)) ?? files.find((f) => /\.csv$/i.test(f.file_name));
    if (!csv) throw new AppeearsError("The SMAP job returned no CSV.");
    const text = new TextDecoder().decode(await downloadFile(taskId, csv.file_id, opts));
    return { days: parseSmapCsv(text) } as T;
  }
  if (kind === "srtm") {
    const tif = files.find((f) => /SRTMGL1_DEM.*\.tif$/i.test(f.file_name)) ?? files.find((f) => /\.tif$/i.test(f.file_name));
    if (!tif) throw new AppeearsError("The SRTM job returned no elevation raster.");
    const r = await readGeoTiff(await downloadFile(taskId, tif.file_id, opts));
    const values = rasterToPhysical(r, "SRTMGL1_NC.003", "SRTMGL1_DEM", "scaled");
    const [w, s, e, n] = r.bbox;
    const stats = slopeStats(slopeGrid({ values, width: r.width, height: r.height, dLonDeg: (e - w) / r.width, dLatDeg: (n - s) / r.height, centreLatDeg: (n + s) / 2 }));
    return { slope: stats } as T;
  }
  // HLS: one raster per layer per date
  const byDate = new Map<string, Partial<Record<"B04" | "B05" | "B06" | "Fmask", BundleFile>>>();
  for (const f of files) {
    const p = parseBundleFileName(f.file_name);
    if (!p || !p.date || !/^(B04|B05|B06|Fmask)$/.test(p.layer)) continue;
    const row = byDate.get(p.date) ?? {};
    row[p.layer as "B04" | "B05" | "B06" | "Fmask"] = f;
    byDate.set(p.date, row);
  }
  const dates = [...byDate.keys()].sort().slice(0, 400);
  const series: HlsPixelSeries = { dates: [], pixels: [] };
  const delivery: Record<string, "raw" | "scaled"> = {};
  for (const date of dates) {
    const row = byDate.get(date)!;
    if (!row.B04 || !row.B05 || !row.B06 || !row.Fmask) continue;
    try {
      const [red, nir, swir, fmask] = await Promise.all(
        (["B04", "B05", "B06", "Fmask"] as const).map(async (layer) => readGeoTiff(await downloadFile(taskId, row[layer]!.file_id, opts))),
      );
      const physical = (r: typeof red, layer: "B04" | "B05" | "B06") => {
        delivery[layer] ??= detectDelivery("HLSL30.020", layer, Array.from({ length: Math.min(200, r.values.length) }, (_, i) => Number(r.values[i])));
        return rasterToPhysical(r, "HLSL30.020", layer, delivery[layer]);
      };
      const R = physical(red, "B04");
      const N = physical(nir, "B05");
      const S = physical(swir, "B06");
      const count = Math.min(R.length, N.length, S.length, fmask.values.length);
      const px: HlsPixelSeries["pixels"][number] = [];
      for (let i = 0; i < count; i++) {
        const fm = Number(fmask.values[i]);
        // pixels outside the polygon come back as fill; fill is dropped later by the Fmask policy
        px.push([R[i], N[i], S[i], Number.isFinite(fm) ? fm : null]);
      }
      series.dates.push(date);
      series.pixels.push(px);
    } catch (err) {
      // An individual date download or parse failure shouldn't invalidate the entire time series
      console.warn(`HLS date ${date} skipped due to tile download/parse error:`, err);
    }
  }
  return { observations: summariseHls(series) } as T;
}
