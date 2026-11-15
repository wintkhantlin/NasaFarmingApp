import type { PriorityId, RegionId } from "../types";

export const PLAN_DRAFT_KEY = "fieldshift.plan-draft.v1";
export type InputState = "draft" | "confirmed" | "unknown" | "invalid" | "saved";
export type WaterChoice = "rain-only" | "occasional" | "reliable" | "unknown";
export type GoalChoice = "water" | "soil" | "income" | "forage" | "lower-inputs" | "risk" | "unknown";
export type NextPlantingPeriod = "monsoon" | "post-monsoon" | "dry-season" | "not-sure";
export type ResidueChoice = "kept" | "incorporated" | "mulched" | "removed" | "burned" | "unknown";
export type FeasibilityChoice = "available" | "unavailable" | "unknown";
export type RefinementKey = "sequence" | "water" | "goal" | "residue" | "feasibility";
export type FarmerDateInput = { kind: "exact"; date: string } | { kind: "dekad"; year: number; month: number; period: "early" | "mid" | "late" } | { kind: "unknown" };
export type TransitionMethod = "relay-standing-rice" | "post-harvest-no-till" | "post-harvest-tilled" | "intercrop" | "unknown";
export interface CropTransitionRecord {
  fromCropId: string;
  toCropId: string;
  method: TransitionMethod;
  previousHarvest: FarmerDateInput;
  nextSowing: FarmerDateInput;
}
export interface TopsoilObservation {
  fieldRef: string;
  feel: "very-wet" | "moist" | "dry" | "unknown";
  observedOn: FarmerDateInput;
  depthCm: number | null;
  texture: "sandy" | "loamy" | "clayey" | "unknown";
  context: "now" | "at-planting" | "remembered" | "unknown";
}
export interface PlanRefinements {
  sequence: { previousCropId: string | null; nextCropId: string | "fallow" | null; winterCropId: string | "fallow" | null; sowing: FarmerDateInput; harvest: FarmerDateInput; transition?: CropTransitionRecord; state: InputState };
  water: { value: WaterChoice; observation?: TopsoilObservation; state: InputState };
  goal: { value: GoalChoice; state: InputState };
  residue: { value: ResidueChoice; state: InputState };
  feasibility: { values: Record<"budget" | "machinery" | "labor" | "seed" | "buyers", FeasibilityChoice>; state: InputState };
}
export const emptyRefinements = (): PlanRefinements => ({
  sequence: { previousCropId: null, nextCropId: null, winterCropId: null, sowing: { kind: "unknown" }, harvest: { kind: "unknown" }, state: "unknown" },
  water: { value: "unknown", state: "unknown" }, goal: { value: "unknown", state: "unknown" },
  residue: { value: "unknown", state: "unknown" },
  feasibility: { values: { budget: "unknown", machinery: "unknown", labor: "unknown", seed: "unknown", buyers: "unknown" }, state: "unknown" },
});

export interface PlanDraftPlace {
  id: string;
  name: string;
  context: string;
  region: RegionId;
  source: "search" | "typed" | "gps";
  lat?: number;
  lon?: number;
}

export interface PlanDraft {
  version: 1 | 2;
  place: PlanDraftPlace | null;
  mainCropId: string | null;
  /** Regional planning context only. It never becomes a verified field date. */
  nextPlantingPeriod: NextPlantingPeriod;
  /** Most important first; consumed by the existing MCDA model after a field is confirmed. */
  priorityOrder: PriorityId[];
  updatedAt: string;
  revision: number;
  refinements: PlanRefinements;
}

const REGION_IDS = new Set<RegionId>(["ayeyarwady", "magway", "shan", "yangon", "myanmar"]);

export function emptyPlanDraft(): PlanDraft {
  return { version: 2, place: null, mainCropId: null, nextPlantingPeriod: "not-sure", priorityOrder: [], updatedAt: new Date(0).toISOString(), revision: 0, refinements: emptyRefinements() };
}

export function parsePlanDraft(value: unknown): PlanDraft | null {
  if (!value || typeof value !== "object") return null;
  const draft = value as Partial<PlanDraft>;
  if ((draft.version !== 1 && draft.version !== 2) || typeof draft.updatedAt !== "string") return null;
  if (draft.mainCropId !== null && draft.mainCropId !== undefined && typeof draft.mainCropId !== "string") return null;
  const nextPlantingPeriod = (["monsoon", "post-monsoon", "dry-season", "not-sure"] as const).includes(draft.nextPlantingPeriod as NextPlantingPeriod)
    ? draft.nextPlantingPeriod as NextPlantingPeriod
    : "not-sure";
  const priorityOrder = Array.isArray(draft.priorityOrder)
    ? draft.priorityOrder.filter((priority): priority is PriorityId => ["water", "soil", "income", "forage", "lower-inputs"].includes(String(priority)))
    : [];
  if (draft.place === null || draft.place === undefined) {
    return { version: 2, place: null, mainCropId: draft.mainCropId ?? null, nextPlantingPeriod, priorityOrder, updatedAt: draft.updatedAt, revision: validRevision(draft.revision), refinements: validRefinements(draft.refinements) };
  }
  const place = draft.place as Partial<PlanDraftPlace>;
  if (
    typeof place.id !== "string" ||
    typeof place.name !== "string" ||
    typeof place.context !== "string" ||
    !REGION_IDS.has(place.region as RegionId) ||
    !["search", "typed", "gps"].includes(place.source ?? "") ||
    (place.lat !== undefined && !Number.isFinite(place.lat)) ||
    (place.lon !== undefined && !Number.isFinite(place.lon))
  ) {
    return null;
  }
  return {
    version: 2,
    place: place as PlanDraftPlace,
    mainCropId: draft.mainCropId ?? null,
    nextPlantingPeriod,
    priorityOrder,
    updatedAt: draft.updatedAt,
    revision: validRevision(draft.revision),
    refinements: validRefinements(draft.refinements),
  };
}

