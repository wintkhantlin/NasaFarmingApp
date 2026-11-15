"use client";

import type { FarmerReport } from "@/lib/plan/farmer-report";
import type { AppCopy } from "@/lib/store/locale-store";

interface ReportHeaderProps {
  report: FarmerReport;
  hideLocation: boolean;
  onToggleHideLocation: (hidden: boolean) => void;
  reportDate: string;
  t: AppCopy;
}

export function ReportHeader({
  report,
  hideLocation,
  onToggleHideLocation,
  reportDate,
  t,
}: ReportHeaderProps) {
  const rCopy = t.report;

  return (
    <header className="flex flex-col gap-4 border-b border-line pb-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-body-sm text-ink-muted">
        <span className="font-medium tracking-tight text-ink">{t.app.name}</span>
        <time className="tabular font-mono text-ink-muted">
          {rCopy.preparedDate(reportDate || report.processedAt)}
        </time>
      </div>

      <div className="flex flex-col gap-1">
        <h1 className="text-display text-ink">{report.fieldName}</h1>
        <p className="m-0 flex flex-wrap items-center gap-x-2 gap-y-1 text-body font-medium text-ink-muted">
          <span>{report.regionLabel}</span>
          <span aria-hidden="true">·</span>
          <span>{report.area.text}</span>
          <span aria-hidden="true">·</span>
          <span>{report.waterAccess.label}</span>
          <span aria-hidden="true">·</span>
          <span className="tabular font-mono text-body-sm text-ink">
            {hideLocation ? rCopy.locationHidden : report.coordinatesText}
          </span>
        </p>
      </div>

      <div className="pt-1">
        <label className="flex min-h-tap cursor-pointer items-start gap-3 text-body-sm text-ink">
          <input
            type="checkbox"
            checked={hideLocation}
            onChange={(e) => onToggleHideLocation(e.target.checked)}
            className="mt-0.5 size-5 shrink-0 accent-[var(--color-field)]"
          />
          <span className="flex flex-col">
            <span className="font-semibold text-ink">{rCopy.hideLocation}</span>
            <span className="text-body-sm text-ink-muted">{rCopy.hideLocationHelp}</span>
          </span>
        </label>
      </div>
    </header>
  );
}
