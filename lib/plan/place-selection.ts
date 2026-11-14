import { regionOfPoint } from "../data/regions";
import type { RegionId } from "../types";

export interface PlaceCandidate {
  id: string;
  name: string;
  context: string;
  lat: number;
  lon: number;
}

export interface PlaceOption extends PlaceCandidate {
  displayLabel: string;
  region: RegionId | "unsupported";
}

/** Always gives duplicate names a visible context; coordinates are the final fallback. */
export function disambiguatePlaces(candidates: readonly PlaceCandidate[]): PlaceOption[] {
  const counts = new Map<string, number>();
  for (const place of candidates) {
    const key = place.name.trim().toLocaleLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return candidates.map((place) => {
    const duplicate = (counts.get(place.name.trim().toLocaleLowerCase()) ?? 0) > 1;
    const coordinateContext = `${place.lat.toFixed(3)}, ${place.lon.toFixed(3)}`;
    const context = place.context.trim() || coordinateContext;
    return {
      ...place,
      region: regionOfPoint([place.lon, place.lat]),
      displayLabel: duplicate || place.context ? `${place.name} — ${context}` : place.name,
    };
  });
}
