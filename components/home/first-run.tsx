"use client";

import Link from "next/link";
import { buttonClass } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { useAppCopy } from "@/lib/store/locale-store";

/** Empty field list: the one start, in three plain steps and one button. */
export function FirstRun() {
  const t = useAppCopy();
  const steps = [t.path.firstStep1, t.path.firstStep2, t.path.firstStep3];

  return (
    <section
      aria-labelledby="first-run"
      className="flex flex-col items-start gap-6 rounded-lg border border-line bg-surface-raised p-5 sm:p-8"
    >
      <div className="flex flex-col gap-2">
        <h1 id="first-run" className="text-balance text-title text-ink sm:text-display">
          {t.home.emptyTitle}
        </h1>
        <p className="max-w-measure text-body text-ink-muted">{t.path.job}</p>
      </div>

      <ol className="m-0 flex list-none flex-col gap-3 p-0">
        {steps.map((title, i) => (
          <li key={i} className="flex items-center gap-3.5 text-body text-ink">
            <span
              aria-hidden="true"
              className="tabular grid size-7 shrink-0 place-items-center rounded-pill border border-line-strong bg-surface font-mono text-source text-ink-muted"
            >
              {i + 1}
            </span>
            <span className="text-label text-ink">{title}</span>
          </li>
        ))}
      </ol>

      <Link href="/fields/new" className={buttonClass("primary", "max-sm:w-full")}>
        <Icon name="add" />
        {t.home.addField}
      </Link>
    </section>
  );
}
