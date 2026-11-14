"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BrandMark } from "@/components/shell/brand-mark";
import { Button } from "@/components/ui/button";
import { copy } from "@/lib/copy/en";
import { useSettingsStore } from "@/lib/store/settings-store";

export function Welcome() {
  const router = useRouter();
  const accept = useSettingsStore((s) => s.acceptDataNotice);
  const [offline, setOffline] = useState(false);
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

      <section aria-labelledby="notice" className="flex flex-col gap-3">
        <h2 id="notice" className="sr-only">Your data</h2>
        <ul className="m-0 list-disc pl-5 text-body text-ink-muted">
          <li>Your fields, crops and soil tests stay on this phone.</li>
          <li>Your field location is sent to NASA, ISRIC and Microsoft data services to get weather and soil.</li>
        </ul>
        <Button href="/about/data" variant="quiet" className="self-start">Learn about data</Button>
        {offline ? <p className="m-0 text-body-sm text-ink-muted">You are offline. Data will load when you connect.</p> : null}
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
