"use client";

import { Disclosure } from "@/components/ui/disclosure";
import type { FarmerReport } from "@/lib/plan/farmer-report";
import type { AppCopy } from "@/lib/store/locale-store";

interface EvidenceDisclosureProps {
  report: FarmerReport;
  t: AppCopy;
}

export function EvidenceDisclosure({ report, t }: EvidenceDisclosureProps) {
  const rCopy = t.report;

  return (
    <section aria-labelledby="evidence-heading" className="flex flex-col gap-3 border-t border-line pt-6">
      <div className="flex flex-col gap-1">
        <h2 id="evidence-heading" className="m-0 text-title font-semibold text-ink">
          {rCopy.evidenceSummary}
        </h2>
        <p className="m-0 text-body-sm text-ink-muted">
          {rCopy.evidenceSubtitle}
        </p>
      </div>

      {/* Mandatory visible summary line */}
      <div className="flex flex-col gap-2 rounded-md bg-surface-sunken p-4 text-body-sm text-ink-muted">
        <p className="m-0 text-ink">
          {rCopy.weatherSource(report.baselineYears.count, report.baselineYears.start, report.baselineYears.end)}
        </p>
        <p className="m-0">
          {rCopy.soilSource}
        </p>

        {/* Unavailable datasets explicit notice */}
        <div className="flex flex-col gap-1 pt-1 text-body-sm text-ink-tertiary">
          <p className="m-0">{rCopy.imergUnavailable}</p>
          <p className="m-0">{rCopy.smapUnavailable}</p>
          <p className="m-0">{rCopy.srtmUnavailable}</p>
          {report.satelliteCheckingPending ? (
            <p className="m-0">{rCopy.satellitePendingNote}</p>
          ) : null}
        </div>
      </div>

      {/* Expandable Technical Annex */}
      <div className="pt-1">
        <Disclosure
          title="See data sources & measurement scope"
          className="border-0 bg-transparent text-body-sm [&>summary]:px-0 [&>summary]:text-body-sm font-medium [&>summary]:font-medium [&>div]:px-0 [&>div]:pt-3"
        >
          {/* Mobile: stacked cards instead of wide horizontal table */}
          <div className="flex flex-col gap-2 md:hidden print:hidden">
            {report.sources.map((s, idx) => (
              <div key={idx} className="flex flex-col gap-1 rounded-md border border-line bg-surface p-3 text-body-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-ink">{s.label}</span>
                  <span className="rounded-pill bg-surface-sunken px-2 py-0.5 text-body-sm capitalize text-ink-muted">
                    {s.state}
                  </span>
                </div>
                {s.resolutionLabel ? (
                  <p className="m-0 font-mono text-body-sm text-ink-muted">Resolution: {s.resolutionLabel}</p>
                ) : null}
                {s.notes ? (
                  <p className="m-0 text-body-sm text-ink-muted">{s.notes}</p>
                ) : null}
              </div>
            ))}
          </div>

          {/* Desktop & Print: tabular evidence view */}
          <div className="hidden overflow-x-auto rounded-md border border-line bg-surface md:block print:block">
            <table className="w-full border-collapse text-left text-body-sm">
              <thead>
                <tr className="border-b border-line bg-surface-sunken text-ink-muted">
                  <th scope="col" className="p-2.5 font-semibold">Dataset</th>
                  <th scope="col" className="p-2.5 font-semibold">Status</th>
                  <th scope="col" className="p-2.5 font-semibold">Resolution</th>
                  <th scope="col" className="p-2.5 font-semibold">Notes & scope</th>
                </tr>
              </thead>
              <tbody>
                {report.sources.map((s, idx) => (
                  <tr key={idx} className="border-b border-line/60 last:border-0 align-top">
                    <td className="p-2.5 font-medium text-ink">{s.label}</td>
                    <td className="p-2.5">
                      <span className="rounded-pill bg-surface-sunken px-2 py-0.5 text-body-sm capitalize text-ink-muted">
                        {s.state}
                      </span>
                    </td>
                    <td className="p-2.5 font-mono text-ink-muted">{s.resolutionLabel ?? "—"}</td>
                    <td className="p-2.5 text-ink-muted">{s.notes ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-3 text-body-sm text-ink-tertiary leading-relaxed">
            {rCopy.disclaimer}
          </p>
        </Disclosure>
      </div>
    </section>
  );
}
