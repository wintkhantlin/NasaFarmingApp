import { getCropById } from "../data/crops";
import type { ResolvedRegion } from "../data/regions";
import type { Crop, FarmConstraints, RegionId, Rotation, RotationSlot } from "../types";
import { addDaysIso, daysBetween } from "./season";
import { inMonthDayWindow } from "./suitability";

/**
 * Candidate rotations. These are DEFINED alternatives written down by the project (region templates
 * built from the team's crop list). Satellite and weather data can support or challenge one; they do
 * not invent a strategy. Dates come from each crop's regional sowing window and typical cycle.
 */

export interface Template {
  id: string;
  label: string;
  headline: string;
  /** Why this combination is worth showing, in plain words. No performance claim. */
  rationale: string;
  cropIds: string[];
  requiresIrrigation?: boolean;
}

export const TEMPLATES: Record<RegionId, Template[]> = {
  myanmar: [],
  yangon: [],
  ayeyarwady: [
    { id: "ay-rice-black-gram", label: "Rice, then black gram", headline: "Rice, then black gram on the post-monsoon moisture", rationale: "Follows rice with a legume that is sown into the moisture left after the monsoon.", cropIds: ["rice", "black-gram"] },
    { id: "ay-rice-green-gram", label: "Rice, then green gram", headline: "Rice, then green gram", rationale: "Follows rice with a short-duration legume. Green gram is quick and can fit a short post-monsoon window.", cropIds: ["rice", "green-gram"] },
    { id: "ay-rice-fallow", label: "Rice, then fallow", headline: "Monsoon rice followed by fallow", rationale: "Monsoon rice followed by an intentional fallow period until the next monsoon season.", cropIds: ["rice", "fallow"] },
    { id: "ay-rice-irrigated-rice", label: "Rice, then irrigated rice", headline: "Monsoon rice, then irrigated summer rice", rationale: "Continuous double-rice cropping requiring confirmed dry-season irrigation access.", cropIds: ["rice", "rice"], requiresIrrigation: true },
    { id: "ay-rice-black-green", label: "Rice, black gram and green gram", headline: "Rice, then black gram in one cycle and green gram in the next", rationale: "Alternates two pulse species after rice so no single pulse is repeated every year.", cropIds: ["rice", "black-gram", "rice", "green-gram"] },
  ],
  magway: [
    { id: "mg-sesame-green-gram", label: "Sesame, then green gram", headline: "Sesame, then green gram", rationale: "Follows an oilseed with a short legume that is sown after the early rains.", cropIds: ["sesame", "green-gram"] },
    { id: "mg-groundnut-chickpea", label: "Groundnut, then chickpea", headline: "Groundnut, then chickpea on stored moisture", rationale: "Follows a rainy-season legume with a cool-season pulse that uses stored moisture.", cropIds: ["groundnut", "chickpea"] },
    { id: "mg-pigeon-pea-sesame", label: "Pigeon pea, then sesame", headline: "Pigeon pea one year, sesame the next", rationale: "A deep-rooting, drought-tolerant legume followed by an oilseed.", cropIds: ["pigeon-pea", "sesame"] },
    { id: "mg-groundnut-green-gram", label: "Groundnut, then green gram", headline: "Groundnut, then green gram", rationale: "Two legumes in sequence with different pest and disease profiles.", cropIds: ["groundnut", "green-gram"] },
  ],
  shan: [
    { id: "sh-maize-soybean", label: "Maize, then soybean", headline: "Maize, then soybean", rationale: "Alternates a cereal with a legume.", cropIds: ["maize", "soybean"] },
    { id: "sh-maize-lablab", label: "Maize, then lablab cover", headline: "Maize, then lablab as a cover crop", rationale: "Puts a cover crop on the ground after maize so the field is not bare in the late rains. A cover crop uses water and time.", cropIds: ["maize", "lablab"] },
    { id: "sh-groundnut-maize", label: "Groundnut, then maize", headline: "Groundnut, then maize", rationale: "Follows a legume with a cereal.", cropIds: ["groundnut", "maize"] },
    { id: "sh-maize-sunn-hemp", label: "Maize, then sunn hemp cover", headline: "Maize, then sunn hemp as a cover crop", rationale: "A fast green-manure cover after maize, if the sowing window is still open.", cropIds: ["maize", "sunn-hemp"] },
  ],
};

