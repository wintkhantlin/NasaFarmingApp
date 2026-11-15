/**
 * ECOSTRESS screening. `cloud` and `water` are 1 where the condition holds and 255 for fill.
 * `QC` is bit-packed: decode it with the product guidance before using LST for anything beyond context.
 */

export const ECOSTRESS_MASK_FILL = 255;

export const ECOSTRESS_QA_POLICY =
  "ECOSTRESS: drop cloud = 1 and water = 1 and fill (255). For LST, keep only mandatory-QA bits 0-1 = 00 (best quality). " +
  "LST is land-surface temperature (not air temperature); ETdaily is W/m² (not mm/day).";

export function ecostressClear(cloud: number | null, water: number | null): boolean {
  const c = cloud === null || cloud === ECOSTRESS_MASK_FILL ? null : cloud;
  const w = water === null || water === ECOSTRESS_MASK_FILL ? null : water;
  // an unknown mask is not "clear": missing QA never passes
  if (c === null || w === null) return false;
  return c === 0 && w === 0;
}

/** ECOSTRESS L2 LSTE mandatory QA is stored in the least-significant two bits. */
export function ecostressLstUsable(qc: number | null, cloud: number | null, water: number | null): boolean {
  if (qc === null || !Number.isInteger(qc) || qc < 0) return false;
  return (qc & 0b11) === 0 && ecostressClear(cloud, water);
}

export const kelvinToCelsius = (k: number) => k - 273.15;
