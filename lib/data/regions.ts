import { pointInPolygon } from "../geo/shapes";
import type { FieldGeometry, LngLat, RegionId } from "../types";
import { REGION_BOUNDARIES } from "./region-boundaries";
import nationalBoundary from "./myanmar-boundary.json";
import yangonBoundary from "./yangon-boundary.json";

// Simplified 2019 ADM1 geometry from geoBoundaries MMR, gbOpen (CC BY 4.0).
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
  myanmar: {
    id: "myanmar", name: "Elsewhere in Myanmar", focus: "Field history supported; regional crop templates not yet available",
    candidateCropIds: [
      "rice", "black-gram", "green-gram", "sesame", "groundnut", "sunflower", "chickpea", "pigeon-pea",
      "maize", "soybean", "lablab", "sunn-hemp", "cotton", "chili", "onion", "garlic", "potato",
      "tomato", "sugarcane", "cassava", "mustard", "butter-bean", "cabbage",
    ],
  },
  ayeyarwady: {
    id: "ayeyarwady",
    name: "Ayeyarwady",
    focus: "Rice-based systems and post-monsoon moisture",
    candidateCropIds: ["rice", "black-gram", "green-gram", "chili", "cassava", "tomato"],
  },
  magway: {
    id: "magway",
    name: "Magway",
    focus: "Dry-zone water limitations",
    candidateCropIds: ["sesame", "groundnut", "sunflower", "green-gram", "chickpea", "pigeon-pea", "cotton", "onion", "chili", "butter-bean", "mustard"],
    resolvedCategories: { pulses: ["green-gram", "chickpea", "pigeon-pea", "butter-bean"] },
  },
  shan: {
    id: "shan",
    name: "Shan State",
    focus: "Highland soils, slope and erosion",
    candidateCropIds: ["maize", "soybean", "lablab", "sunn-hemp", "potato", "garlic", "tomato", "cabbage", "mustard"],
    resolvedCategories: { "cover crops": ["lablab", "sunn-hemp"] },
  },
  yangon: {
    id: "yangon",
    name: "Yangon Region",
    focus: "Location recognized; no trusted regional crop comparison catalog yet",
    candidateCropIds: [],
  },
};

export const REGION_IDS: RegionId[] = ["ayeyarwady", "magway", "shan", "yangon", "myanmar"];

export type ResolvedRegion = RegionId | "unsupported";

const asRings = (polygon: number[][][]): LngLat[][] => polygon as unknown as LngLat[][];

export function regionOfPoint(point: LngLat): ResolvedRegion {
  for (const polygon of yangonBoundary.coordinates) {
    if (pointInPolygon(point, asRings(polygon))) return "yangon";
  }
  for (const id of REGION_IDS) {
    if (id === "myanmar" || id === "yangon") continue;
    for (const polygon of REGION_BOUNDARIES[id]) {
      if (pointInPolygon(point, asRings(polygon))) return id;
    }
  }
  for (const feature of nationalBoundary.features) {
    const geometry = feature.geometry;
    const polygons = geometry.type === "MultiPolygon" ? geometry.coordinates : [geometry.coordinates];
    for (const polygon of polygons) if (pointInPolygon(point, polygon as unknown as LngLat[][])) return "myanmar";
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
  return region && region !== "unsupported" ? REGIONS[region].name : "Region not listed";
}
