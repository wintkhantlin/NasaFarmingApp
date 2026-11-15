"use client";

import Link from "next/link";
import { buttonClass } from "@/components/ui/button";
import type { FarmerReport } from "@/lib/plan/farmer-report";
import type { AppCopy } from "@/lib/store/locale-store";

interface ReportCheckLocallyProps {
  report: FarmerReport;
  t: AppCopy;
}

export function ReportCheckLocally({ report, t }: ReportCheckLocallyProps) {
  const rCopy = t.report;

  return (
    <section aria-labelledby="check-locally-heading" className="flex flex-col gap-4 border-t border-line pt-6">
      <div className="flex flex-col gap-1">
        <h2 id="check-locally-heading" className="m-0 text-title font-semibold text-ink">
          {rCopy.checkLocallyTitle}
        </h2>
        <p className="m-0 text-body-sm text-ink-muted">
          {rCopy.checkLocallySubtitle}
        </p>
      </div>

      {/* The 3 Core Verification Questions */}
      <div className="flex flex-col gap-2 rounded-md bg-surface p-4 sm:p-5 border border-line">
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {report.checkLocallyQuestions.map((q, idx) => (
            <li key={idx} className="flex items-start gap-3 text-body-sm text-ink">
              <span
                aria-hidden="true"
                className="mt-0.5 inline-block size-4 shrink-0 rounded-xs border-2 border-line-strong"
              />
              <span className="leading-relaxed font-medium">{q}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Farmer's Field Notes & Local Soil Observations */}
      <div className="flex flex-col gap-2 rounded-md bg-surface-sunken p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="m-0 text-body-sm font-semibold text-ink">{rCopy.localNotesTitle}</h3>
          <Link
            href={`/fields/${report.fieldId}/compare`}
            className="text-body-sm font-medium text-field hover:underline"
          >
            Add notes in Compare
          </Link>
        </div>

        {report.localNotes.length > 0 || report.soilTestObservations.length > 0 ? (
          <ul className="m-0 flex list-disc flex-col gap-1.5 pl-5 text-body-sm text-ink">
            {report.localNotes.map((note, idx) => (
              <li key={`note-${idx}`}>
                <span className="font-semibold">{note.topic}: </span>
                <span className="text-ink-muted">{note.text}</span>
              </li>
            ))}
            {report.soilTestObservations.map((obs, idx) => (
              <li key={`soil-${idx}`}>
                <span className="font-semibold">Soil test ({obs.property}): </span>
                <span className="text-ink-muted">
                  {obs.value} (depth {obs.depth}, {obs.method}, {obs.source})
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="m-0 text-body-sm text-ink-muted italic">
            {rCopy.noLocalNotes}
          </p>
        )}
      </div>
    </section>
  );
}
