import type { LngLat } from "../types";

/** "42.030° N", "93.620° W". */
export function formatLat(lat: number): string {
  return `${Math.abs(lat).toFixed(3)}° ${lat >= 0 ? "N" : "S"}`;
}

export function formatLng(lng: number): string {
  return `${Math.abs(lng).toFixed(3)}° ${lng >= 0 ? "E" : "W"}`;
}

export function formatPoint([lng, lat]: LngLat): string {
  return `${formatLat(lat)}, ${formatLng(lng)}`;
}

/** Parses a typed coordinate. Returns null for anything that isn't a number in range. */
export function parseCoordinate(text: string, limit: 90 | 180): number | null {
  const trimmed = text.trim().replace(",", ".");
  if (trimmed === "") return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || Math.abs(n) > limit) return null;
  return n;
}