const validRevision = (value: unknown) => Number.isSafeInteger(value) && (value as number) >= 0 ? value as number : 0;
function validRefinements(value: unknown): PlanRefinements {
  const empty = emptyRefinements();
  if (!value || typeof value !== "object") return empty;
  const v = value as Partial<PlanRefinements>;
  const states: InputState[] = ["draft", "confirmed", "unknown", "invalid", "saved"];
  const choice = <T extends string>(candidate: unknown, allowed: readonly T[], fallback: T): T => allowed.includes(candidate as T) ? candidate as T : fallback;
  const state = (candidate: unknown): InputState => choice(candidate, states, "unknown");
  const crops = (candidate: unknown) => typeof candidate === "string" && candidate.length < 80 ? candidate : null;
  const date = (candidate: unknown): FarmerDateInput => {
    if (!candidate || typeof candidate !== "object") return { kind: "unknown" };
    const d = candidate as Partial<FarmerDateInput>;
    if (d.kind === "exact" && typeof d.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d.date) && !Number.isNaN(Date.parse(d.date)) && new Date(d.date).toISOString().slice(0, 10) === d.date) return { kind: "exact", date: d.date };
    if (d.kind === "dekad" && Number.isInteger(d.year) && Number.isInteger(d.month) && (d.year as number) >= 1900 && (d.year as number) <= 2200 && (d.month as number) >= 1 && (d.month as number) <= 12 && ["early", "mid", "late"].includes(d.period ?? "")) return d as FarmerDateInput;
    return { kind: "unknown" };
  };
  return {
    sequence: { previousCropId: crops(v.sequence?.previousCropId), nextCropId: crops(v.sequence?.nextCropId), winterCropId: crops(v.sequence?.winterCropId), sowing: date(v.sequence?.sowing), harvest: date(v.sequence?.harvest),
      ...(v.sequence?.transition && typeof v.sequence.transition.fromCropId === "string" && typeof v.sequence.transition.toCropId === "string" ? { transition: {
        fromCropId: v.sequence.transition.fromCropId, toCropId: v.sequence.transition.toCropId,
        method: choice(v.sequence.transition.method, ["relay-standing-rice", "post-harvest-no-till", "post-harvest-tilled", "intercrop", "unknown"], "unknown"),
        previousHarvest: date(v.sequence.transition.previousHarvest), nextSowing: date(v.sequence.transition.nextSowing),
      } } : {}), state: state(v.sequence?.state) },
    water: { ...(v.water?.observation && typeof v.water.observation.fieldRef === "string" ? { observation: {
      fieldRef: v.water.observation.fieldRef,
      feel: choice(v.water.observation.feel, ["very-wet", "moist", "dry", "unknown"], "unknown"),
      observedOn: date(v.water.observation.observedOn),
      depthCm: typeof v.water.observation.depthCm === "number" && v.water.observation.depthCm >= 0 && v.water.observation.depthCm <= 100 ? v.water.observation.depthCm : null,
      texture: choice(v.water.observation.texture, ["sandy", "loamy", "clayey", "unknown"], "unknown"),
      context: choice(v.water.observation.context, ["now", "at-planting", "remembered", "unknown"], "unknown"),
    } } : {}), value: choice(v.water?.value, ["rain-only", "occasional", "reliable", "unknown"], "unknown"), state: state(v.water?.state) },
    goal: { value: choice(v.goal?.value, ["water", "soil", "income", "forage", "lower-inputs", "risk", "unknown"], "unknown"), state: state(v.goal?.state) },
    residue: { value: choice(v.residue?.value, ["kept", "incorporated", "mulched", "removed", "burned", "unknown"], "unknown"), state: state(v.residue?.state) },
    feasibility: { values: Object.fromEntries((Object.keys(empty.feasibility.values) as Array<keyof typeof empty.feasibility.values>).map(key => [key, choice(v.feasibility?.values?.[key], ["available", "unavailable", "unknown"], "unknown")])) as PlanRefinements["feasibility"]["values"], state: state(v.feasibility?.state) },
  };
}

export function readPlanDraft(storage: Pick<Storage, "getItem"> = localStorage): PlanDraft | null {
  try {
    const raw = storage.getItem(PLAN_DRAFT_KEY);
    return raw ? parsePlanDraft(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function writePlanDraft(draft: PlanDraft, storage: Pick<Storage, "setItem"> = localStorage): boolean {
  try {
    storage.setItem(PLAN_DRAFT_KEY, JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}
