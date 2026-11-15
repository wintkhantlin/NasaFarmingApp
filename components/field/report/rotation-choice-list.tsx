"use client";

import { RotationChoiceRow } from "./rotation-choice-row";
import type { FarmerReport } from "@/lib/plan/farmer-report";
import type { AppCopy } from "@/lib/store/locale-store";

interface RotationChoiceListProps {
  report: FarmerReport;
  t: AppCopy;
}

export function RotationChoiceList({ report, t }: RotationChoiceListProps) {
  const rCopy = t.report;

  return (
    <section aria-labelledby="choices-heading" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="choices-heading" className="m-0 text-title font-semibold text-ink">
          {rCopy.rotationComparison}
        </h2>
        <p className="m-0 text-body-sm text-ink-muted">
          Compare your current rotation with alternative sequences. Numerical shortfall is modelled from historical weather and does not guarantee crop success.
        </p>
      </div>

      <ol className="m-0 flex list-none flex-col gap-4 p-0">
        {report.choices.map((choice, index) => (
          <RotationChoiceRow
            key={choice.id}
            choice={choice}
            index={index}
            showBar={report.showComparisonBars && choice.shortfall.comparable}
            maxShortfall={report.maxComparableShortfall}
            t={t}
          />
        ))}
      </ol>
    </section>
  );
}
