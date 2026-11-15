"use client";

import { useLocaleStore } from "@/lib/store/locale-store";

const TITLE = { en: "Data", my: "ဒေတာ" } as const;
const SUBTITLE = {
  en: "How satellite observations, soil models, and farm knowledge work together in Field Shift.",
  my: "Field Shift တွင် ဂြိုဟ်တုဒေတာ၊ မြေဆီလွှာမော်ဒယ်များနှင့် သင့်စိုက်ခင်းအချက်အလက်များ မည်သို့တွဲဖက်အလုပ်လုပ်ပုံ။",
} as const;

/** Title for the Learn tab, in the language the farmer chose. */
export function LearnHeader() {
  const locale = useLocaleStore((s) => s.locale);
  return (
    <div className="flex flex-col gap-1">
      <h1 className="text-title text-ink sm:text-display">{TITLE[locale]}</h1>
      <p className="m-0 max-w-measure text-body text-ink-muted">{SUBTITLE[locale]}</p>
    </div>
  );
}
