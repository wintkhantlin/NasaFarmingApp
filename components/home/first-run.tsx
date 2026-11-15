"use client";

import { FlowNav } from "@/components/ui/flow-nav";
import { Icon, type IconName } from "@/components/ui/icon";
import { useAppCopy } from "@/lib/store/locale-store";

const STEP_ICONS: IconName[] = ["pin", "rotation", "compare"];

/** Empty field list: three plain steps, and one big action in the usual place. */
export function FirstRun() {
  const t = useAppCopy();
  const steps = [t.path.firstStep1, t.path.firstStep2, t.path.firstStep3];

  return (
    <section aria-labelledby="first-run" className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 id="first-run" className="text-balance text-title text-ink sm:text-display">
          {t.home.emptyTitle}
        </h1>
        <p className="max-w-measure text-body text-ink-muted">{t.path.job}</p>
      </div>

      <ol className="m-0 flex list-none flex-col gap-4 p-0">
        {steps.map((title, i) => (
          <li key={i} className="flex items-center gap-4 text-body text-ink">
            <span
              aria-hidden="true"
              className="tabular grid size-10 shrink-0 place-items-center rounded-pill bg-field font-mono text-headline font-semibold text-on-field"
            >
              {i + 1}
            </span>
            <Icon name={STEP_ICONS[i]} size={24} className="shrink-0 text-field" />
            <span className="text-headline text-ink">{title}</span>
          </li>
        ))}
      </ol>

      <FlowNav next={{ label: t.home.addField, href: "/fields/new", icon: "add" }} />
    </section>
  );
}
