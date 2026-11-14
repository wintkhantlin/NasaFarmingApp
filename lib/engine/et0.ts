/** Reference evapotranspiration from temperature and latitude alone (FAO-56). */

const GSC = 0.082; // solar constant, MJ m-2 min-1
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Day of the year (1 to 366) for an ISO date, in UTC. */
export function dayOfYear(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 0)) / 86_400_000);
}

/** Extraterrestrial radiation, MJ m-2 day-1 (FAO-56 equation 21). */
export function extraterrestrialRadiation(latDeg: number, doy: number): number {
  const phi = toRad(latDeg);
  const dr = 1 + 0.033 * Math.cos((2 * Math.PI * doy) / 365);
  const delta = 0.409 * Math.sin((2 * Math.PI * doy) / 365 - 1.39);
  // Sunset hour angle; the clamp covers polar day (cos = -1) and polar night (cos = 1).
  const x = Math.min(1, Math.max(-1, -Math.tan(phi) * Math.tan(delta)));
  const ws = Math.acos(x);
  return (
    ((24 * 60) / Math.PI) *
    GSC *
    dr *
    (ws * Math.sin(phi) * Math.sin(delta) + Math.cos(phi) * Math.cos(delta) * Math.sin(ws))
  );
}

/**
 * Hargreaves-Samani ET0 in mm per day (FAO-56 equation 52). Needs only daily
 * temperatures, which is why it is the default where POWER's radiation, humidity
 * and wind are incomplete.
 */
export function hargreavesEt0(latDeg: number, doy: number, tmaxC: number, tminC: number): number {
  const range = Math.max(tmaxC - tminC, 0);
  const tmean = (tmaxC + tminC) / 2;
  const ra = extraterrestrialRadiation(latDeg, doy);
  return Math.max(0, 0.0023 * (tmean + 17.8) * Math.sqrt(range) * 0.408 * ra);
}
