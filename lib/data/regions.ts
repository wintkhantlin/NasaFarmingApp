import { pointInPolygon } from "../geo/shapes";
import type { FieldGeometry, LngLat, RegionId } from "../types";
import { REGION_BOUNDARIES } from "./region-boundaries";

export interface RegionInfo {
  id: RegionId;
  name: string;
  /** What the research is looking at in this region (from the team brief). */
  focus: string;
  /** Candidate crops from the brief. "pulses" and "cover crops" are resolved to species ids. */
  candidateCropIds: string[];
  /** The brief's wording for the categories that were resolved to species. */
  resolvedCategories?: Record<string, string[]>;
}

export const REGIONS: Record<RegionId, RegionInfo> = {
  ayeyarwady: {
    id: "ayeyarwady",
    name: "Ayeyarwady",
    focus: "Rice-based systems and post-monsoon moisture",
    candidateCropIds: ["rice", "black-gram", "green-gram"],
  },
  magway: {
    id: "magway",
    name: "Magway",
    focus: "Dry-zone water limitations",
    candidateCropIds: ["sesame", "groundnut", "green-gram", "chickpea", "pigeon-pea"],
    resolvedCategories: { pulses: ["green-gram", "chickpea", "pigeon-pea"] },
  },
  shan: {
    id: "shan",
    name: "Shan State",
    focus: "Highland soils, slope and erosion",
    candidateCropIds: ["maize", "soybean", "lablab", "sunn-hemp"],
    resolvedCategories: { "cover crops": ["lablab", "sunn-hemp"] },
  },
};

export const REGION_IDS = Object.keys(REGIONS) as RegionId[];

export type ResolvedRegion = RegionId | "unsupported";

const asRings = (polygon: number[][][]): LngLat[][] => polygon as unknown as LngLat[][];

export function regionOfPoint(point: LngLat): ResolvedRegion {
  for (const id of REGION_IDS) {
    for (const polygon of REGION_BOUNDARIES[id]) {
      if (pointInPolygon(point, asRings(polygon))) return id;
    }
  }
  return "unsupported";
}

export interface RegionCheck {
  region: ResolvedRegion;
  /** True when the outline has corners in more than one region (or outside). */
  straddlesBoundary: boolean;
}

/**
 * Which supported region a field is in. A polygon uses its centroid and also reports whether any
 * corner falls somewhere else, so the screen can warn. A region is never turned into a coordinate.
 */
export function checkRegion(geometry: FieldGeometry, center: LngLat): RegionCheck {
  const region = regionOfPoint(center);
  if (geometry.type === "Point") return { region, straddlesBoundary: false };
  const corners = geometry.coordinates[0];
  const straddlesBoundary = corners.some((c) => regionOfPoint(c) !== region);
  return { region, straddlesBoundary };
}

export function regionName(region: ResolvedRegion | undefined): string {
  return region && region !== "unsupported" ? REGIONS[region].name : "Outside the supported regions";
}
