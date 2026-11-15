/**
 * What the ground-truth checks found, in the compact form the engine needs at run time. The full results live in
 * data/validation/power-vs-ghcn.json (too large to ship to the browser); tests/lib/source-checks.test.ts fails if
 * these numbers drift from that file, so rerunning `npm run validate:weather` forces an update here.
 */

export const WEATHER_CHECK = {
  ranOn: "2026-11-15",
  period: "2015–2024",
  groundTruth: "NOAA GHCN-Daily stations",
  report: "docs/validation/WEATHER_VALIDATION.md",
} as const;

/** NASA POWER PRECTOTCORR monthly rain totals against the Mandalay station (the Dry Zone check). */
export const DRY_ZONE_POWER_RAIN = {
  stationId: "BMM00048042",
  station: "Mandalay",
  /** (POWER − station) / station over complete months. */
  relBias: -0.51,
  months: 43,
} as const;

/** Regions the Dry Zone rain check stands in for. */
export const DRY_ZONE_REGIONS = ["magway"] as const;

/** Daily max-temperature limits at or above this were graded poor at every station that could be graded. */
export const UNRELIABLE_HEAT_LIMIT_C = 36;

export function isDryZone(region: string | undefined | null): boolean {
  return !!region && (DRY_ZONE_REGIONS as readonly string[]).includes(region);
}

/** Farmer-facing caution for POWER rain in the Dry Zone. */
export function dryZoneRainCaution(): string {
  const pct = Math.round(Math.abs(DRY_ZONE_POWER_RAIN.relBias) * 100);
  return `In the Dry Zone, NASA POWER rain was about ${pct}% lower than the ${DRY_ZONE_POWER_RAIN.station} weather station over ${WEATHER_CHECK.period}, so rain shortfall and drought stress here are probably overstated.`;
}

export function heatLimitCaution(thresholdC: number): string | null {
  return thresholdC >= UNRELIABLE_HEAT_LIMIT_C
    ? `Days above ${thresholdC} °C from NASA POWER did not match Myanmar weather stations well (${WEATHER_CHECK.period}), so treat this count as rough.`
    : null;
}
