/**
 * Saxton and Rawls (2006) pedotransfer functions: water held at wilting point (-1500 kPa) and field
 * capacity (-33 kPa) from sand, clay and organic matter. Source: Saxton, K.E. and Rawls, W.J. (2006),
 * Soil Sci. Soc. Am. J. 70:1569-1578, eqs. 1 to 4 (first-solution moisture-tension relations).
 *
 * Units, as in the paper: sand and clay are mass FRACTIONS (0 to 1) and organic matter is PERCENT by
 * weight. The organic-matter terms are written for percent; feeding a fraction shrinks them a hundred
 * times and quietly turns the result into a texture-only estimate, so the converter below returns percent.
 */

/** van Bemmelen factor: organic matter is about 1.724 times organic carbon. */
export const OM_PER_OC = 1.724;

/** Organic matter in percent by weight from soil organic carbon in g per kg (g/kg / 10 = %, times 1.724). */
export const organicMatterPct = (socGKg: number) => (socGKg / 10) * OM_PER_OC;

/** Calibration range of the equations (Saxton and Rawls 2006): organic matter up to 8 %, clay up to 60 %. */
export const PTF_LIMITS = { omPctMax: 8, clayMax: 0.6 } as const;

export interface PtfInput {
  /** Sand, mass fraction 0 to 1. */
  sand: number;
  /** Clay, mass fraction 0 to 1. */
  clay: number;
  /** Organic matter, percent by weight. */
  omPct: number;
}

export interface PtfResult {
  /** Volumetric water content at -1500 kPa, m3/m3. */
  thetaWp: number;
  /** Volumetric water content at -33 kPa, m3/m3. */
  thetaFc: number;
  /** Plant-available water, mm per m of soil: 1000 (thetaFc - thetaWp). */
  awcMmPerM: number;
}

/**
 * Water retention from sand, clay and organic matter. Returns null, not a guess, when an input is missing,
 * outside what the equations were fitted on, or the result is not physical (field capacity at or below
 * wilting point).
 */
export function saxtonRawls({ sand: S, clay: C, omPct: OM }: PtfInput): PtfResult | null {
  if (![S, C, OM].every(Number.isFinite)) return null;
  if (S < 0 || C < 0 || S + C > 1 + 1e-9) return null;
  if (OM < 0 || OM > PTF_LIMITS.omPctMax || C > PTF_LIMITS.clayMax) return null;

  const theta1500t = -0.024 * S + 0.487 * C + 0.006 * OM + 0.005 * (S * OM) - 0.013 * (C * OM) + 0.068 * (S * C) + 0.031;
  const thetaWp = theta1500t + (0.14 * theta1500t - 0.02);
  const theta33t = -0.251 * S + 0.195 * C + 0.011 * OM + 0.006 * (S * OM) - 0.027 * (C * OM) + 0.452 * (S * C) + 0.299;
  const thetaFc = theta33t + (1.283 * theta33t * theta33t - 0.374 * theta33t - 0.015);

  if (!(thetaWp > 0) || !(thetaFc > thetaWp) || thetaFc >= 1) return null;
  return { thetaWp, thetaFc, awcMmPerM: 1000 * (thetaFc - thetaWp) };
}
