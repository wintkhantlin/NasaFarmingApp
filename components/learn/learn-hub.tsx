"use client";

import TextField from "@mui/material/TextField";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Panel } from "@/components/ui/panel";
import { useLocaleStore } from "@/lib/store/locale-store";
import { THEMES, pick, searchTopics, topicsInTheme, type LearnTopic } from "@/lib/learn/topics";

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

/** Learn hub (S15): farmer questions grouped into five themes, with search. Dataset names stay in each topic. */
export function LearnHub() {
  const locale = useLocaleStore((s) => s.locale);
  const ui = UI[locale];
  const [q, setQ] = useState("");
  const results = useMemo(() => (q.trim() ? searchTopics(q) : null), [q]);

  return (
    <>
      <p className="m-0 max-w-measure text-body text-ink-muted">{ui.intro}</p>
      <TextField
        type="search"
        label={ui.search}
        placeholder={ui.placeholder}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        size="small"
        fullWidth
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
                className="inline-flex min-h-tap items-center rounded-pill border border-line bg-surface-raised px-3 text-body-sm text-ink"
              >
                {pick(t.title, locale)}
              </a>
            ))}
          </nav>

          {THEMES.map((theme) => (
            <section key={theme.id} id={`theme-${theme.id}`} aria-labelledby={`theme-${theme.id}-title`} className="flex scroll-mt-4 flex-col gap-2">
              <div className="flex flex-col gap-1 px-1">
                <h2 id={`theme-${theme.id}-title`} className="m-0 text-source text-ink-muted">{pick(theme.title, locale)}</h2>
                <p className="m-0 text-body-sm text-ink-muted">{pick(theme.intro, locale)}</p>
              </div>
              <Panel as="div" className="divide-y divide-line">
                {topicsInTheme(theme.id).map((t) => (
                  <TopicLink key={t.id} topic={t} locale={locale} />
                ))}
              </Panel>
            </section>
          ))}
          <p className="m-0 text-source text-ink-tertiary">{ui.definitions}</p>
        </>
      )}
    </>
  );
}

function TopicLink({ topic, locale }: { topic: LearnTopic; locale: "en" | "my" }) {
  return (
    <Link href={`/data/${topic.id}`} className="flex min-h-tap w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-label text-ink hover:bg-surface-sunken">
      <span className="min-w-0 break-words">{pick(topic.question, locale)}</span>
      <span aria-hidden className="shrink-0 text-ink-muted">›</span>
    </Link>
  );
}

function SearchResults({ topics, locale, query, noneText, countText }: { topics: LearnTopic[]; locale: "en" | "my"; query: string; noneText: string; countText: string }) {
  if (topics.length === 0) return <p className="text-body text-ink-muted">{noneText}</p>;
  return (
    <section aria-label={`Results for ${query}`} className="flex flex-col gap-2">
      <p className="m-0 px-1 text-source text-ink-muted">{countText}</p>
      <Panel as="div" className="divide-y divide-line">
        {topics.map((t) => (
          <TopicLink key={t.id} topic={t} locale={locale} />
        ))}
      </Panel>
    </section>
  );
}
