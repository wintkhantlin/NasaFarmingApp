"use client";

import { create } from "zustand";
import { createRepository, ValidationError, type NewField, type Repository } from "./repository";
import { indexedDbStorage } from "./storage";
import type { Backup, Field, Rotation } from "../types";
import { readPlanDraft, writePlanDraft } from "./plan-draft";
import { backupSchema } from "../schemas/field";

let repo: Repository | undefined;
/** The IndexedDB repository. Created on first use, so it never runs on the server. */
export function getRepository(): Repository {
  repo ??= createRepository(indexedDbStorage());
  return repo;
}

type Status = "idle" | "loading" | "ready" | "error";

interface FieldsState {
  status: Status;
  fields: Field[];
  rotations: Record<string, Rotation[]>;
  error: string | null;
  load: () => Promise<void>;
  add: (input: NewField) => Promise<Field>;
  update: (id: string, patch: Partial<NewField>) => Promise<Field>;
  remove: (id: string) => Promise<void>;
  loadRotations: (fieldId: string) => Promise<Rotation[]>;
  saveRotation: (rotation: Rotation) => Promise<Rotation>;
  exportBackup: () => Promise<Backup>;
  importBackup: (json: unknown) => Promise<{ fields: number; rotations: number }>;
}

const messageOf = (e: unknown) =>
  e instanceof ValidationError ? e.message : "Couldn't read your saved fields. Check that this browser allows site storage.";

export const useFieldsStore = create<FieldsState>()((set, get) => ({
  status: "idle",
  fields: [],
  rotations: {},
  error: null,

  async load() {
    if (get().status === "loading") return;
    set({ status: "loading", error: null });
    try {
      const fields = await getRepository().listFields();
      const rotationsMap: Record<string, Rotation[]> = {};
      for (const field of fields) {
        try {
          rotationsMap[field.id] = await getRepository().listRotations(field.id);
        } catch {
          rotationsMap[field.id] = [];
        }
      }
      set({ fields, rotations: rotationsMap, status: "ready" });
    } catch (e) {
      set({ status: "error", error: messageOf(e) });
    }
  },

  async add(input) {
    const field = await getRepository().createField(input);
    set({ fields: [field, ...get().fields] });
    return field;
  },

  async update(id, patch) {
    const field = await getRepository().updateField(id, patch);
    set({ fields: [field, ...get().fields.filter((f) => f.id !== id)] });
    return field;
  },

  async remove(id) {
    await getRepository().removeField(id);
    const updatedRotations = { ...get().rotations };
    delete updatedRotations[id];
    set({
      fields: get().fields.filter((f) => f.id !== id),
      rotations: updatedRotations,
    });
  },

  async loadRotations(fieldId: string) {
    const list = await getRepository().listRotations(fieldId);
    set({
      rotations: {
        ...get().rotations,
        [fieldId]: list,
      },
    });
    return list;
  },

  async saveRotation(rotation: Rotation) {
    const saved = await getRepository().saveRotation(rotation);
    const fieldId = rotation.fieldId;
    const existing = get().rotations[fieldId] ?? [];
    const filtered = existing.filter((r) => r.id !== saved.id);
    set({
      rotations: {
        ...get().rotations,
        [fieldId]: [saved, ...filtered],
      },
    });
    return saved;
  },

  async exportBackup() {
    return { ...await getRepository().exportAll(), version: 3, planDraft: readPlanDraft() };
  },

  async importBackup(json: unknown) {
    const parsed = backupSchema.parse(json);
    const result = await getRepository().importAll(parsed);
    if (parsed.planDraft && !writePlanDraft(parsed.planDraft)) throw new Error("Fields restored, but Plan storage is blocked. Keep the backup and retry after allowing browser storage.");
    await get().load();
    return result;
  },
}));

export const EMPTY_ROTATIONS: Rotation[] = [];

/** Safe hook to access rotations for a field with cached snapshot equality */
export function useFieldRotations(fieldId: string): Rotation[] {
  const rotations = useFieldsStore((s) => s.rotations[fieldId]);
  return rotations ?? EMPTY_ROTATIONS;
}

/** Derives the step state for a field from the actual store data. */
export type StepId = "location" | "rotation" | "profile" | "conditions" | "compare";
export type StepState = "done" | "needs-input" | "loading" | "not-started";

export function deriveStepStates(field: Field | undefined, fieldRotations: Rotation[] | undefined): Record<StepId, StepState> {
  if (!field) {
    return { location: "not-started", rotation: "not-started", profile: "not-started", conditions: "not-started", compare: "not-started" };
  }

  const hasRotation = Boolean(fieldRotations && fieldRotations.length > 0 && fieldRotations[0].slots.length > 0);
  const hasPriorities = (field.priorities?.order.length ?? 0) > 0;

  return {
    // a location is only "done" once the farmer has said it is their field
    location: field.locationConfirmed ? "done" : "needs-input",
    rotation: hasRotation ? "done" : "needs-input",
    // priorities are optional, so this step never blocks the others
    profile: hasPriorities ? "done" : hasRotation ? "needs-input" : "not-started",
    conditions: hasRotation ? "done" : "not-started",
    compare: hasRotation ? "done" : "not-started",
  };
}
