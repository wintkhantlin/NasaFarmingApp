import { create } from "zustand";

const KEY = "fieldshift.compareViewed.v1";

/**
 * Which fields have actually had a comparison shown to the farmer. The "Compare" step is only
 * ticked as done after this, so a tick never claims a result that was not produced.
 * Stored on this device only, as a list of field ids.
 */
interface CompareViewedState {
  viewed: Record<string, true>;
  hydrated: boolean;
  hydrate: () => void;
  markViewed: (fieldId: string) => void;
}

function read(): Record<string, true> {
  try {
    const ids = JSON.parse(localStorage.getItem(KEY) ?? "[]") as unknown;
    return Array.isArray(ids) ? Object.fromEntries(ids.filter((id): id is string => typeof id === "string").map((id) => [id, true as const])) : {};
  } catch {
    return {};
  }
}

function write(viewed: Record<string, true>) {
  try {
    localStorage.setItem(KEY, JSON.stringify(Object.keys(viewed)));
  } catch {
    // A blocked private-browser store only loses the tick after a reload.
  }
}

export const useCompareViewedStore = create<CompareViewedState>((set, get) => ({
  viewed: {},
  hydrated: false,
  hydrate: () => {
    if (get().hydrated) return;
    set((s) => ({ viewed: { ...read(), ...s.viewed }, hydrated: true }));
  },
  markViewed: (fieldId) => {
    if (get().viewed[fieldId]) return;
    const viewed = { ...get().viewed, [fieldId]: true as const };
    write({ ...read(), ...viewed });
    set({ viewed });
  },
}));
