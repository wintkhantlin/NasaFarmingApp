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
    { id: "mg-sesame-sunflower", label: "Sesame, then winter sunflower", headline: "Sesame, then winter sunflower on late moisture", rationale: "Follows an early oilseed with a deep-rooting drought-resilient oilseed for local pressing.", cropIds: ["sesame", "sunflower"] },
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

/** Why a candidate is in the set even if it would not otherwise be: the set always tries to hold both. */
export type CandidateRole = "low-risk" | "low-input";

export interface BuiltCandidate {
  rotation: Rotation;
  template: Template;
  /** Set when this is the lowest-risk or lowest-input choice among everything that fit. Unset otherwise. */
  roles?: CandidateRole[];
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
  /** Feasible templates left out because they were near-copies of one already kept. Never ranked, never hidden. */
  similarDropped?: RejectedCandidate[];
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

/* ---------------- Choosing a varied set ---------------- */

/** Crops in a template, with fallow left out. */
const cropsOfTemplate = (t: Template) => [...new Set(t.cropIds.filter((c) => c !== "fallow"))];

/** 0 (same crops) to 1 (nothing in common), blending shared crops and shared crop families. */
export function templateDistance(a: Template, b: Template): number {
  const ca = new Set(cropsOfTemplate(a));
  const cb = new Set(cropsOfTemplate(b));
  const fa = new Set([...ca].map((c) => getCropById(c)?.family ?? c));
  const fb = new Set([...cb].map((c) => getCropById(c)?.family ?? c));
  const jac = (x: Set<string>, y: Set<string>) => {
    const union = new Set([...x, ...y]).size;
    if (union === 0) return 1;
    return [...x].filter((v) => y.has(v)).length / union;
  };
  // Fallow versus a crop is a real difference even though fallow has no family.
  const fallowDiff = a.cropIds.includes("fallow") !== b.cropIds.includes("fallow") ? 0.2 : 0;
  return Math.min(1, 1 - (0.6 * jac(ca, cb) + 0.4 * jac(fa, fb)) + fallowDiff);
}

/** Below this distance two templates are treated as near-copies (for example two pulses after the same rice). */
export const NEAR_DUPLICATE_DISTANCE = 0.45;

/** External nitrogen the crops need per year, from the library. Null when a crop is not in it. */
function nitrogenPerYear(c: BuiltCandidate): number | null {
  let total = 0;
  for (const s of c.rotation.slots) {
    if (s.kind === "fallow" || !s.cropId) continue;
    const crop = getCropById(s.cropId);
    if (!crop) return null;
    total += crop.nDemandKgHa;
  }
  return total / Math.max(1, c.rotation.cycleYears);
}

/** Average drought tolerance (1 sensitive to 5 tolerant) of the crops. Fallow has no crop to fail. */
function droughtToleranceOf(c: BuiltCandidate): number | null {
  const tol = c.rotation.slots
    .filter((s) => s.kind !== "fallow" && s.cropId)
    .map((s) => getCropById(s.cropId as string)?.water.droughtTolerance)
    .filter((v): v is NonNullable<typeof v> => v !== undefined);
  return tol.length === 0 ? null : tol.reduce((a, b) => a + b, 0) / tol.length;
}

/**
 * Picks up to `max` candidates so the farmer sees different choices, not variations of one.
 * Rules, in order: keep the farmer's preferred crops first; keep the lowest-input and the lowest-risk option when
 * any exists (risk here is a rain-fed plan of drought-tolerant crops, since weather replay has not run yet);
 * fill the rest by taking the option least like those already chosen. When nothing needs dropping the order is
 * untouched, so this changes a result only where the old rule cut a candidate by list position.
 */
export function selectDiverse(built: BuiltCandidate[], max: number, preferred: Set<string>): { kept: BuiltCandidate[]; dropped: Array<{ candidate: BuiltCandidate; similarTo: BuiltCandidate }> } {
  const withRoles = built.map((c) => ({ ...c, roles: [] as CandidateRole[] }));
  const scored = withRoles.map((c) => ({ c, n: nitrogenPerYear(c), d: droughtToleranceOf(c) }));
  const lowInput = scored.filter((x) => x.n !== null).sort((a, b) => (a.n as number) - (b.n as number))[0];
  const lowRisk = scored
    .filter((x) => x.d !== null && !x.c.template.requiresIrrigation)
    .sort((a, b) => (b.d as number) - (a.d as number) || (a.n ?? Infinity) - (b.n ?? Infinity))[0];
  // A role is only worth naming when it actually sets the option apart from the rest.
  if (lowInput && scored.some((x) => x !== lowInput && x.n !== null && (x.n as number) > (lowInput.n as number) + 1e-9)) lowInput.c.roles.push("low-input");
  if (lowRisk && scored.some((x) => x !== lowRisk && x.d !== null && (x.d as number) < (lowRisk.d as number) - 1e-9)) lowRisk.c.roles.push("low-risk");

  if (withRoles.length <= max) return { kept: withRoles.map((c) => (c.roles.length ? c : { rotation: c.rotation, template: c.template })), dropped: [] };

  const wantsPreferred = (c: BuiltCandidate) => c.template.cropIds.some((id) => preferred.has(id));
  const chosen: BuiltCandidate[] = [];
  const add = (c: BuiltCandidate) => {
    if (!chosen.includes(c)) chosen.push(c);
  };
  // 1. The two roles first (at most two places), then preferred crops, while there is room.
  for (const c of withRoles.filter((x) => x.roles.length > 0)) if (chosen.length < max) add(c);
  for (const c of withRoles.filter(wantsPreferred)) if (chosen.length < max) add(c);
  // 2. Fill with the option furthest from everything already chosen; the old list order breaks ties.
  while (chosen.length < max) {
    const rest = withRoles.filter((c) => !chosen.includes(c));
    if (rest.length === 0) break;
    const far = (c: BuiltCandidate) => (chosen.length === 0 ? 1 : Math.min(...chosen.map((k) => templateDistance(c.template, k.template))));
    rest.sort((a, b) => far(b) - far(a) || withRoles.indexOf(a) - withRoles.indexOf(b));
    add(rest[0]);
  }
  const kept = withRoles.filter((c) => chosen.includes(c)).map((c) => (c.roles.length ? c : { rotation: c.rotation, template: c.template }));
  const dropped = withRoles
    .filter((c) => !chosen.includes(c))
    .map((c) => {
      const near = [...chosen].sort((a, b) => templateDistance(c.template, a.template) - templateDistance(c.template, b.template))[0];
      return { candidate: { rotation: c.rotation, template: c.template }, similarTo: near };
    });
  return { kept, dropped };
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
  const feasible: BuiltCandidate[] = [];
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
    feasible.push({
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
  const { kept, dropped } = selectDiverse(feasible, max, preferred);
  const alternatives = kept;
  const similarDropped: RejectedCandidate[] = dropped.map((d) => ({
    template: d.candidate.template,
    reason:
      templateDistance(d.candidate.template, d.similarTo.template) < NEAR_DUPLICATE_DISTANCE
        ? `Left out because it is very like "${d.similarTo.template.label}".`
        : "Left out to keep the choices different from each other.",
  }));
  return {
    alternatives,
    rejected,
    similarDropped,
    shortfall: alternatives.length < 2 ? `Only ${alternatives.length} defined alternative${alternatives.length === 1 ? "" : "s"} fit your region and limits. The comparison needs at least two.` : null,
  };
}
