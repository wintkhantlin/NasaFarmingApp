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

/** Burmese when the phone's language is Burmese (my, my-MM), otherwise English. */
function phoneLocale(): Locale {
  try {
    return typeof navigator !== "undefined" && /^my\b/i.test(navigator.language ?? "") ? "my" : "en";
  } catch {
    return "en";
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
    let value: Partial<Pick<LocaleState, "locale" | "areaUnit">> = {};
    try {
      value = JSON.parse(localStorage.getItem(KEY) ?? "{}") as typeof value;
    } catch {
      // Unreadable saved choice: fall back to the phone's language below.
    }
    // A saved choice always wins. Without one, a phone set to Burmese starts in Burmese.
    const locale: Locale = value?.locale === "my" || value?.locale === "en" ? value.locale : phoneLocale();
    set({ locale, areaUnit: value?.areaUnit === "acre" ? "acre" : "ha", hydrated: true });
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

export type AppCopy = ReturnType<typeof useAppCopy>;
