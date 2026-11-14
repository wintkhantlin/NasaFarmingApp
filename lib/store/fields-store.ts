"use client";

import { create } from "zustand";
import { createRepository, ValidationError, type NewField, type Repository } from "./repository";
import { indexedDbStorage } from "./storage";
import type { Field } from "../types";

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
  error: string | null;
  load: () => Promise<void>;
  add: (input: NewField) => Promise<Field>;
  update: (id: string, patch: Partial<NewField>) => Promise<Field>;
  remove: (id: string) => Promise<void>;
}

const messageOf = (e: unknown) =>
  e instanceof ValidationError ? e.message : "Couldn't read your saved fields. Check that this browser allows site storage.";

export const useFieldsStore = create<FieldsState>()((set, get) => ({
  status: "idle",
  fields: [],
  error: null,

  async load() {
    if (get().status === "loading") return;
    set({ status: "loading", error: null });
    try {
      set({ fields: await getRepository().listFields(), status: "ready" });
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
    set({ fields: get().fields.filter((f) => f.id !== id) });
  },
}));
