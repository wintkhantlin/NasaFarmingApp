import { CROP_LIBRARY_VERSION, getCropById } from "../data/crops";
import { REGIONS } from "../data/regions";
import { TEMPLATES } from "../engine/candidates";
import type { RegionId } from "../types";

export type RegionalPreviewMode = "regional-preview";
export type PreviewEvidenceStatus = "catalogued-regional-example";
export type PreviewAvailability = "ready" | "fewer-patterns" | "templates-unavailable" | "invalid-crop";

export interface RegionalPreviewCatalogEntry {
  /** Must resolve to a real template in `lib/engine/candidates.ts`. */
  templateId: string;
}

/**
 * Versioned allow-list for the first-run preview.
 *
 * A crop/region pair is available only when it is explicitly listed here. Entries reference the
 * existing scientific template and crop libraries; they do not duplicate or synthesize rotations.
 * Missing, invalid or duplicate template references are dropped by `resolveRegionalPreview`.
 */
export interface RegionalPreviewCatalog {
  version: string;
  cropLibraryVersion: string;
  entries: Partial<Record<RegionId, Partial<Record<string, readonly RegionalPreviewCatalogEntry[]>>>>;
}

export interface RegionalPreviewPattern {
  id: string;
  cropIds: string[];
  crops: Array<{ id: string; english: string }>;
  rationale: string;
  limitation: string;
  evidenceStatus: PreviewEvidenceStatus;
  evidenceLabel: string;
  localCheck: string;
}

export interface RegionalPreviewResult {
  mode: RegionalPreviewMode;
  availability: PreviewAvailability;
  catalogVersion: string;
  cropLibraryVersion: string;
  patterns: RegionalPreviewPattern[];
  message: string;
}

export const REGIONAL_PREVIEW_CATALOG: RegionalPreviewCatalog = {
  version: "regional-preview-2026.11.1",
  cropLibraryVersion: CROP_LIBRARY_VERSION,
  entries: {
    ayeyarwady: {
      rice: [
        { templateId: "ay-rice-black-gram" },
        { templateId: "ay-rice-green-gram" },
        { templateId: "ay-rice-fallow" },
      ],
    },
    magway: {
      sesame: [{ templateId: "mg-sesame-green-gram" }],
      groundnut: [
        { templateId: "mg-groundnut-chickpea" },
        { templateId: "mg-groundnut-green-gram" },
      ],
      "pigeon-pea": [{ templateId: "mg-pigeon-pea-sesame" }],
    },
    shan: {
      maize: [
        { templateId: "sh-maize-soybean" },
        { templateId: "sh-maize-lablab" },
        { templateId: "sh-maize-sunn-hemp" },
      ],
    },
  },
};

const LIMITATION =
  "This is a project-authored regional pattern using typical crop calendars. It has not been checked for your field, variety, water access or local market.";
const LOCAL_CHECK =
  "Ask a local farmer or adviser whether these crops and their usual timing fit your village before changing a plan.";

export function resolveRegionalPreview(
  region: RegionId,
  mainCropId: string,
  catalog: RegionalPreviewCatalog = REGIONAL_PREVIEW_CATALOG,
): RegionalPreviewResult {
  const validCrop = REGIONS[region].candidateCropIds.includes(mainCropId) && getCropById(mainCropId)?.scope === "myanmar";
  if (!validCrop) {
    return {
      mode: "regional-preview",
      availability: "invalid-crop",
      catalogVersion: catalog.version,
      cropLibraryVersion: catalog.cropLibraryVersion,
      patterns: [],
      message: "That crop is not in the supported crop library for this region. Choose another crop.",
    };
  }

  const refs = catalog.entries[region]?.[mainCropId] ?? [];
  const seen = new Set<string>();
  const patterns: RegionalPreviewPattern[] = [];

  for (const ref of refs) {
    if (patterns.length === 3) break;
    const template = TEMPLATES[region].find((item) => item.id === ref.templateId);
    if (!template || template.cropIds[0] !== mainCropId) continue;
    const sequenceKey = template.cropIds.join(">");
    if (seen.has(sequenceKey)) continue;

    const crops = template.cropIds.map((cropId) => {
      if (cropId === "fallow") return { id: cropId, english: "Fallow" };
      const crop = getCropById(cropId);
      return crop ? { id: crop.id, english: crop.names.common } : null;
    });
    if (crops.some((crop) => crop === null)) continue;

    seen.add(sequenceKey);
    patterns.push({
      id: template.id,
      cropIds: [...template.cropIds],
      crops: crops as RegionalPreviewPattern["crops"],
      rationale: template.rationale,
      limitation: LIMITATION,
      evidenceStatus: "catalogued-regional-example",
      evidenceLabel: `Regional catalog ${catalog.version} · Crop library ${catalog.cropLibraryVersion}`,
      localCheck: LOCAL_CHECK,
    });
  }

  if (patterns.length === 0) {
    return {
      mode: "regional-preview",
      availability: "templates-unavailable",
      catalogVersion: catalog.version,
      cropLibraryVersion: catalog.cropLibraryVersion,
      patterns,
      message: "The catalog has no reviewed regional patterns for this area and main crop yet. We will not fill the gap with invented choices.",
    };
  }

  const availability = patterns.length < 3 ? "fewer-patterns" : "ready";
  return {
    mode: "regional-preview",
    availability,
    catalogVersion: catalog.version,
    cropLibraryVersion: catalog.cropLibraryVersion,
    patterns,
    message:
      availability === "fewer-patterns"
        ? `The catalog provides ${patterns.length} supported ${patterns.length === 1 ? "pattern" : "patterns"} for this selection. We have not added filler choices.`
        : "The catalog provides three distinct regional patterns for this selection.",
  };
}
