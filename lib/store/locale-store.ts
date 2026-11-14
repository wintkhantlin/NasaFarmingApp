import { create } from "zustand";

export type AreaUnit = "ha" | "acre";

// Storage key kept from the older language setting. Old saved `locale` values are ignored.
const KEY = "fieldshift.locale.v1";

function save(areaUnit: AreaUnit) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ areaUnit }));
  } catch {
    // A blocked private-browser store should not prevent using the app this visit.
  }
}

interface LocaleState {
  areaUnit: AreaUnit;
  hydrated: boolean;
  hydrate: () => void;
  setAreaUnit: (unit: AreaUnit) => void;
  toggleAreaUnit: () => void;
}

export const useLocaleStore = create<LocaleState>((set) => ({
  areaUnit: "ha",
  hydrated: false,
  hydrate: () => {
    try {
      const value = JSON.parse(localStorage.getItem(KEY) ?? "{}") as { areaUnit?: unknown };
      set({ areaUnit: value.areaUnit === "acre" ? "acre" : "ha", hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },
  setAreaUnit: (areaUnit) => { save(areaUnit); set({ areaUnit }); },
  toggleAreaUnit: () => set((s) => { const areaUnit = s.areaUnit === "ha" ? "acre" : "ha"; save(areaUnit); return { areaUnit }; }),
}));
