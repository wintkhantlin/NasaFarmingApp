/**
 * ISRIC SoilGrids v2 adapter (https://rest.isric.org). Not a NASA dataset:
 * the UI labels it as such. No API key.
 *
 * Findings from the Phase 0 spike: a point can come back with every value
 * null (urban areas, water), and an 8-property request can take 12 seconds.
 * A null profile is a normal result, not an error.
 */

import type { TextureClass } from "../types";
import { fetchWithRetry } from "../network/fetch-with-retry";

export const SOIL_PROPERTIES = ["clay", "sand", "silt", "phh2o", "soc", "cec", "bdod", "nitrogen", "wv0033", "wv1500"] as const;

/**
 * Bump when the shape of a stored profile changes, so cached profiles without the new fields are not
 * served as if they were complete. Used in the server and pre-download cache keys.
 */
export const SOILGRIDS_SCHEMA = "wrc-1";
export type SoilProperty = (typeof SOIL_PROPERTIES)[number];

const DEPTHS = [
  { label: "0-5cm", thickness: 5 },
  { label: "5-15cm", thickness: 10 },
  { label: "15-30cm", thickness: 15 },
] as const;

export interface SoilProfile {
  /** Thickness-weighted means over 0 to 30 cm. null where SoilGrids has no value. */
  clayPct: number | null;
  sandPct: number | null;
  siltPct: number | null;
  ph: number | null;
  /** Soil organic carbon, g per kg. */
  socGKg: number | null;
  /** Cation exchange capacity, cmol(c) per kg. */
  cecCmolKg: number | null;
  /** Bulk density of the fine earth, kg per dm3. */
  bulkDensityKgDm3: number | null;
  /** Total nitrogen, g per kg. */
  nitrogenGKg: number | null;
  /** Volumetric water content at -33 kPa (field capacity), m3/m3, 0 to 30 cm. SoilGrids water-retention layer wv0033. */
  fieldCapacityFrac: number | null;
  /** Volumetric water content at -1500 kPa (wilting point), m3/m3, 0 to 30 cm. SoilGrids layer wv1500. */
  wiltingPointFrac: number | null;
  texture: TextureClass | null;
  source: { dataset: string; resolution: string; depth: string };
}

export function soilGridsUrl(lat: number, lon: number): string {
  const q = new URLSearchParams();
  q.set("lon", lon.toFixed(5));
  q.set("lat", lat.toFixed(5));
  for (const p of SOIL_PROPERTIES) q.append("property", p);
  for (const d of DEPTHS) q.append("depth", d.label);
  q.set("value", "mean");
  return `https://rest.isric.org/soilgrids/v2.0/properties/query?${q.toString()}`;
}

/** USDA texture class from sand, silt and clay percentages. */
export function usdaTexture(sand: number, silt: number, clay: number): TextureClass {
  if (silt + 1.5 * clay < 15) return "sand";
  if (silt + 1.5 * clay >= 15 && silt + 2 * clay < 30) return "loamy sand";
  if (
    (clay >= 7 && clay < 20 && sand > 52 && silt + 2 * clay >= 30) ||
    (clay < 7 && silt < 50 && silt + 2 * clay >= 30)
  )
    return "sandy loam";
  if (clay >= 7 && clay < 27 && silt >= 28 && silt < 50 && sand <= 52) return "loam";
  if ((silt >= 50 && clay >= 12 && clay < 27) || (silt >= 50 && silt < 80 && clay < 12)) return "silt loam";
  if (silt >= 80 && clay < 12) return "silt";
  if (clay >= 20 && clay < 35 && silt < 28 && sand > 45) return "sandy clay loam";
  if (clay >= 27 && clay < 40 && sand > 20 && sand <= 45) return "clay loam";
  if (clay >= 27 && clay < 40 && sand <= 20) return "silty clay loam";
  if (clay >= 35 && sand > 45) return "sandy clay";
  if (clay >= 40 && silt >= 40) return "silty clay";
  if (clay >= 40 && sand <= 45 && silt < 40) return "clay";
  return "loam";
}

