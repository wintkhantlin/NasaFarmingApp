"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BrandMark } from "@/components/shell/brand-mark";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { copy } from "@/lib/copy/en";
import { useLocaleStore, type Locale } from "@/lib/store/locale-store";
import { useSettingsStore } from "@/lib/store/settings-store";

const LANGS: Array<{ value: Locale; label: string }> = [
  { value: "my", label: "မြန်မာ (Myanmar)" },
  { value: "en", label: "English" },
];

/** Old Zawgyi fonts draw Unicode Myanmar wrongly. A tiny canvas probe is not reliable, so we only offer the hint. */
export function Welcome() {
  const router = useRouter();
  const locale = useLocaleStore((s) => s.locale);
  const hydrateLocale = useLocaleStore((s) => s.hydrate);
  const setLocale = useLocaleStore((s) => s.setLocale);
  const accept = useSettingsStore((s) => s.acceptDataNotice);
  const [offline, setOffline] = useState(false);
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
        <h1 className="text-title text-ink">{copy.app.name}</h1>
        <p className="m-0 text-body text-ink-muted">Explore crop rotation options using past weather, soil information and your experience.</p>
      </div>

      <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
        <legend className="mb-1 text-label text-ink">Language</legend>
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
        <h2 id="notice" className="sr-only">Your data</h2>
        <div>
          <h3 className="m-0 text-headline text-ink">What stays on this phone / ဖုန်းထဲတွင်သာ သိမ်းထားသည်</h3>
          <ul className="m-0 mt-1 list-disc pl-5 text-body text-ink-muted">
            <li>Your fields, crops and soil tests</li>
            <li>Your priorities and limits</li>
          </ul>
        </div>
        <div>
          <h3 className="m-0 text-headline text-ink">What may leave the phone / ဖုန်းမှ ထွက်သွားနိုင်သည်</h3>
          <ul className="m-0 mt-1 list-disc pl-5 text-body text-ink-muted">
            <li>Field location, to NASA, ISRIC and Microsoft data services</li>
          </ul>
        </div>
        {offline ? <p className="m-0 text-body-sm text-ink-muted">You are offline. Data will load when you connect.</p> : null}
        {locale === "my" ? (
          <p className="m-0 rounded-md bg-unknown-bg p-3 text-body-sm text-unknown-text" role="note">
            If Myanmar text looks wrong, your phone may use an older Myanmar font. Switch to Unicode for correct text.
          </p>
        ) : null}
        <Button href="/about/data" variant="quiet" className="self-start">Learn about data / ဒေတာအကြောင်း လေ့လာရန်</Button>
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
          Continue
        </Button>
      </div>
    </main>
  );
}
