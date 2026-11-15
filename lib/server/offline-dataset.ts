import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { DailyWeather } from "../nasa/power";
import type { SoilProfile } from "../soil/soilgrids";

export interface ManifestWeatherCell {
  cellKey: string;
  coordinates: [number, number]; // [lat, lon]
  hubs: string[];
  recordsCount: number;
  file: string;
}

export interface ManifestSoilProfile {
  hub: string;
  region: string;
  coordinates: [number, number]; // [lat, lng]
  ph: number | null;
  texture: string | null;
  file: string;
}

export interface PredownloadManifest {
  window: { start: string; end: string };
  regions: string[];
  weatherCells: ManifestWeatherCell[];
  soilProfiles: ManifestSoilProfile[];
}

let cachedManifest: PredownloadManifest | null = null;

function resolvePredownloadFilePath(filePath: string): string {
  // Strip any leading prefix so we strictly stay inside data/predownload
  const clean = filePath.replace(/^(?:.*data\/predownload\/)?/, "");
  return join(process.cwd(), "data", "predownload", clean);
}

export async function getManifest(): Promise<PredownloadManifest | null> {
  if (cachedManifest) return cachedManifest;
  const manifestPath = join(process.cwd(), "data", "predownload", "manifest.json");
  if (!existsSync(manifestPath)) return null;
  try {
    const raw = await readFile(manifestPath, "utf8");
    cachedManifest = JSON.parse(raw) as PredownloadManifest;
    return cachedManifest;
  } catch {
    return null;
  }
}

/**
 * Finds the closest predownloaded NASA POWER weather cell within maxDistanceDeg (default ~1.5° ~160km).
 * Provides a dependable fallback on Vercel and offline environments.
 */
export async function getOfflineWeather(lat: number, lng: number, maxDistanceDeg = 1.5): Promise<DailyWeather | null> {
  const manifest = await getManifest();
  if (!manifest?.weatherCells?.length) return null;

  let bestCell: ManifestWeatherCell | null = null;
  let bestDist = Infinity;

  for (const cell of manifest.weatherCells) {
    const dLat = lat - cell.coordinates[0];
    const dLng = lng - cell.coordinates[1];
    const dist = Math.hypot(dLat, dLng);
    if (dist < bestDist) {
      bestDist = dist;
      bestCell = cell;
    }
  }

  if (!bestCell || bestDist > maxDistanceDeg) return null;

  const targetPath = resolvePredownloadFilePath(bestCell.file);
  if (!existsSync(targetPath)) return null;

  try {
    const raw = await readFile(targetPath, "utf8");
    const payload = JSON.parse(raw) as { weather: DailyWeather };
    if (!payload?.weather) return null;
    return {
      ...payload.weather,
      meta: {
        ...payload.weather.meta,
        sources: [...(payload.weather.meta?.sources ?? []), "Heartland Offline Pre-downloaded Archive"],
      },
    };
  } catch {
    return null;
  }
}

/**
 * Finds the closest predownloaded SoilGrids profile within maxDistanceDeg (default ~1.5° ~160km).
 * Provides a dependable fallback on Vercel and offline environments.
 */
export async function getOfflineSoil(lat: number, lng: number, maxDistanceDeg = 1.5): Promise<SoilProfile | null> {
  const manifest = await getManifest();
  if (!manifest?.soilProfiles?.length) return null;

  let bestSoil: ManifestSoilProfile | null = null;
  let bestDist = Infinity;

  for (const p of manifest.soilProfiles) {
    if (p.ph === null && p.texture === null) continue; // Skip empty/water entries
    const dLat = lat - p.coordinates[0];
    const dLng = lng - p.coordinates[1];
    const dist = Math.hypot(dLat, dLng);
    if (dist < bestDist) {
      bestDist = dist;
      bestSoil = p;
    }
  }

  if (!bestSoil || bestDist > maxDistanceDeg) return null;

  const targetPath = resolvePredownloadFilePath(bestSoil.file);
  if (!existsSync(targetPath)) return null;

  try {
    const raw = await readFile(targetPath, "utf8");
    const payload = JSON.parse(raw) as { profile: SoilProfile | null; hub: { name: string; region: string } };
    if (!payload?.profile) return null;
    return {
      ...payload.profile,
      source: {
        ...payload.profile.source,
        dataset: `${payload.profile.source.dataset} (Pre-downloaded Archive: ${payload.hub?.name ?? "Regional"})`,
      },
    };
  } catch {
    return null;
  }
}
