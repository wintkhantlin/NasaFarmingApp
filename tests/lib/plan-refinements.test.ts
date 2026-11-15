import { describe, expect, it } from "vitest";
import { acceptEvaluation, adaptPlanToFieldSlot, isCurrentResult, resolveFarmerDate } from "@/lib/plan/refinement-adapter";
import { emptyPlanDraft, parsePlanDraft, PLAN_DRAFT_KEY, readPlanDraft, writePlanDraft } from "@/lib/store/plan-draft";

const place = { id: "typed:ayeyarwady:bogale", name: "Bogale", context: "Ayeyarwady", region: "ayeyarwady" as const, source: "typed" as const };

describe("Plan refinement persistence and field adapter", () => {
  it("migrates a legacy v1 draft without changing its crop or requiring dates", () => {
    const migrated = parsePlanDraft({ version: 1, place, mainCropId: "rice", updatedAt: "2026-11-15" });
    expect(migrated).toMatchObject({ version: 2, mainCropId: "rice", revision: 0, refinements: { sequence: { sowing: { kind: "unknown" } } } });
    expect(adaptPlanToFieldSlot(migrated!).state).toBe("needs-input");
  });
  it("round trips refinements in the existing browser key", () => {
    const store = new Map<string, string>();
    const draft = { ...emptyPlanDraft(), place, mainCropId: "rice", revision: 3, refinements: { ...emptyPlanDraft().refinements, water: { value: "occasional" as const, state: "saved" as const } } };
    expect(writePlanDraft(draft, { setItem: (key, value) => { store.set(key, value); } })).toBe(true);
    expect(readPlanDraft({ getItem: key => store.get(key) ?? null })).toMatchObject({ revision: 3, refinements: { water: { value: "occasional", state: "saved" } } });
    expect(store.has(PLAN_DRAFT_KEY)).toBe(true);
  });
  it("retains dekad as an interval and unknown as unknown", () => {
    expect(resolveFarmerDate({ kind: "dekad", year: 2026, month: 10, period: "late" })).toEqual({ kind: "interval", from: "2026-10-21", to: "2026-10-31" });
    expect(resolveFarmerDate({ kind: "unknown" })).toEqual({ kind: "unknown" });
  });
  it("maps only confirmed exact dates and rejects invalid order", () => {
    const base = { ...emptyPlanDraft(), place, mainCropId: "rice" };
    const sequence = { ...base.refinements.sequence, state: "confirmed" as const, sowing: { kind: "exact" as const, date: "2026-06-01" }, harvest: { kind: "exact" as const, date: "2026-10-01" } };
    expect(adaptPlanToFieldSlot({ ...base, refinements: { ...base.refinements, sequence } })).toMatchObject({ state: "ready", slot: { plantDate: "2026-06-01", harvestDate: "2026-10-01" } });
    expect(adaptPlanToFieldSlot({ ...base, refinements: { ...base.refinements, sequence: { ...sequence, harvest: { kind: "unknown" } } } }).state).toBe("needs-input");
    expect(adaptPlanToFieldSlot({ ...base, refinements: { ...base.refinements, sequence: { ...sequence, harvest: { kind: "exact", date: "2026-05-01" } } } }).state).toBe("not-evaluable");
  });
  it("invalidates a result revision after any meaningful edit", () => {
    const draft = { ...emptyPlanDraft(), revision: 4 };
    expect(isCurrentResult(4, draft)).toBe(true);
    expect(isCurrentResult(4, { ...draft, revision: 5 })).toBe(false);
    expect(acceptEvaluation({ revision: 4, value: "old result" }, 5)).toBeNull();
    expect(acceptEvaluation({ revision: 5, value: "current result" }, 5)).toBe("current result");
  });
});
