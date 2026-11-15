"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Disclosure } from "@/components/ui/disclosure";
import { Panel } from "@/components/ui/panel";
import { INDICATOR_LABELS, getTheme, getTopic, glossaryBody, pick, topicsInTheme, type LearnTopic } from "@/lib/learn/topics";
import { useLocaleStore } from "@/lib/store/locale-store";

const UI = {
  en: {
    back: "Data",
    terms: "What the words mean",
    indicators: "Where you see this in the comparison",
    indicatorNote: (label: string) => `Shown as “${label}” on the compare screen.`,
    support: "Supporting information: dataset names",
    datasets: "Data sources",
    noDatasets: "This topic uses your own plan and the crop library, not a satellite dataset.",
    related: "More on this theme",
    readAloud: "Read aloud",
    englishOnly: "Shown in English. Burmese definitions are coming.",
    origin: "Where it comes from: the app glossary, written for this app.",
  },
  my: {
    back: "ဒေတာ",
    terms: "စကားလုံးများ၏ အဓိပ္ပာယ်",
    indicators: "နှိုင်းယှဉ်ချက်တွင် မြင်ရပုံ",
    indicatorNote: (label: string) => `နှိုင်းယှဉ်ချက်စာမျက်နှာတွင် “${label}” ဟု ပြသသည်။`,
    support: "အထောက်အကူ အချက်အလက်: ဒေတာအမည်များ",
    datasets: "ဒေတာရင်းမြစ်များ",
    noDatasets: "ဤအကြောင်းအရာသည် ဂြိုဟ်တုဒေတာမဟုတ်ဘဲ သင့်အစီအစဉ်နှင့် သီးနှံစာကြည့်တိုက်ကို အသုံးပြုသည်။",
    related: "ဤအပိုင်းမှ ထပ်မံဖတ်ရန်",
    readAloud: "အသံဖြင့် ဖတ်ပြရန်",
    englishOnly: "အင်္ဂလိပ်လိုသာ ပြထားသည်။ မြန်မာ အဓိပ္ပာယ်ဖွင့်ဆိုချက်များ ရေးသားနေဆဲဖြစ်သည်။",
    origin: "မူရင်း: အက်ပ်၏ စကားလုံးစာရင်း၊ ဤအက်ပ်အတွက် ရေးသားထားသည်။",
  },
} as const;

/** One farmer question, with its introduction, expandable definitions, comparison links and supporting dataset names. */
export function LearnTopicView({ topicId }: { topicId: string }) {
  const locale = useLocaleStore((s) => s.locale);
  const ui = UI[locale];
  const topic = getTopic(topicId);
  if (!topic) return null;
  const theme = getTheme(topic.theme);
  const related = topicsInTheme(topic.theme).filter((t) => t.id !== topic.id);
  // Read aloud only where the browser can speak. Checked after mount so server and client render the same HTML.
  const [canSpeak, setCanSpeak] = useState(false);
  useEffect(() => setCanSpeak("speechSynthesis" in window), []);

  return (
    <article className="flex flex-col gap-5">
      <Link href="/data" className="inline-flex min-h-tap items-center gap-1 self-start text-body-sm font-medium text-field">
        <span aria-hidden>‹</span> {ui.back}
      </Link>

      <header className="flex flex-col gap-2">
        <p className="m-0 text-body-sm text-ink-muted">{pick(theme.title, locale)}</p>
        <h1 className="m-0 text-title text-ink sm:text-display">{pick(topic.question, locale)}</h1>
        <p className="m-0 max-w-measure text-callout text-ink">{pick(topic.intro, locale)}</p>
      </header>

      {topic.terms.length > 0 ? (
        <section aria-labelledby="terms-title" className="flex flex-col gap-2">
          <h2 id="terms-title" className="m-0 text-body-sm text-ink-muted">{ui.terms}</h2>
          {locale === "my" ? <p className="m-0 text-body-sm text-ink-muted">{ui.englishOnly}</p> : null}
          <div className="flex flex-col gap-2">
            {topic.terms.map((term) => {
              const body = glossaryBody(term) ?? "";
              return (
                <Disclosure key={term} title={term}>
                  <div className="flex flex-col gap-3 px-4 pb-4">
                    <p className="m-0 text-body text-ink">{body}</p>
                    {canSpeak ? (
                      <Button
                        variant="secondary"
                        onClick={() => {
                          window.speechSynthesis.cancel();
                          window.speechSynthesis.speak(new SpeechSynthesisUtterance(body));
                        }}
                      >
                        {ui.readAloud}
                      </Button>
                    ) : null}
                  </div>
                </Disclosure>
              );
            })}
          </div>
        </section>
      ) : null}

      {topic.indicators.length > 0 ? (
        <section aria-labelledby="indicators-title" className="flex flex-col gap-2">
          <h2 id="indicators-title" className="m-0 text-body-sm text-ink-muted">{ui.indicators}</h2>
          <Panel as="ul" className="m-0 list-none divide-y divide-line p-0">
            {topic.indicators.map((id) => (
              <li key={id} className="flex flex-col gap-1 px-4 py-3">
                <span className="text-body-sm text-ink">{INDICATOR_LABELS[id] ?? id}</span>
                <span className="text-body-sm text-ink-muted">{ui.indicatorNote(INDICATOR_LABELS[id] ?? id)}</span>
              </li>
            ))}
          </Panel>
        </section>
      ) : null}

      <Disclosure title={ui.support}>
        <SupportingInfo topic={topic} ui={ui} />
      </Disclosure>

      {related.length > 0 ? (
        <section aria-labelledby="related-title" className="flex flex-col gap-2">
          <h2 id="related-title" className="m-0 text-body-sm text-ink-muted">{ui.related}</h2>
          <Panel as="div" className="divide-y divide-line">
            {related.map((t) => (
              <Link key={t.id} href={`/data/${t.id}`} className="flex min-h-tap items-center justify-between gap-3 px-4 py-2 text-body-sm text-ink">
                <span className="min-w-0 break-words">{pick(t.question, locale)}</span>
                <span aria-hidden className="shrink-0 text-ink-muted">›</span>
              </Link>
            ))}
          </Panel>
        </section>
      ) : null}

      <p className="m-0 text-body-sm text-ink-muted">{ui.origin}</p>
    </article>
  );
}

function SupportingInfo({ topic, ui }: { topic: LearnTopic; ui: (typeof UI)["en"] | (typeof UI)["my"] }) {
  return (
    <div className="flex flex-col gap-2 px-4 pb-4">
      <p className="m-0 text-body-sm text-ink-muted">{ui.datasets}</p>
      {topic.sources.length > 0 ? (
        <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
          {topic.sources.map((s) => (
            <li key={s} className="rounded-pill border border-line bg-surface px-3 py-1 text-body-sm text-ink">{s}</li>
          ))}
        </ul>
      ) : (
        <p className="m-0 text-body-sm text-ink-muted">{ui.noDatasets}</p>
      )}
    </div>
  );
}