/** Longest wait between one crop and the next that still counts as a workable sequence. */
const MAX_WAIT_DAYS = 240;

function nextPlantDate(after: string, window: [string, string]): string {
  const mmdd = after.slice(5);
  if (inMonthDayWindow(mmdd, window[0], window[1])) return after;
  const y = Number(after.slice(0, 4));
  for (const year of [y, y + 1, y + 2]) {
    const d = `${year}-${window[0]}`;
    if (d >= after) return d;
  }
  return `${y + 2}-${window[0]}`;
}

export interface BuiltCandidate {
  rotation: Rotation;
  template: Template;
}

export interface RejectedCandidate {
  template: Template;
  reason: string;
}

export interface CandidateResult {
  alternatives: BuiltCandidate[];
  rejected: RejectedCandidate[];
  /** Set when fewer than two feasible alternatives could be offered. */
  shortfall: string | null;
}

function buildSlots(
  template: Template,
  region: RegionId,
  baseYear: number,
  constraints: FarmConstraints | undefined,
  irrigated: boolean,
): { slots: RotationSlot[]; cycleYears: 1 | 2 | 3 | 4; cycleDays: number } | { reason: string } {
  const slots: RotationSlot[] = [];
  let cursor: string | null = null;
  const crops: Crop[] = [];

  for (let i = 0; i < template.cropIds.length; i++) {
    const id = template.cropIds[i];
    if (id === "fallow") {
      if (cursor === null) return { reason: "Fallow cannot be the first slot in a template." };
      const plant = addDaysIso(cursor, 7);
      const firstCrop = crops[0];
      const firstCal = firstCrop?.profile?.regionalCalendars[region];
      const restart = firstCal ? nextPlantDate(plant, firstCal.sowWindow) : addDaysIso(plant, 180);
      const harvest = addDaysIso(restart, -1);
      slots.push({
        id: `${template.id}-${i}`,
        kind: "fallow",
        cropId: undefined,
        plantDate: plant,
        harvestDate: harvest,
        dateConfidence: "typical",
        irrigated: false,
        notes: "Field left fallow until the next planting window.",
      });
      cursor = harvest;
      continue;
    }

    const crop = getCropById(id);
    if (!crop?.profile) return { reason: `${id} is not in the crop library.` };
    crops.push(crop);

    let cal = crop.profile.regionalCalendars[region];
    // Secondary / summer rice window for irrigated double-rice in Ayeyarwady
    if (template.id === "ay-rice-irrigated-rice" && i === 1 && id === "rice") {
      cal = {
        sowWindow: ["01-15", "02-28"],
        durationDays: [105, 125],
        ref: "Summer irrigated paddy calendar in Ayeyarwady Delta",
        scope: "analyst-assumption",
      };
    }
    if (!cal) return { reason: `${crop.names.common} has no usual sowing window recorded for this region.` };

    const plant: string = cursor === null ? `${baseYear}-${cal.sowWindow[0]}` : nextPlantDate(addDaysIso(cursor, 7), cal.sowWindow);
    if (cursor !== null && daysBetween(cursor, plant) > MAX_WAIT_DAYS) {
      return { reason: `${crop.names.common} cannot be sown within ${MAX_WAIT_DAYS} days of the previous harvest (its window opens ${cal.sowWindow[0]}).` };
    }
    // the plant must still be inside this crop's own window
    if (!inMonthDayWindow(plant.slice(5), cal.sowWindow[0], cal.sowWindow[1])) {
      return { reason: `${crop.names.common} would be sown outside its usual ${cal.sowWindow[0]} to ${cal.sowWindow[1]} window.` };
    }
    if (constraints?.plantingWindow && !inMonthDayWindow(plant.slice(5), constraints.plantingWindow.from, constraints.plantingWindow.to)) {
      return { reason: `${crop.names.common} would be sown on ${plant.slice(5)}, outside your available planting window.` };
    }
    const harvest = addDaysIso(plant, crop.cycleDays.typ);
    const slotIrrigated = template.requiresIrrigation ? true : irrigated;
    slots.push({
      id: `${template.id}-${i}`,
      kind: crop.group === "cover" ? "cover" : "crop",
      cropId: crop.id,
      plantDate: plant,
      harvestDate: harvest,
      dateConfidence: "typical",
      irrigated: slotIrrigated,
      notes: `Typical dates from the usual ${cal.sowWindow[0]} to ${cal.sowWindow[1]} sowing window.`,
    });
    cursor = harvest;
  }

  // where the first crop would be sown again
  const firstCrop = crops[0];
  const firstCal = firstCrop?.profile?.regionalCalendars[region];
  const restart = firstCal ? nextPlantDate(addDaysIso(cursor as string, 7), firstCal.sowWindow) : (cursor as string);
  const occupiedCycleDays = Math.max(1, daysBetween(slots[0].plantDate, restart));
  const cycleYears = Math.min(4, Math.max(1, Math.ceil((occupiedCycleDays - 3) / 365))) as 1 | 2 | 3 | 4;
  return { slots, cycleYears, cycleDays: occupiedCycleDays };
}

