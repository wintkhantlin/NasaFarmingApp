"use client";

import { useLocaleStore } from "@/lib/store/locale-store";

/**
 * Pick the English or Burmese words for the current language. For short labels
 * that have no key in lib/copy yet; move them there when the copy is next edited.
 */
export function usePick() {
  const locale = useLocaleStore((s) => s.locale);
  return (en: string, my: string) => (locale === "my" ? my : en);
}
