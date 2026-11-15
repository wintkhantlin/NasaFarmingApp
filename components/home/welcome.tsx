"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { BrandMark } from "@/components/shell/brand-mark";
import { FlowNav } from "@/components/ui/flow-nav";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";
import { getAppCopy, useAppCopy, useLocaleStore, type Locale } from "@/lib/store/locale-store";
import { useSettingsStore } from "@/lib/store/settings-store";

const LANGS: Array<{ value: Locale; label: string }> = [
  { value: "my", label: "မြန်မာ" },
  { value: "en", label: "English" },
];

/** Old Zawgyi fonts draw Unicode Myanmar wrongly. A tiny canvas probe is not reliable, so we only offer the hint. */
export function Welcome() {
  const router = useRouter();
  const text = useAppCopy();
  const locale = useLocaleStore((s) => s.locale);
  const hydrateLocale = useLocaleStore((s) => s.hydrate);
  const setLocale = useLocaleStore((s) => s.setLocale);
  const accept = useSettingsStore((s) => s.acceptDataNotice);
  const [offline, setOffline] = useState(false);
  const zawgyiMy = getAppCopy("my").welcome.zawgyi;
  const zawgyiEn = getAppCopy("en").welcome.zawgyi;
  useEffect(() => hydrateLocale(), [hydrateLocale]);
  useEffect(() => {
    const sync = () => setOffline(!navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  return (
    // No tab bar on this screen, so the Continue bar sits at the very bottom.
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col gap-6 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))] [--tabbar-h:0px]">
      <div className="flex flex-col items-center gap-2 text-center">
        <BrandMark size={80} />
        <h1 className="text-balance text-title text-ink">{text.app.name}</h1>
        <p className="m-0 max-w-measure text-pretty text-body text-ink">{text.path.job}</p>
      </div>

      {/* Language comes first: someone who cannot read this page must find it at once. */}
      <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
        <legend className="mb-2 flex items-center gap-2 text-headline text-ink text-balance">
          <Icon name="language" size={22} />
          {text.welcome.language}
        </legend>
        <div className="grid grid-cols-2 gap-3">
          {LANGS.map((l) => {
            const selected = locale === l.value;
            return (
              <label
                key={l.value}
                lang={l.value}
                className={cn(
                  "flex min-h-16 cursor-pointer items-center justify-center gap-2 rounded-lg border-2 px-3 py-3 text-title transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-field/40",
                  selected ? "border-field bg-field-soft font-semibold text-ink" : "border-line-strong bg-surface-raised text-ink hover:bg-surface-sunken",
                )}
              >
                <input type="radio" name="language" value={l.value} checked={selected} onChange={() => setLocale(l.value)} className="sr-only" />
                {selected ? <Icon name="check" size={22} strokeWidth={2.6} className="text-field" /> : null}
                {l.label}
              </label>
            );
          })}
        </div>
      </fieldset>

      <section aria-labelledby="notice" className="flex flex-col gap-4 border-t border-line pt-5">
        <h2 id="notice" className="sr-only">{text.welcome.yourData}</h2>
        <div>
          <h3 className="m-0 flex items-center gap-2 text-headline text-ink text-balance">
            <Icon name="private" size={20} className="text-field" />
            {text.welcome.staysTitle}
          </h3>
          <ul className="m-0 mt-1 list-disc pl-7 text-pretty text-body text-ink">
            <li>{text.welcome.staysFields}</li>
            <li>{text.welcome.staysPriorities}</li>
          </ul>
        </div>
        <div>
          <h3 className="m-0 flex items-center gap-2 text-headline text-ink text-balance">
            <Icon name="location" size={20} className="text-field" />
            {text.welcome.leavesTitle}
          </h3>
          <p className="m-0 mt-1 text-pretty text-body text-ink">{text.welcome.consentLine}</p>
          <details className="mt-1">
            <summary className="flex min-h-tap cursor-pointer items-center text-label text-field select-none">{text.welcome.more}</summary>
            <ul className="m-0 list-disc pl-5 text-pretty text-body-sm text-ink-muted">
              <li>{text.welcome.leavesLocation}</li>
              <li>{text.welcome.leavesMap}</li>
            </ul>
          </details>
        </div>
        {offline ? <p className="m-0 text-pretty text-body-sm text-ink-muted">{text.welcome.offline}</p> : null}
        {/* Shown in the active language: English or Burmese, never mixed together. */}
        <div className="flex flex-col gap-1 rounded-md border border-unknown-border/30 bg-unknown-bg p-3 text-body-sm text-unknown-text" role="note">
          {locale === "my" ? (
            <p lang="my" className="m-0 text-pretty leading-relaxed">{zawgyiMy}</p>
          ) : (
            <p lang="en" className="m-0 text-pretty">{zawgyiEn}</p>
          )}
        </div>
        <Link href="/about/data" className="inline-flex min-h-tap items-center text-label text-field">{text.welcome.learnData}</Link>
      </section>

      <div className="mt-auto">
        <FlowNav
          next={{
            label: text.welcome.continue,
            onClick: () => {
              accept();
              router.replace("/");
            },
          }}
        />
      </div>
    </main>
  );
}
