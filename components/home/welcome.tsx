"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { BrandMark } from "@/components/shell/brand-mark";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
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
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col gap-6 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(2.5rem,env(safe-area-inset-top))]">
      <div className="flex flex-col items-center gap-2 text-center">
        <BrandMark />
        <h1 className="text-title text-ink">{text.app.name}</h1>
        <p className="m-0 text-body text-ink">{text.path.job}</p>
      </div>

      <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
        <legend className="mb-1 text-label text-ink">{text.welcome.language}</legend>
        <Panel as="div" className="divide-y divide-line">
          {LANGS.map((l) => (
            <label key={l.value} className="flex min-h-tap cursor-pointer items-center justify-between gap-3 px-4">
              <span className="text-body text-ink">{l.label}</span>
              <input type="radio" name="language" value={l.value} checked={locale === l.value} onChange={() => setLocale(l.value)} className="size-5 accent-[var(--color-field)]" />
            </label>
          ))}
        </Panel>
      </fieldset>

      <section aria-labelledby="notice" className="flex flex-col gap-3">
        <h2 id="notice" className="sr-only">{text.welcome.yourData}</h2>
        <div>
          <h3 className="m-0 text-headline text-ink">{text.welcome.staysTitle}</h3>
          <ul className="m-0 mt-1 list-disc pl-5 text-body text-ink-muted">
            <li>{text.welcome.staysFields}</li>
            <li>{text.welcome.staysPriorities}</li>
          </ul>
        </div>
        <div>
          <h3 className="m-0 text-headline text-ink">{text.welcome.leavesTitle}</h3>
          <p className="m-0 mt-1 text-body text-ink-muted">{text.welcome.consentLine}</p>
          <details className="mt-1">
            <summary className="flex min-h-tap cursor-pointer items-center text-label text-field">{text.welcome.more}</summary>
            <ul className="m-0 list-disc pl-5 text-body-sm text-ink-muted">
              <li>{text.welcome.leavesLocation}</li>
              <li>{text.welcome.leavesMap}</li>
            </ul>
          </details>
        </div>
        {offline ? <p className="m-0 text-body-sm text-ink-muted">{text.welcome.offline}</p> : null}
        {/* Shown in both languages whichever is active: garbled Burmese cannot explain its own fix. */}
        <div className="flex flex-col gap-1 rounded-md bg-unknown-bg p-3 text-body-sm text-unknown-text" role="note">
          <p lang="my" className="m-0">{zawgyiMy}</p>
          <p lang="en" className="m-0">{zawgyiEn}</p>
        </div>
        <Link href="/about/data" className="inline-flex min-h-tap items-center text-label text-field">{text.welcome.learnData}</Link>
      </section>

      <div className="mt-auto">
        <Button
          variant="primary"
          block
          onClick={() => {
            accept();
            router.replace("/");
          }}
        >
          {text.welcome.continue}
        </Button>
      </div>
    </main>
  );
}
