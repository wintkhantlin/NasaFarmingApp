import { getCropById } from "../data/crops";
import { REGIONS } from "../data/regions";
import type { ResidueFate, RotationSlot } from "../types";
import type { FarmerDateInput, PlanDraft } from "../store/plan-draft";

export type DateResolution = { kind: "exact"; date: string } | { kind: "interval"; from: string; to: string } | { kind: "unknown" };
export function resolveFarmerDate(input: FarmerDateInput): DateResolution {
  if (input.kind === "exact") return { kind: "exact", date: input.date };
  if (input.kind === "unknown") return { kind: "unknown" };
  if (!Number.isInteger(input.year) || input.year < 1900 || input.year > 2200 || !Number.isInteger(input.month) || input.month < 1 || input.month > 12) return { kind: "unknown" };
  const fromDay = input.period === "early" ? 1 : input.period === "mid" ? 11 : 21;
  const toDay = input.period === "early" ? 10 : input.period === "mid" ? 20 : new Date(Date.UTC(input.year, input.month, 0)).getUTCDate();
  const prefix = `${input.year}-${String(input.month).padStart(2, "0")}-`;
  return { kind: "interval", from: prefix + String(fromDay).padStart(2, "0"), to: prefix + String(toDay).padStart(2, "0") };
}

export type FieldAdapterResult =
  | { state: "ready"; revision: number; slot: Pick<RotationSlot, "cropId" | "plantDate" | "harvestDate" | "dateConfidence" | "residueFate" | "establishmentMode"> }
  | { state: "needs-input" | "not-evaluable" | "exact-date-needed" | "not-evaluated"; revision: number; reasons: string[] };

/** A Plan draft never writes a saved field. Only confirmed exact dates can enter the legacy slot contract. */
export function adaptPlanToFieldSlot(draft: PlanDraft): FieldAdapterResult {
  const revision = draft.revision;
  if (!draft.place || !draft.mainCropId || !REGIONS[draft.place.region].candidateCropIds.includes(draft.mainCropId) || !getCropById(draft.mainCropId))
    return { state: "not-evaluable", revision, reasons: ["Choose a supported main crop and area."] };
  const sequence = draft.refinements.sequence;
  if (sequence.state !== "confirmed" && sequence.state !== "saved")
    return { state: "needs-input", revision, reasons: ["Confirm your actual crop sequence first."] };
  const transition = sequence.transition;
  if (transition) {
    if (transition.fromCropId !== draft.mainCropId || transition.toCropId !== sequence.nextCropId)
      return { state: "not-evaluated", revision, reasons: ["Transition crops changed. Confirm the sowing method again."] };
    const assessment = assessRecordedTransition(transition);
    if (assessment.state !== "sequential") return { state: "not-evaluated", revision, reasons: [assessment.reason] };
  }
  const sowing = resolveFarmerDate(sequence.sowing);
  const harvest = resolveFarmerDate(sequence.harvest);
  if (sowing.kind !== "exact" || harvest.kind !== "exact")
    return { state: sowing.kind === "interval" || harvest.kind === "interval" ? "exact-date-needed" : "needs-input", revision, reasons: ["Exact planting and harvest dates are needed by the saved-field engine. Approximate and unknown dates remain recorded without conversion."] };
  const valid = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date;
  if (!valid(sowing.date) || !valid(harvest.date)) return { state: "not-evaluable", revision, reasons: ["Correct invalid dates before evaluation."] };
  if (sowing.date >= harvest.date) return { state: "not-evaluable", revision, reasons: ["Harvest must be after planting."] };
  return { state: "ready", revision, slot: { cropId: draft.mainCropId, plantDate: sowing.date, harvestDate: harvest.date, dateConfidence: "exact", residueFate: residueFateFor(draft.refinements.residue.value), establishmentMode: "unknown" } };
}

export function isCurrentResult(resultRevision: number | null, draft: PlanDraft): boolean {
  return resultRevision !== null && resultRevision === draft.revision;
}

/** Call when an asynchronous evaluator settles; older responses are discarded. */
export function acceptEvaluation<T>(response: { revision: number; value: T }, currentRevision: number): T | null {
  return response.revision === currentRevision ? response.value : null;
}

/** Kept alone does not tell us whether straw was incorporated or used as mulch. */
export function residueFateFor(value: string): ResidueFate {
  return value === "incorporated" ? "retain_incorporate" : value === "mulched" ? "retain_mulch" : value === "removed" ? "remove_fodder" : value === "burned" ? "burn" : "unknown";
}
export function assessRecordedTransition(t: import("../store/plan-draft").CropTransitionRecord): { state: "sequential" | "not-evaluated"; reason: string; overlap: { start: DateResolution; end: DateResolution } | null } {
  const end = resolveFarmerDate(t.previousHarvest);
  const start = resolveFarmerDate(t.nextSowing);
  const overlap = t.method === "relay-standing-rice" || t.method === "intercrop" ? { start, end } : null;
  if (overlap) return { state: "not-evaluated", reason: "Overlapping crops recorded; water/ET, disease and planting-window calculations are not evaluated. Relay hydrology is unverified. Check the practice locally; no universal waiting period applies.", overlap };
  if (t.method === "unknown" || start.kind !== "exact" || end.kind !== "exact") return { state: "not-evaluated", reason: "Sowing method or transition dates are unknown or approximate; sequential hydrology is not evaluated.", overlap };
  if (start.date <= end.date) return { state: "not-evaluated", reason: "These dates overlap or share a day. Correct the dates or record crops planted together.", overlap: { start, end } };
  return { state: "sequential", reason: "Recorded after harvest; seedbed suitability still needs a local moisture and drainage check.", overlap: null };
}
