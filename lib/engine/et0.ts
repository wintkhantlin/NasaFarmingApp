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

const SIGMA = 4.903e-9; // Stefan-Boltzmann, MJ K-4 m-2 day-1

const satVapourPressure = (tC: number) => 0.6108 * Math.exp((17.27 * tC) / (tC + 237.3));

export interface PenmanMonteithInput {
  latDeg: number;
  doy: number;
  elevationM: number;
  tmaxC: number;
  tminC: number;
  /** Daily mean air temperature. Defaults to (tmax + tmin) / 2. */
  tmeanC?: number;
  /** Mean relative humidity, %. Approximates actual vapour pressure: a disclosed simplification. */
  rhMeanPct: number;
  /** Wind speed at 2 m, m/s. */
  u2: number;
  /** Incoming shortwave, MJ m-2 day-1. This is not net radiation; net radiation is derived below. */
  rsMj: number;
  /** Surface pressure, kPa. Estimated from elevation when absent. */
  pressureKpa?: number;
  /** Actual vapour pressure, kPa. Overrides the RH-based value when the caller has RHmax and RHmin. */
  eaKpa?: number;
}

/**
 * FAO-56 Penman-Monteith reference evapotranspiration, mm per day (equation 6).
 * Net radiation is built from shortwave (equations 38 and 39) and clear-sky radiation (equation 37),
 * with no soil heat flux for a daily step. With only mean RH, actual vapour pressure is
 * es x RHmean / 100, which is an approximation; pass `eaKpa` when RHmax and RHmin are known.
 */
export function penmanMonteithEt0(i: PenmanMonteithInput): number {
  const tmean = i.tmeanC ?? (i.tmaxC + i.tminC) / 2;
  const p = i.pressureKpa ?? 101.3 * Math.pow((293 - 0.0065 * i.elevationM) / 293, 5.26);
  const gamma = 0.000665 * p;
  const delta = (4098 * satVapourPressure(tmean)) / Math.pow(tmean + 237.3, 2);
  const es = (satVapourPressure(i.tmaxC) + satVapourPressure(i.tminC)) / 2;
  const ea = i.eaKpa ?? (es * Math.min(100, Math.max(0, i.rhMeanPct))) / 100;

  const ra = extraterrestrialRadiation(i.latDeg, i.doy);
  const rso = (0.75 + 2e-5 * i.elevationM) * ra;
  const rns = (1 - 0.23) * i.rsMj;
  const ratio = rso > 0 ? Math.min(1, Math.max(0.3, i.rsMj / rso)) : 0.5;
  const rnl =
    SIGMA * ((Math.pow(i.tmaxC + 273.16, 4) + Math.pow(i.tminC + 273.16, 4)) / 2) * (0.34 - 0.14 * Math.sqrt(Math.max(ea, 0))) * (1.35 * ratio - 0.35);
  const rn = rns - rnl;

  const num = 0.408 * delta * rn + (gamma * 900 * i.u2 * (es - ea)) / (tmean + 273);
  const den = delta + gamma * (1 + 0.34 * i.u2);
  return Math.max(0, num / den);
}