/** Order-independent key for a crop sequence, so a template equal to the current rotation is dropped. */
export function sequenceKey(cropIds: string[]): string {
  if (cropIds.length === 0) return "";
  const rots = cropIds.map((_, i) => [...cropIds.slice(i), ...cropIds.slice(0, i)].join(">"));
  return rots.sort()[0];
}

export function generateCandidates(input: {
  fieldId: string;
  region: ResolvedRegion;
  current: Pick<Rotation, "slots">;
  constraints?: FarmConstraints;
  fieldIrrigation: "none" | "supplemental" | "full";
  baseYear: number;
  max?: number;
}): CandidateResult {
  if (input.region === "unsupported") {
    return { alternatives: [], rejected: [], shortfall: "This location is outside Ayeyarwady, Magway and Shan State, where the crop rules are available." };
  }
  const region = input.region;
  const currentKey = sequenceKey(input.current.slots.map((s) => s.kind === "fallow" ? "fallow" : (s.cropId as string)).filter(Boolean));
  const excluded = new Set(input.constraints?.excludedCropIds ?? []);
  const preferred = new Set(input.constraints?.preferredCropIds ?? []);

  const templates = [...TEMPLATES[region]].sort((a, b) => Number(b.cropIds.some((c) => preferred.has(c))) - Number(a.cropIds.some((c) => preferred.has(c))));
  const alternatives: BuiltCandidate[] = [];
  const rejected: RejectedCandidate[] = [];
  const max = input.max ?? 4;
  for (const t of templates) {
    if (sequenceKey(t.cropIds) === currentKey) continue; // it is the farmer's rotation already
    if (t.requiresIrrigation && input.fieldIrrigation === "none") {
      rejected.push({ template: t, reason: "An unavailable irrigation supply excludes irrigated rice." });
      continue;
    }
    const out = t.cropIds.find((c) => excluded.has(c));
    if (out) {
      rejected.push({ template: t, reason: `${getCropById(out)?.names.common ?? out} is on your excluded list.` });
      continue;
    }
    const built = buildSlots(t, region, input.baseYear, input.constraints, input.fieldIrrigation !== "none");
    if ("reason" in built) {
      rejected.push({ template: t, reason: built.reason });
      continue;
    }
    if (alternatives.length < max) {
      alternatives.push({
        template: t,
        rotation: {
          id: `strategy-${t.id}`,
          fieldId: input.fieldId,
          label: t.label,
          cycleYears: built.cycleYears,
          cycleDays: built.cycleDays,
          slots: built.slots,
          source: "strategy",
          strategyId: t.id,
        },
      });
    }
  }
  return {
    alternatives,
    rejected,
    shortfall: alternatives.length < 2 ? `Only ${alternatives.length} defined alternative${alternatives.length === 1 ? "" : "s"} fit your region and limits. The comparison needs at least two.` : null,
  };
}
