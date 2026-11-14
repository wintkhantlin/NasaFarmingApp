import { getCropById } from "../data/crops";
import type { Rotation, RuleScope } from "../types";

/**
 * Pest and disease rotation check. Uses host-family relationships from the crop library only.
 * NASA data cannot identify a disease or prove a rotation breaks its cycle, so weather is not used.
 */

export interface SequenceCheck {
  fromCropId: string | null;
  toCropId: string | null;
  fromName: string;
  toName: string;
  result: "different-family" | "same-family" | "unknown";
  text: string;
  scope: RuleScope | null;
  ref: string | null;
}

export function pestSequence(rotation: Pick<Rotation, "slots">): SequenceCheck[] {
  const crops = [...rotation.slots].filter((s) => s.kind !== "fallow").sort((a, b) => a.plantDate.localeCompare(b.plantDate));
  if (crops.length < 2) return [];
  const out: SequenceCheck[] = [];
  for (let i = 0; i < crops.length; i++) {
    const a = crops[i];
    const b = crops[(i + 1) % crops.length]; // the cycle wraps
    const ca = a.cropId ? getCropById(a.cropId) : undefined;
    const cb = b.cropId ? getCropById(b.cropId) : undefined;
    const fromName = ca?.names.common ?? "Unknown crop";
    const toName = cb?.names.common ?? "Unknown crop";
    if (!ca || !cb || !cb.profile) {
      out.push({ fromCropId: a.cropId ?? null, toCropId: b.cropId ?? null, fromName, toName, result: "unknown", text: "No rotation rule in the library for this pair.", scope: null, ref: null });
      continue;
    }
    const rule = cb.profile.rotationRules.find((r) => r.avoidAfterFamilies.includes(ca.family));
    if (rule) {
      out.push({ fromCropId: ca.id, toCropId: cb.id, fromName, toName, result: "same-family", text: `${toName} follows ${fromName}, both ${ca.family}. ${rule.reason}`, scope: rule.scope, ref: rule.ref });
    } else {
      out.push({
        fromCropId: ca.id,
        toCropId: cb.id,
        fromName,
        toName,
        result: "different-family",
        text: `${toName} (${cb.family}) follows ${fromName} (${ca.family}). Different families share fewer pests and diseases, but this does not prove the cycle is broken.`,
        scope: "analyst-assumption",
        ref: "General host-family rotation guidance; confirm local pest and disease advice.",
      });
    }
  }
  return out;
}

export interface DiseasePressureWarning {
  severity: "info" | "caution" | "warning";
  family: string;
  recurringCropNames: string[];
  seasonalSlotDescription: string;
  yearsOccurred: number[];
  message: string;
  recommendation: string;
}

function getSeasonName(month: number): { key: string; label: string } {
  if (month >= 9 && month <= 12) {
    return { key: "post-monsoon", label: "Post-monsoon dry season (Sep–Dec sowing)" };
  }
  if (month >= 1 && month <= 4) {
    return { key: "summer-pre-monsoon", label: "Pre-monsoon/summer season (Jan–Apr sowing)" };
  }
  return { key: "monsoon", label: "Monsoon season (May–Aug sowing)" };
}

/**
 * Detects recurring host crops in the same seasonal slot across multi-year cycles (Prompt 4, A-02).
 * Detects when the same family (e.g. Fabaceae/legumes) recurs in the same seasonal window across consecutive years.
 * If a multi-year non-host break crop is inserted, the consecutive warning is cleared or mitigated.
 * Does NOT diagnose specific pathogens or compute fictitious half-lives; provides honest agronomic warnings.
 */
export function detectMultiYearDiseasePressure(
  rotation: Pick<Rotation, "slots" | "cycleYears">,
): DiseasePressureWarning[] {
  const warnings: DiseasePressureWarning[] = [];
  const validSlots = rotation.slots
    .filter((s) => s.kind === "crop" && s.cropId)
    .sort((a, b) => a.plantDate.localeCompare(b.plantDate));

  if (validSlots.length < 2) return warnings;

  // Group slots by season
  const bySeason = new Map<string, Array<{ year: number; family: string; cropName: string }>>();

  for (const s of validSlots) {
    const crop = s.cropId ? getCropById(s.cropId) : undefined;
    if (!crop) continue;
    // Lowland flooded monsoon rice is an anaerobic wetland crop that breaks upland pathogens
    if (crop.id === "rice") continue;

    const month = parseInt(s.plantDate.slice(5, 7), 10);
    const year = parseInt(s.plantDate.slice(0, 4), 10);
    const season = getSeasonName(month);

    if (!bySeason.has(season.key)) {
      bySeason.set(season.key, []);
    }
    bySeason.get(season.key)!.push({
      year,
      family: crop.family,
      cropName: crop.names.common,
    });
  }

  for (const [seasonKey, seasonSlots] of bySeason.entries()) {
    if (seasonSlots.length < 2) continue;
    seasonSlots.sort((a, b) => a.year - b.year);

    // Look for consecutive years with the same family
    for (let i = 0; i < seasonSlots.length - 1; i++) {
      const cur = seasonSlots[i];
      const next = seasonSlots[i + 1];

      if (cur.family === next.family && next.year - cur.year <= 1) {
        const seasonInfo = getSeasonName(seasonKey === "post-monsoon" ? 10 : seasonKey === "summer-pre-monsoon" ? 2 : 6);
        warnings.push({
          severity: "caution",
          family: cur.family,
          recurringCropNames: Array.from(new Set([cur.cropName, next.cropName])),
          seasonalSlotDescription: seasonInfo.label,
          yearsOccurred: [cur.year, next.year],
          message: `Repeated cultivation of ${cur.family} (${cur.cropName}) in the ${seasonInfo.label.toLowerCase()} across consecutive years (${cur.year}–${next.year}). Continuous cropping of the same host family in the same seasonal window can elevate soil-borne root rots (Rhizoctonia, Fusarium) and root-knot nematodes over time.`,
          recommendation: "Consider introducing a non-host break crop (e.g., sesame, sunflower, or maize) in alternating years to reduce soil inoculum buildup.",
        });
      }
    }
  }

  return warnings;
}
