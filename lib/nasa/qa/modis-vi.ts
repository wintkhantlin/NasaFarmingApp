/**
 * MOD13Q1.061 quality. `_250m_16_days_VI_Quality` is a 16-bit field. Its bit-field names and values
 * are published by the AppEEARS quality service (GET /quality/MOD13Q1.061/_250m_16_days_VI_Quality,
 * checked 14 Nov 2026), which lists them by name: MODLAND, VI Usefulness, Aerosol Quantity, Adjacent
 * cloud detected, Atmosphere BRDF Correction, Mixed Clouds, Land/Water Mask, Possible snow/ice,
 * Possible shadow. The bit positions below are the MOD13 user guide layout for those same fields.
 * These are not the HLS Fmask bits.
 */

export const MODIS_NDVI_FILL = -3000;
export const MODIS_VI_QUALITY_FILL = 65535;
export const MODIS_RELIABILITY_FILL = -1;

export interface ViQuality {
  /** 0 good, 1 check other QA, 2 probably cloudy, 3 not produced. */
  modland: 0 | 1 | 2 | 3;
  /** 0 highest quality to 15 not useful. */
  usefulness: number;
  adjacentCloud: boolean;
  mixedClouds: boolean;
  /** 1 = land; 3, 4, 5 are inland water of various kinds; others are ocean. */
  landWater: number;
  snowIce: boolean;
  shadow: boolean;
}

export function decodeViQuality(value: number): ViQuality | null {
  if (!Number.isInteger(value) || value < 0 || value >= MODIS_VI_QUALITY_FILL) return null;
  return {
    modland: (value & 0b11) as ViQuality["modland"],
    usefulness: (value >> 2) & 0b1111,
    adjacentCloud: ((value >> 8) & 1) === 1,
    mixedClouds: ((value >> 10) & 1) === 1,
    landWater: (value >> 11) & 0b111,
    snowIce: ((value >> 14) & 1) === 1,
    shadow: ((value >> 15) & 1) === 1,
  };
}

/** Pixel reliability: 0 good, 1 marginal, 2 snow/ice, 3 cloudy. Fill is -1. */
export const reliabilityGood = (v: number) => v === 0;

/**
 * Conservative acceptance: MODLAND "good quality", no cloud or shadow or snow signal, and a land
 * pixel. Inland-water pixels are excluded here because flooded rice must not be read as vegetation
 * or as bare soil; they are reported separately by the caller.
 */
export function viUsable(quality: number, reliability: number | null): boolean {
  const q = decodeViQuality(quality);
  if (!q) return false;
  if (reliability === null || !reliabilityGood(reliability)) return false;
  return q.modland === 0 && !q.adjacentCloud && !q.mixedClouds && !q.snowIce && !q.shadow && q.landWater === 1;
}

export function viIsInlandWater(quality: number): boolean {
  const q = decodeViQuality(quality);
  return q !== null && [3, 4, 5].includes(q.landWater);
}

export const MODIS_QA_POLICY =
  "MOD13Q1.061: keep MODLAND = good quality (the service's only acceptable value), pixel reliability 0, " +
  "no adjacent/mixed cloud, snow/ice or shadow, and a land pixel. Inland-water pixels are set aside. " +
  "Quality is decoded as MOD13 bit fields, not HLS Fmask bits. Values are 16-day composites; use the composite day-of-year layer for timing.";
