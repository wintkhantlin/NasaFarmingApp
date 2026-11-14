/** @vitest-environment jsdom */
import { describe, it, expect, vi } from "vitest";
vi.mock("@/lib/store/storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/store/storage")>();
  const storage = actual.memoryStorage();
  return { ...actual, indexedDbStorage: () => storage };
});
import { useFieldsStore } from "@/lib/store/fields-store";
import { emptyPlanDraft, readPlanDraft, writePlanDraft } from "@/lib/store/plan-draft";

describe("version 3 populated backup", () => {
  it("restores fields, rotations and a revised Plan draft", async () => {
    const store = useFieldsStore.getState();
    const field = await store.add({ name: "Backup field", geometry: { type: "Point", coordinates: [94.95, 20.15] }, irrigation: "none", locationConfirmed: true });
    await store.saveRotation({ id: "backup-rotation", fieldId: field.id, label: "Farmer sequence", cycleYears: 1, source: "farmer", slots: [{ id: "s", kind: "crop", cropId: "sesame", plantDate: "2026-05-15", harvestDate: "2026-08-15", dateConfidence: "exact", irrigated: false }] });
    const draft = { ...emptyPlanDraft(), revision: 4, mainCropId: "sesame" };
    writePlanDraft(draft);
    const backup = await store.exportBackup();
    expect(backup.version).toBe(3);
    await store.remove(field.id);
    localStorage.clear();
    await store.importBackup(JSON.parse(JSON.stringify(backup)));
    expect(useFieldsStore.getState().fields.find(f => f.id === field.id)?.name).toBe("Backup field");
    expect(useFieldsStore.getState().rotations[field.id][0].slots[0].cropId).toBe("sesame");
    expect(readPlanDraft()).toEqual(draft);
  });
});
