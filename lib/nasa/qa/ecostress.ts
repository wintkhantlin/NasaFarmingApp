/**
 * ECOSTRESS screening. `cloud` and `water` are 1 where the condition holds and 255 for fill.
 * `QC` is bit-packed: decode it with the product guidance before using LST for anything beyond context.
 */

export const ECOSTRESS_MASK_FILL = 255;

export const ECOSTRESS_QA_POLICY =
  "ECOSTRESS: drop cloud = 1 and water = 1 and fill (255). LST is land-surface temperature in kelvin (not air temperature); " +
  "ETdaily is W/m2 (not mm/day).";

export function ecostressClear(cloud: number | null, water: number | null): boolean {
  const c = cloud === null || cloud === ECOSTRESS_MASK_FILL ? null : cloud;
  const w = water === null || water === ECOSTRESS_MASK_FILL ? null : water;
  // an unknown mask is not "clear": missing QA never passes
  if (c === null || w === null) return false;
  return c === 0 && w === 0;
}

export const kelvinToCelsius = (k: number) => k - 273.15;
