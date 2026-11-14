import { create } from "zustand";
import { copy as copyEn } from "@/lib/copy/en";
import { copyMy } from "@/lib/copy/my";

export type Locale = "en" | "my";
export type AreaUnit = "ha" | "acre";

const KEY = "fieldshift.locale.v1";

function save(locale: Locale, areaUnit: AreaUnit) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ locale, areaUnit }));
  } catch {
    // A blocked private-browser store should not prevent using the app this visit.
  }
}

interface LocaleState {
  locale: Locale;
  areaUnit: AreaUnit;
  hydrated: boolean;
  hydrate: () => void;
  setLocale: (locale: Locale) => void;
  setAreaUnit: (unit: AreaUnit) => void;
  toggleLocale: () => void;
  toggleAreaUnit: () => void;
}

export const useLocaleStore = create<LocaleState>((set) => ({
  locale: "en",
  areaUnit: "ha",
  hydrated: false,
  hydrate: () => {
    try {
      const value = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<Pick<LocaleState, "locale" | "areaUnit">>;
      set({ locale: value.locale === "my" ? "my" : "en", areaUnit: value.areaUnit === "acre" ? "acre" : "ha", hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },
  setLocale: (locale) => set((s) => { save(locale, s.areaUnit); return { locale }; }),
  setAreaUnit: (areaUnit) => set((s) => { save(s.locale, areaUnit); return { areaUnit }; }),
  toggleLocale: () => set((s) => { const locale = s.locale === "en" ? "my" : "en"; save(locale, s.areaUnit); return { locale }; }),
  toggleAreaUnit: () => set((s) => { const areaUnit = s.areaUnit === "ha" ? "acre" : "ha"; save(s.locale, areaUnit); return { areaUnit }; }),
}));

export function getAppCopy(locale: Locale) {
  return locale === "my" ? copyMy : copyEn;
}

export function useAppCopy() {
  const locale = useLocaleStore((s) => s.locale);
  return locale === "my" ? copyMy : copyEn;
}
