"use client";

import { useLocaleStore } from "@/lib/store/locale-store";

const TITLE = { en: "Data", my: "ဒေတာ" } as const;

/** Title for the Learn tab, in the language the farmer chose. */
export function LearnHeader() {
  const locale = useLocaleStore((s) => s.locale);
  return (
    <div className="flex flex-col gap-1">
      <h1 className="text-title text-ink sm:text-display">{TITLE[locale]}</h1>
    </div>
  );
}
