import Papa from "papaparse";
import { toPhysical, type Delivery } from "./scale";
import type { ProductId } from "./products";

/**
 * Readers for AppEEARS result files: point CSVs (SMAP) and area GeoTIFFs (HLS, SRTM, MODIS, ECOSTRESS).
 * Fill becomes null, scale is applied once (see scale.ts), and nothing is averaged without a count.
 */

export interface Raster {
  width: number;
  height: number;
  /** west, south, east, north in the file's CRS. */
  bbox: [number, number, number, number];
  /** Row-major, north row first. Raw values from the file. */
  values: ArrayLike<number>;
  noData: number | null;
}

export async function readGeoTiff(buffer: ArrayBuffer): Promise<Raster> {
  const { fromArrayBuffer } = await import("geotiff");
  const tiff = await fromArrayBuffer(buffer);
  const image = await tiff.getImage();
  const rasters = await image.readRasters({ interleave: false });
  const band = (Array.isArray(rasters) ? rasters[0] : (rasters as unknown as ArrayLike<number>)) as ArrayLike<number>;
  const bb = image.getBoundingBox();
  return {
    width: image.getWidth(),
    height: image.getHeight(),
    bbox: [bb[0], bb[1], bb[2], bb[3]],
    values: band,
    noData: image.getGDALNoData(),
  };
}

/** `HLSL30.020_B04_doy2025045_aid0001.tif` to its product, layer and date. Static layers have no date. */
export function parseBundleFileName(name: string): { product: string; layer: string; date: string | null } | null {
  const m = name.match(/^([A-Za-z0-9_]+\.\d{3})_(.+?)(?:_doy(\d{4})(\d{3}))?(?:_aid\d+)?\.(?:tif|csv)$/);
  if (!m) return null;
  const [, product, layer, year, doy] = m;
  let date: string | null = null;
  if (year && doy) {
    date = new Date(Date.UTC(Number(year), 0, Number(doy))).toISOString().slice(0, 10);
  }
  return { product, layer, date };
}

/** Raster values to numbers with fill and scale handled. */
export function rasterToPhysical(
  r: Raster,
  product: ProductId,
  layer: string,
  delivery: Delivery,
): Array<number | null> {
  const out: Array<number | null> = new Array(r.values.length);
  for (let i = 0; i < r.values.length; i++) {
    const v = r.values[i];
    if (r.noData !== null && v === r.noData) out[i] = null;
    else out[i] = toPhysical(product, layer, v, delivery);
  }
  return out;
}

export interface SmapDay {
  date: string;
  surface: number | null;
  rootzone: number | null;
  rootzonePctl: number | null;
  /** Valid three-hourly values behind the daily mean, per variable. */
  validSurface: number;
  validRootzone: number;
  /** Rows seen for the day. A full day has eight 3-hourly values. */
  rows: number;
}

/**
 * Daily means from an AppEEARS SMAP L4 point CSV. Columns are found by their layer-name suffix so a
 * changed prefix does not break the read. A day mean is only produced from valid values and always
 * carries its valid count.
 */
export function parseSmapCsv(text: string): SmapDay[] {
  const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
  const rows = parsed.data;
  if (rows.length === 0) return [];
  const cols = Object.keys(rows[0]);
  const find = (suffix: string) => cols.find((c) => c.endsWith(suffix));
  const surfaceCol = find("Geophysical_Data_sm_surface");
  const rootCol = find("Geophysical_Data_sm_rootzone");
  const pctlCol = find("Geophysical_Data_sm_rootzone_pctl");
  const dateCol = cols.find((c) => c === "Date");
  if (!dateCol || !surfaceCol || !rootCol) return [];

  const byDay = new Map<string, { s: number[]; r: number[]; p: number[]; n: number }>();
  const num = (product: ProductId, layer: string, v: string | undefined) =>
    toPhysical(product, layer, v === undefined || v === "" ? null : Number(v), "scaled");

  for (const row of rows) {
    const day = String(row[dateCol]).slice(0, 10);
    const entry = byDay.get(day) ?? { s: [], r: [], p: [], n: 0 };
    entry.n++;
    const s = num("SPL4SMGP.008", "Geophysical_Data_sm_surface", row[surfaceCol]);
    const r = num("SPL4SMGP.008", "Geophysical_Data_sm_rootzone", row[rootCol]);
    const p = pctlCol ? num("SPL4SMGP.008", "Geophysical_Data_sm_rootzone_pctl", row[pctlCol]) : null;
    if (s !== null) entry.s.push(s);
    if (r !== null) entry.r.push(r);
    if (p !== null) entry.p.push(p);
    byDay.set(day, entry);
  }
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, e]) => ({
      date,
      surface: mean(e.s),
      rootzone: mean(e.r),
      rootzonePctl: mean(e.p),
      validSurface: e.s.length,
      validRootzone: e.r.length,
      rows: e.n,
    }));
}

export interface SmapPeriodStats {
  meanRootzone: number | null;
  meanSurface: number | null;
  validDays: number;
  expectedDays: number;
  /** Mean percentile for the period, relative to the product's own reference record (not a farm probability). */
  meanPercentile: number | null;
}

/** Statistics for a crop window. A day counts only if it has at least one valid root-zone value. */
export function smapWindowStats(days: SmapDay[], from: string, to: string): SmapPeriodStats {
  const inWin = days.filter((d) => d.date >= from && d.date <= to);
  const valid = inWin.filter((d) => d.rootzone !== null);
  const avg = (xs: Array<number | null>) => {
    const v = xs.filter((x): x is number => x !== null);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  };
  const expected = Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1;
  return {
    meanRootzone: avg(valid.map((d) => d.rootzone)),
    meanSurface: avg(inWin.map((d) => d.surface)),
    validDays: valid.length,
    expectedDays: expected,
    meanPercentile: avg(valid.map((d) => d.rootzonePctl)),
  };
}
