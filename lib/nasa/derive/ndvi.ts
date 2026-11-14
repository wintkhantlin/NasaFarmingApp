import { decodeFmask } from "../qa/hls-fmask";

/**
 * Vegetation and moisture indices from HLS reflectance (already scaled to 0..1, fill removed).
 * Equivalent bands: HLSL30 red B04, NIR B05, SWIR1 B06; HLSS30 red B04, NIR B8A, SWIR1 B11.
 * In HLSS30, B05 is red-edge, not NIR.
 */

export const ndvi = (nir: number | null, red: number | null): number | null => normalizedDifference(nir, red);
export const ndmi = (nir: number | null, swir1: number | null): number | null => normalizedDifference(nir, swir1);

/** (a - b) / (a + b). A zero, negative or invalid denominator is missing, not zero. */
export function normalizedDifference(a: number | null, b: number | null): number | null {
  if (a === null || b === null || !Number.isFinite(a) || !Number.isFinite(b)) return null;
  const sum = a + b;
  if (!(sum > 0)) return null;
  const v = (a - b) / sum;
  return Number.isFinite(v) ? v : null;
}

export interface HlsPixelSeries {
  /** ISO dates of acquisitions. */
  dates: string[];
  /** One entry per date, per pixel: [red, nir, swir1, fmask]. Reflectance already scaled. */
  pixels: Array<Array<[red: number | null, nir: number | null, swir1: number | null, fmask: number | null]>>;
}

export interface ObservationSummary {
  date: string;
  /** Median NDVI of valid land pixels, or null when none were valid. */
  ndviMedian: number | null;
  ndmiMedian: number | null;
  validPixels: number;
  totalPixels: number;
  waterPixels: number;
  /** Valid land pixels over all pixels. */
  coverage: number;
}

const median = (xs: number[]): number | null => {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/**
 * One summary per date for a field polygon. Pixels with fill or a rejected Fmask are dropped before
 * any index is computed. Water pixels are counted separately so flooded fields are not called bare.
 * A date with no valid pixel keeps `null`: it is not "zero vegetation".
 */
export function summariseHls(series: HlsPixelSeries): ObservationSummary[] {
  return series.dates.map((date, d) => {
    const pix = series.pixels[d] ?? [];
    const nd: number[] = [];
    const nm: number[] = [];
    let water = 0;
    for (const [red, nir, swir1, fmask] of pix) {
      if (fmask === null) continue;
      const q = decodeFmask(fmask);
      if (q.fill) continue;
      if (q.water) {
        water++;
        continue;
      }
      if (!q.validLand) continue;
      const v = ndvi(nir, red);
      if (v !== null) nd.push(v);
      const m = ndmi(nir, swir1);
      if (m !== null) nm.push(m);
    }
    return {
      date,
      ndviMedian: median(nd),
      ndmiMedian: median(nm),
      validPixels: nd.length,
      totalPixels: pix.length,
      waterPixels: water,
      coverage: pix.length ? nd.length / pix.length : 0,
    };
  });
}