type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);

/** Weighted mean over the depth layers that have a value, or null. */
function layerMean(layer: Json): number | null {
  const unit = isObj(layer.unit_measure) ? layer.unit_measure : {};
  const dFactor = typeof unit.d_factor === "number" && unit.d_factor > 0 ? unit.d_factor : 1;
  const depths = Array.isArray(layer.depths) ? layer.depths : [];
  let sum = 0;
  let weight = 0;
  for (const d of DEPTHS) {
    const entry = depths.find((x) => isObj(x) && x.label === d.label);
    const mean = isObj(entry) && isObj(entry.values) ? entry.values.mean : null;
    if (typeof mean === "number" && Number.isFinite(mean)) {
      sum += (mean / dFactor) * d.thickness;
      weight += d.thickness;
    }
  }
  return weight > 0 ? sum / weight : null;
}

/**
 * A water-retention layer as a volumetric fraction. The API reports these in 10^-2 cm3/cm3 (percent by
 * volume) after dividing by its own d_factor, so 304 raw with d_factor 10 is 30.4 %, or 0.304 m3/m3.
 * A layer in any other unit is refused rather than rescaled by guesswork.
 */
function retentionFraction(layer: Json): number | null {
  const unit = isObj(layer.unit_measure) ? layer.unit_measure : {};
  const target = typeof unit.target_units === "string" ? unit.target_units.replace(/\s/g, "") : "";
  if (!/^10[-\u2212\u207b]2cm[3\u00b3]\/cm[3\u00b3]$/.test(target)) return null;
  const pct = layerMean(layer);
  if (pct === null) return null;
  const frac = pct / 100;
  return frac > 0 && frac < 1 ? frac : null;
}

/** null when the response has no usable value at all. */
export function parseSoilGrids(json: unknown): SoilProfile | null {
  if (!isObj(json) || !isObj(json.properties) || !Array.isArray(json.properties.layers)) {
    throw new Error("Unexpected SoilGrids response.");
  }
  const byName = new Map<string, number | null>();
  for (const layer of json.properties.layers) {
    if (isObj(layer) && typeof layer.name === "string") byName.set(layer.name, layerMean(layer));
  }
  const get = (n: SoilProperty) => byName.get(n) ?? null;
  const retention = new Map<string, number | null>();
  for (const layer of json.properties.layers) {
    if (isObj(layer) && (layer.name === "wv0033" || layer.name === "wv1500")) retention.set(layer.name, retentionFraction(layer));
  }
  const values = SOIL_PROPERTIES.filter((n) => n !== "wv0033" && n !== "wv1500").map(get);
  if (values.every((v) => v === null)) return null;

  const clay = get("clay");
  const sand = get("sand");
  const silt = get("silt");
  return {
    clayPct: clay,
    sandPct: sand,
    siltPct: silt,
    ph: get("phh2o"),
    socGKg: get("soc"),
    cecCmolKg: get("cec"),
    bulkDensityKgDm3: get("bdod"),
    nitrogenGKg: get("nitrogen"),
    fieldCapacityFrac: retention.get("wv0033") ?? null,
    wiltingPointFrac: retention.get("wv1500") ?? null,
    texture: clay !== null && sand !== null && silt !== null ? usdaTexture(sand, silt, clay) : null,
    source: { dataset: "ISRIC SoilGrids v2", resolution: "250 m", depth: "0 to 30 cm" },
  };
}

export async function fetchSoilGrids(
  lat: number,
  lon: number,
  opts: { fetch?: typeof fetch; signal?: AbortSignal } = {},
): Promise<SoilProfile | null> {
  const res = await fetchWithRetry(
    soilGridsUrl(lat, lon),
    {
      headers: { accept: "application/json" },
      signal: opts.signal ?? AbortSignal.timeout(25_000),
    },
    { signal: opts.signal, maxRetries: 2, initialDelayMs: 400 },
    opts.fetch ?? fetch,
  );
  if (!res.ok) throw new Error(`SoilGrids answered ${res.status}.`);
  return parseSoilGrids(await res.json());
}
