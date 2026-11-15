import type { LngLat } from "../types";

/** Mapbox Geocoding API v6 (forward). Needs a public token. */

export interface Place {
  id: string;
  name: string;
  /** The rest of the address, e.g. "Magway Region, Myanmar". */
  context: string;
  center: LngLat;
  /** [west, south, east, north], when the place is an area. */
  bbox: [number, number, number, number] | null;
}

export function geocodeUrl(query: string, token: string, limit = 5): string {
  const q = new URLSearchParams({
    q: query.trim(),
    access_token: token,
    limit: String(limit),
    types: "country,region,district,place,locality,neighborhood,postcode,address",
    country: "MM",
  });
  return `https://api.mapbox.com/search/geocode/v6/forward?${q.toString()}`;
}

type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

export function parseGeocode(json: unknown): Place[] {
  if (!isObj(json) || !Array.isArray(json.features)) return [];
  const places: Place[] = [];
  for (const f of json.features) {
    if (!isObj(f) || !isObj(f.geometry) || !isObj(f.properties)) continue;
    const c = f.geometry.coordinates;
    if (!Array.isArray(c) || !isNum(c[0]) || !isNum(c[1])) continue;
    const p = f.properties;
    const bb = p.bbox;
    places.push({
      id: typeof p.mapbox_id === "string" ? p.mapbox_id : `${c[0]},${c[1]}`,
      name: typeof p.name === "string" ? p.name : "Unnamed place",
      context: typeof p.place_formatted === "string" ? p.place_formatted : "",
      center: [c[0], c[1]],
      bbox: Array.isArray(bb) && bb.length === 4 && bb.every(isNum) ? [bb[0], bb[1], bb[2], bb[3]] : null,
    });
  }
  return places;
}

export async function searchPlaces(query: string, token: string, signal?: AbortSignal): Promise<Place[]> {
  if (query.trim().length < 2) return [];
  const res = await fetch(geocodeUrl(query, token), { signal });
  if (!res.ok) throw new Error(`Place search answered ${res.status}.`);
  return parseGeocode(await res.json());
}
