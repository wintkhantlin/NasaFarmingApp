"use client";

import { Disclosure } from "@/components/ui/disclosure";
import { Message } from "@/components/ui/message";
import type { FarmerReport } from "@/lib/plan/farmer-report";
import type { AppCopy } from "@/lib/store/locale-store";

interface KeyFindingProps {
  report: FarmerReport;
  t: AppCopy;
}

export function KeyFinding({ report, t }: KeyFindingProps) {
  const rCopy = t.report;

  return (
    <section aria-labelledby="finding-heading" className="flex flex-col gap-3 rounded-md bg-surface-sunken p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="finding-heading" className="m-0 text-headline font-semibold text-ink">
          {rCopy.findingHeading}
        </h2>
        <span className="rounded-pill bg-surface px-2.5 py-0.5 text-body-sm font-medium text-ink-muted border border-line">
          {report.priorityLabel}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <p className="m-0 max-w-measure text-title text-ink [overflow-wrap:break-word]">
          {report.keyFindingText}
        </p>
        {report.keyFindingWarning ? (
          <Message tone="caution" compact title={report.keyFindingWarning} />
        ) : null}
      </div>

      <div className="pt-1">
        <Disclosure
          title={rCopy.findingWhyButton}
          className="border-0 bg-transparent text-body-sm [&>summary]:px-0 [&>summary]:text-body-sm font-medium [&>summary]:font-medium [&>div]:px-0 [&>div]:pt-2"
        >
          <div className="flex flex-col gap-2 text-body-sm text-ink-muted">
            <p className="m-0">
              {rCopy.findingExplanation}
            </p>
            <p className="m-0 text-body-sm">
              {rCopy.weatherSource(report.baselineYears.count, report.baselineYears.start, report.baselineYears.end)}
            </p>
          </div>
        </Disclosure>
      </div>
    </section>
  );
}
