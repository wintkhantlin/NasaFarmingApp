"use client";

import type { FarmerReport } from "@/lib/plan/farmer-report";
import type { AppCopy } from "@/lib/store/locale-store";

interface ReportPrintViewProps {
  report: FarmerReport;
  reportDate: string;
  t: AppCopy;
}

export function ReportPrintView({ report, reportDate, t }: ReportPrintViewProps) {
  const rCopy = t.report;

  return (
    <article
      aria-label={`${rCopy.title}: ${report.fieldName}`}
      className="hidden print:flex print:flex-col print:gap-3.5 print:bg-white print:text-black print:p-0 print:m-0 text-[10.5pt] leading-tight font-sans"
    >
      {/* 1. Header & Overview */}
      <header className="border-b-2 border-black pb-2 break-inside-avoid">
        <div className="flex items-baseline justify-between text-[9pt] text-gray-700">
          <span className="font-bold tracking-tight text-black">{t.app.name} · {rCopy.title}</span>
          <time className="tabular font-mono">{rCopy.preparedDate(reportDate || report.processedAt)}</time>
        </div>
        <div className="mt-1 flex items-baseline justify-between gap-4">
          <h1 className="m-0 text-[16pt] font-bold text-black">{report.fieldName}</h1>
          <div className="text-right text-[9pt] text-gray-800">
            <span>{report.regionLabel} · {report.area.text} · {report.waterAccess.label}</span>
          </div>
        </div>
        <div className="mt-0.5 text-[8.5pt] text-gray-600">
          {report.hideExactLocation ? (
            <span>Location: {report.regionLabel} (exact coordinates hidden for privacy)</span>
          ) : (
            <span>Location: {report.coordinatesText}</span>
          )}
        </div>
      </header>

      {/* 2. Key Finding */}
      <section aria-labelledby="print-finding" className="rounded-sm border border-black/30 bg-gray-50/50 p-2.5 break-inside-avoid">
        <div className="flex items-baseline justify-between gap-2 border-b border-black/15 pb-1 mb-1">
          <h2 id="print-finding" className="m-0 text-[11pt] font-bold text-black uppercase tracking-wide">
            {rCopy.findingHeading}
          </h2>
          <span className="text-[9pt] font-semibold text-gray-800">
            {report.priorityLabel}
          </span>
        </div>
        <p className="m-0 text-[10pt] leading-normal font-medium text-black">
          {report.keyFindingText}
        </p>
        {report.keyFindingWarning ? (
          <p className="m-0 mt-1 text-[8.5pt] text-gray-700 italic">
            Warning: {report.keyFindingWarning}
          </p>
        ) : null}
      </section>

      {/* 3. Four-Row Rotation Comparison Table */}
      <section aria-labelledby="print-comparison" className="break-inside-avoid">
        <h2 id="print-comparison" className="m-0 mb-1 text-[11pt] font-bold text-black">
          {rCopy.rotationComparison}
        </h2>
        <table className="w-full border-collapse text-left text-[9pt]">
          <thead>
            <tr className="border-b-2 border-black bg-gray-100 text-black">
              <th scope="col" className="py-1 px-1.5 font-bold w-[34%]">Sequence</th>
              <th scope="col" className="py-1 px-1.5 font-bold w-[18%]">Type</th>
              <th scope="col" className="py-1 px-1.5 font-bold w-[24%]">Modelled shortfall</th>
              <th scope="col" className="py-1 px-1.5 font-bold w-[24%]">Screening status</th>
            </tr>
          </thead>
          <tbody>
            {report.choices.map((choice, i) => (
              <tr key={choice.id} className="border-b border-black/30 break-inside-avoid align-top">
                <td className="py-1.5 px-1.5 font-semibold text-black leading-snug">
                  {i + 1}. {choice.cropSequence.join(" → ")}
                  <span className="block text-[8pt] font-normal text-gray-600 mt-0.5">
                    {choice.reason}
                  </span>
                </td>
                <td className="py-1.5 px-1.5">
                  <span className="font-medium text-black">
                    {choice.isFarmerCurrent
                      ? rCopy.currentRotationTag
                      : choice.cycleYears > 1
                        ? rCopy.multiYearTag(choice.cycleYears)
                        : rCopy.alternativeTag}
                  </span>
                </td>
                <td className="py-1.5 px-1.5 tabular">
                  {choice.shortfall.state === "not_applicable" ? (
                    <span className="text-gray-700 italic">{rCopy.fallowPrintNote}</span>
                  ) : choice.shortfall.value !== null ? (
                    <div>
                      <span className="font-bold text-black">{choice.shortfall.value} mm/crop</span>
                      {choice.cycleYears > 1 ? (
                        <span className="block text-[8pt] text-gray-600 italic">2-year cycle</span>
                      ) : null}
                    </div>
                  ) : (
                    <span className="text-gray-600">Not known</span>
                  )}
                </td>
                <td className="py-1.5 px-1.5">
                  <span className="text-black font-medium">{choice.fieldScreeningLabel}</span>
                  {choice.legumeShare !== null ? (
                    <span className="block text-[8pt] text-gray-600">
                      Legumes: {Math.round(choice.legumeShare * 100)}% of crops
                    </span>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* 4. Before You Decide: 3 Local Checks */}
      <section aria-labelledby="print-checks" className="border-t border-black/30 pt-2 break-inside-avoid">
        <h2 id="print-checks" className="m-0 mb-1 text-[11pt] font-bold text-black">
          {rCopy.checkLocallyTitle} — {rCopy.checkLocallySubtitle}
        </h2>
        <div className="grid grid-cols-1 gap-1 pl-1">
          {report.checkLocallyQuestions.map((q, idx) => (
            <div key={idx} className="flex items-start gap-2 text-[9pt] text-black">
              <span className="inline-block size-3.5 border border-black rounded-xs shrink-0 mt-0.5" />
              <span>{q}</span>
            </div>
          ))}
        </div>

        {report.localNotes.length > 0 ? (
          <div className="mt-2 text-[8.5pt] text-gray-800 bg-gray-50 p-1.5 border border-black/20">
            <span className="font-bold">Recorded field notes: </span>
            {report.localNotes.map((n, i) => (
              <span key={i}>
                [{n.topic}: {n.text}]{i < report.localNotes.length - 1 ? "; " : ""}
              </span>
            ))}
          </div>
        ) : null}
      </section>

      {/* 5. Provenance & Limitations Footer */}
      <footer className="border-t-2 border-black pt-1.5 text-[8pt] leading-tight text-gray-700 break-inside-avoid">
        <p className="m-0 font-bold text-black mb-0.5">
          {rCopy.evidenceSummary}:
        </p>
        <p className="m-0">
          • {rCopy.weatherSource(report.baselineYears.count, report.baselineYears.start, report.baselineYears.end)}
        </p>
        <p className="m-0">
          • {rCopy.soilSource}
        </p>
        <p className="m-0 text-gray-600">
          • Unavailable: GPM IMERG rainfall (NASA POWER used); SMAP root-zone moisture (not used); SRTM terrain (slope/erosion unverified).
        </p>
        <p className="m-0 mt-1 font-medium text-black">
          {rCopy.disclaimer}
        </p>
      </footer>
    </article>
  );
}
