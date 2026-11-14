import { create } from "zustand";
import { copy as copyEn } from "@/lib/copy/en";
import { copyMy } from "@/lib/copy/my";

export type Locale = "en" | "my";
export type AreaUnit = "ha" | "acre";

interface LocaleState {
  locale: Locale;
  areaUnit: AreaUnit;
  setLocale: (locale: Locale) => void;
  setAreaUnit: (unit: AreaUnit) => void;
  toggleLocale: () => void;
  toggleAreaUnit: () => void;
}

export const useLocaleStore = create<LocaleState>((set) => ({
  locale: "en",
  areaUnit: "ha",
  setLocale: (locale) => set({ locale }),
  setAreaUnit: (areaUnit) => set({ areaUnit }),
  toggleLocale: () => set((s) => ({ locale: s.locale === "en" ? "my" : "en" })),
  toggleAreaUnit: () => set((s) => ({ areaUnit: s.areaUnit === "ha" ? "acre" : "ha" })),
}));

export function getAppCopy(locale: Locale) {
  return locale === "my" ? copyMy : copyEn;
}

export function useAppCopy() {
  const locale = useLocaleStore((s) => s.locale);
  return locale === "my" ? copyMy : copyEn;
}
