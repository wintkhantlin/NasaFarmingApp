"use client";

import TextField from "@mui/material/TextField";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Icon, type IconName } from "@/components/ui/icon";
import { Panel } from "@/components/ui/panel";
import { useLocaleStore } from "@/lib/store/locale-store";
import { THEMES, pick, searchTopics, topicsInTheme, type LearnTopic, type ThemeId } from "@/lib/learn/topics";
import { DataUsageGuide } from "@/components/learn/data-usage-guide";

const UI = {
  en: {
    search: "Search Learn",
    placeholder: "Try “rain”, “soil” or “satellite”",
    none: (q: string) => `No topics match “${q}”. Try a shorter word.`,
    jump: "Jump to",
    count: (n: number) => `${n} ${n === 1 ? "topic" : "topics"}`,
    intro: "Start with a question you have on the farm. Tap one for a short explanation.",
    definitions: "Definitions and data sources are one tap further in.",
  },
  my: {
    search: "သင်ယူရန် ရှာရန်",
    placeholder: "“မိုး”၊ “မြေ” သို့မဟုတ် “ဂြိုဟ်တု” ဟု ရိုက်ကြည့်ပါ",
    none: (q: string) => `“${q}” နှင့် ကိုက်ညီသော အကြောင်းအရာ မတွေ့ပါ။ ပိုတိုသော စကားလုံးဖြင့် ရှာကြည့်ပါ။`,
    jump: "ဤအပိုင်းသို့ သွားရန်",
    count: (n: number) => `အကြောင်းအရာ ${n} ခု`,
    intro: "သင့်စိုက်ခင်းနှင့် သက်ဆိုင်သော မေးခွန်းတစ်ခုဖြင့် စပါ။ တစ်ခုကို နှိပ်ပြီး အတိုချုံးရှင်းလင်းချက် ဖတ်ပါ။",
    definitions: "အဓိပ္ပာယ်ဖွင့်ဆိုချက်နှင့် ဒေတာရင်းမြစ်များကို နောက်တစ်ဆင့်တွင် ကြည့်နိုင်သည်။",
  },
} as const;

/** One icon per theme, so a farmer who reads little can still find the right group. */
const THEME_ICON: Record<ThemeId, IconName> = { weather: "rain", water: "water", soil: "soil", crops: "rotation", satellite: "satellite" };

/** The first sentence of a topic's introduction: the short answer shown under the question. */
function shortAnswer(text: string): string {
  const m = text.match(/^.*?[.!?။](?=\s|$)/);
  return (m ? m[0] : text).trim();
}

/** Learn hub (S15): farmer questions grouped into five themes, with search. Dataset names stay in each topic. */
export function LearnHub() {
  const locale = useLocaleStore((s) => s.locale);
  const ui = UI[locale];
  const [q, setQ] = useState("");
  const results = useMemo(() => (q.trim() ? searchTopics(q) : null), [q]);

  return (
    <div className="flex flex-col gap-8">
      {/* What data is used and how data is used */}
      <DataUsageGuide />

      {/* Common Farm Questions & Topics */}
      <section aria-labelledby="questions-guide-title" className="flex flex-col gap-4 border-t border-line pt-6">
        <div className="flex flex-col gap-1">
          <h2 id="questions-guide-title" className="m-0 text-title text-ink">
            {locale === "my" ? "စိုက်ခင်းဆိုင်ရာ မေးခွန်းများနှင့် အဖြေများ" : "Browse Farm Questions & Topics"}
          </h2>
          <p className="m-0 max-w-measure text-body text-ink-muted">{ui.intro}</p>
        </div>

        <TextField
          type="search"
          label={ui.search}
          placeholder={ui.placeholder}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          fullWidth
          sx={{ "& .MuiInputBase-input": { fontSize: "1.0625rem", minHeight: 28 } }}
          slotProps={{ htmlInput: { "aria-label": ui.search } }}
        />

        {results ? (
          <SearchResults topics={results} locale={locale} query={q.trim()} noneText={ui.none(q.trim())} countText={ui.count(results.length)} />
        ) : (
          <>
            <nav aria-label={ui.jump} className="flex flex-wrap gap-2">
              {THEMES.map((t) => (
                <a
                  key={t.id}
                  href={`#theme-${t.id}`}
                  className="inline-flex min-h-tap items-center gap-2 rounded-pill border border-line bg-surface-raised px-3.5 text-body-sm text-ink transition-colors hover:border-line-strong hover:bg-surface-sunken active:bg-surface-sunken"
                >
                  <Icon name={THEME_ICON[t.id]} size={18} />
                  {pick(t.title, locale)}
                </a>
              ))}
            </nav>

            {THEMES.map((theme) => (
              <section key={theme.id} id={`theme-${theme.id}`} aria-labelledby={`theme-${theme.id}-title`} className="flex scroll-mt-4 flex-col gap-2">
                <div className="flex flex-col gap-1 px-1">
                  <h3 id={`theme-${theme.id}-title`} className="m-0 flex items-center gap-2 text-headline text-ink">
                    <Icon name={THEME_ICON[theme.id]} size={20} className="shrink-0 text-field" />
                    {pick(theme.title, locale)}
                  </h3>
                  <p className="m-0 text-body-sm text-ink-muted">{pick(theme.intro, locale)}</p>
                </div>
                <Panel as="div" className="divide-y divide-line">
                  {topicsInTheme(theme.id).map((t) => (
                    <TopicLink key={t.id} topic={t} locale={locale} />
                  ))}
                </Panel>
              </section>
            ))}
            <p className="m-0 text-body-sm text-ink-muted">{ui.definitions}</p>
          </>
        )}
      </section>
    </div>
  );
}

function TopicLink({ topic, locale }: { topic: LearnTopic; locale: "en" | "my" }) {
  return (
    <Link href={`/data/${topic.id}`} className="group flex min-h-tap w-full items-center justify-between gap-3 px-4 py-3 text-left text-ink no-underline transition-colors hover:bg-surface-sunken active:bg-surface-sunken">
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="break-words text-body font-medium">{pick(topic.question, locale)}</span>
        <span className="break-words text-body-sm text-ink-muted">{shortAnswer(pick(topic.intro, locale))}</span>
      </span>
      <Icon name="next" size={20} className="shrink-0 text-ink-muted transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

function SearchResults({ topics, locale, query, noneText, countText }: { topics: LearnTopic[]; locale: "en" | "my"; query: string; noneText: string; countText: string }) {
  if (topics.length === 0) return <p className="text-body text-ink-muted">{noneText}</p>;
  return (
    <section aria-label={`Results for ${query}`} className="flex flex-col gap-2">
      <p className="m-0 px-1 text-body-sm text-ink-muted">{countText}</p>
      <Panel as="div" className="divide-y divide-line">
        {topics.map((t) => (
          <TopicLink key={t.id} topic={t} locale={locale} />
        ))}
      </Panel>
    </section>
  );
}
