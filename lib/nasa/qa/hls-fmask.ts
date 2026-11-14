/**
 * HLS V2 Fmask decoding (HLSL30 and HLSS30). Bit 0 is reserved in V2 (not a cirrus flag).
 *
 *   bit 1 cloud, bit 2 adjacent to cloud or shadow, bit 3 cloud shadow, bit 4 snow or ice,
 *   bit 5 water, bits 6-7 aerosol level (00 climatology, 01 low, 10 moderate, 11 high).
 *
 * The policy is conservative and is recorded on every indicator that uses it.
 */

export const FMASK_FILL = 255;

export const HLS_QA_POLICY =
  "HLS Fmask: reject fill (255), cloud (bit 1), adjacent cloud/shadow (bit 2), cloud shadow (bit 3), " +
  "snow/ice (bit 4) and high aerosol (bits 6-7 = 11). Water (bit 5) is kept apart from land-cover analysis. " +
  "Bit 0 is reserved in HLS V2.";

export interface FmaskDecoded {
  fill: boolean;
  cloud: boolean;
  adjacent: boolean;
  shadow: boolean;
  snow: boolean;
  water: boolean;
  aerosol: 0 | 1 | 2 | 3;
  /** Clear land: usable for vegetation indices. */
  validLand: boolean;
}

export function decodeFmask(value: number): FmaskDecoded {
  if (value === FMASK_FILL) {
    return { fill: true, cloud: false, adjacent: false, shadow: false, snow: false, water: false, aerosol: 0, validLand: false };
  }
  const bit = (n: number) => ((value >> n) & 1) === 1;
  const aerosol = ((value >> 6) & 3) as 0 | 1 | 2 | 3;
  const cloud = bit(1);
  const adjacent = bit(2);
  const shadow = bit(3);
  const snow = bit(4);
  const water = bit(5);
  return {
    fill: false,
    cloud,
    adjacent,
    shadow,
    snow,
    water,
    aerosol,
    validLand: !cloud && !adjacent && !shadow && !snow && !water && aerosol !== 3,
  };
}
