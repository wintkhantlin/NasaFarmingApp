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
