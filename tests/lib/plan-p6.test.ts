import { describe, expect, it } from "vitest";
import { resolveFarmerDate, assessRecordedTransition, adaptPlanToFieldSlot, residueFateFor } from "@/lib/plan/refinement-adapter";
import { emptyPlanDraft, parsePlanDraft, type CropTransitionRecord } from "@/lib/store/plan-draft";
import { compareRotations } from "@/lib/engine/compare";
import { engineData, rotation, slot, syntheticField, syntheticWeather } from "../helpers/synthetic";

const exact = (date: string) => ({ kind: "exact" as const, date });
const transition: CropTransitionRecord = { fromCropId: "rice", toCropId: "black-gram", method: "relay-standing-rice", previousHarvest: exact("2026-12-31"), nextSowing: exact("2026-12-23") };
describe("P6 intervals and practice records", () => {
  it("resolves leap years, month ends and year boundaries without a midpoint", () => {
    expect(resolveFarmerDate({ kind: "dekad", year: 2024, month: 2, period: "late" })).toEqual({ kind: "interval", from: "2024-02-21", to: "2024-02-29" });
    expect(resolveFarmerDate({ kind: "dekad", year: 2025, month: 2, period: "late" })).toMatchObject({ to: "2025-02-28" });
    expect(resolveFarmerDate({ kind: "dekad", year: 2026, month: 12, period: "late" })).toMatchObject({ to: "2026-12-31" });
    expect(resolveFarmerDate({ kind: "dekad", year: 2027, month: 1, period: "early" })).toMatchObject({ from: "2027-01-01", to: "2027-01-10" });
    expect(resolveFarmerDate({ kind: "dekad", year: 2027, month: 13, period: "early" }).kind).toBe("unknown");
  });
  it("round trips qualitative observations and true relay dates without numeric soil water", () => {
    const draft = emptyPlanDraft();
    draft.refinements.sequence.transition = transition;
    draft.refinements.water.observation = { fieldRef: "my-field", feel: "very-wet", observedOn: exact("2026-12-23"), depthCm: 5, texture: "clayey", context: "at-planting" };
    const parsed = parsePlanDraft(JSON.parse(JSON.stringify(draft)))!;
    expect(parsed.refinements.water.observation).toEqual(draft.refinements.water.observation);
    expect(parsed.refinements.sequence.transition).toEqual(transition);
    expect(JSON.stringify(parsed)).not.toMatch(/theta|initialStorage|depletionMm/);
  });
  it("distinguishes relay, intercrop, unknown and cross-year succession", () => {
    expect(assessRecordedTransition(transition)).toMatchObject({ state: "not-evaluated", overlap: { start: exact("2026-12-23"), end: exact("2026-12-31") } });
    expect(assessRecordedTransition({ ...transition, method: "intercrop" }).state).toBe("not-evaluated");
    expect(assessRecordedTransition({ ...transition, method: "unknown" }).state).toBe("not-evaluated");
    expect(assessRecordedTransition({ ...transition, method: "post-harvest-no-till", nextSowing: exact("2027-01-05") }).state).toBe("sequential");
  });
  it("requires exact dates only at the numerical adapter and preserves residue uncertainty", () => {
    const draft = emptyPlanDraft();
    draft.place = { id: "a", name: "Bogale", context: "Ayeyarwady", region: "ayeyarwady", source: "typed" };
    draft.mainCropId = "rice";
    draft.refinements.sequence = { ...draft.refinements.sequence, state: "confirmed", sowing: { kind: "dekad", year: 2026, month: 6, period: "early" }, harvest: exact("2026-12-31") };
    expect(adaptPlanToFieldSlot(draft).state).toBe("exact-date-needed");
    expect(residueFateFor("kept")).toBe("unknown");
    expect(residueFateFor("mulched")).toBe("retain_mulch");
  });
  it("prevents sequential hydrology and disease evaluation on actual overlap", () => {
    const field = syntheticField({ region: "ayeyarwady" });
    const mine = rotation(field.id, [slot("rice", "rice", "2026-06-01", "2026-11-01"), slot("pulse", "black-gram", "2026-10-25", "2027-02-01", { establishmentMode: "relay_broadcast" })]);
    const result = compareRotations(engineData(field, syntheticWeather()), mine);
    expect(result.current.slots.every(s => s.evaluationStatus === "not-evaluated" && s.rootZone === null && s.paddy === null && s.water === null && s.suitability === null)).toBe(true);
    expect(result.current.pest).toEqual([]);
    expect(result.current.metrics["water-shortfall"]).toBeNull();
  });
  it("keeps initial storage unknown even with water capacity and a wet hand-feel answer", () => {
    const field = syntheticField({ answers: [{ questionId: "soil-water-at-sowing", value: "wet", at: "2026-06-01" }] });
    const data = engineData(field, syntheticWeather());
    data.soil.awcMmPerM = { value: 120, from: "farmer", note: "Entered water capacity" };
    const mine = rotation(field.id, [slot("a", "sesame", "2026-06-01", "2026-09-01")]);
    const r = compareRotations(data, mine);
    expect(r.current.slots[0].rootZone).toMatchObject({ status: "unknown" });
    expect(JSON.stringify(r.current.slots[0].rootZone)).toContain("qualitative topsoil feel cannot initialize storage");
  });

});
