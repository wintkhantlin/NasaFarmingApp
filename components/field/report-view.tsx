"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { buttonClass } from "@/components/ui/button";
import { AnalysisLoading } from "@/components/field/analysis-loading";
import { NextSteps } from "@/components/field/next-steps";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { compareRotations } from "@/lib/engine/compare";
import { useFieldAnalysis } from "@/lib/analysis/use-analysis";
import { shortSlotName } from "@/lib/rotation-format";
import { useFieldRotations, useFieldsStore } from "@/lib/store/fields-store";
import { useAppCopy, useLocaleStore } from "@/lib/store/locale-store";
import { buildFarmerReport } from "@/lib/plan/farmer-report";

import { ReportHeader } from "@/components/field/report/report-header";
import { KeyFinding } from "@/components/field/report/key-finding";
import { RotationChoiceList } from "@/components/field/report/rotation-choice-list";
import { ReportCheckLocally } from "@/components/field/report/report-check-locally";
import { EvidenceDisclosure } from "@/components/field/report/evidence-disclosure";
import { ReportActions } from "@/components/field/report/report-actions";
import { ReportPrintView } from "@/components/field/report/report-print-view";

/** Decimal coordinate pairs typed into free text ("21.9162, 95.9560" or "21.916° N, 95.956° E") become a neutral phrase. */
const COORD_PAIR = /-?\d{1,3}\.\d{2,}(?:\s*°)?(?:\s*[NS])?\s*[,;/]\s*-?\d{1,3}\.\d{2,}(?:\s*°)?(?:\s*[EW])?\b/gi;
export function redactCoordinates(text: string): string {
  return text.replace(COORD_PAIR, "[location hidden]");
}

interface ReportViewProps {
  fieldId: string;
  initialHideLocation?: boolean;
}

export function ReportView({ fieldId, initialHideLocation = false }: ReportViewProps) {
  const status = useFieldsStore((s) => s.status);
  const field = useFieldsStore((s) => s.fields.find((f) => f.id === fieldId));
  const rotations = useFieldRotations(fieldId);
  const load = useFieldsStore((s) => s.load);
  const loadRotations = useFieldsStore((s) => s.loadRotations);
  const t = useAppCopy();
  const locale = useLocaleStore((s) => s.locale);
  const areaUnit = useLocaleStore((s) => s.areaUnit);

  const reportDate = useSyncExternalStore(
    () => () => undefined,
    () => new Date().toLocaleDateString(undefined, { dateStyle: "long" }),
    () => "",
  );

  useEffect(() => {
    if (status === "idle") void load();
  }, [status, load]);

  useEffect(() => {
    if (fieldId) void loadRotations(fieldId);
  }, [fieldId, loadRotations]);

  const analysis = useFieldAnalysis(field);
  const { engineData } = analysis;

  // Kept in component state: the choice lasts while this report is open
  const [hideLocation, setHideLocation] = useState(initialHideLocation);

  const comparison = useMemo(
    () => (engineData && rotations[0] && rotations[0].slots.length > 0 ? compareRotations(engineData, rotations[0]) : null),
    [engineData, rotations],
  );

  const isSatellitePending = analysis.satelliteImageryPending ?? analysis.retrieving;

  const farmerReport = useMemo(() => {
    if (!field || !comparison) return null;
    return buildFarmerReport({
      field,
      comparison,
      rotations,
      engineData,
      hideLocation,
      areaUnit,
      locale,
      t,
      satellitePending: isSatellitePending,
    });
  }, [field, comparison, rotations, engineData, hideLocation, areaUnit, locale, t, isSatellitePending]);

  if (status === "idle" || status === "loading") {
    return (
      <div role="status" aria-label={t.home.loading} className="flex flex-col gap-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  if (field && analysis.phase === "loading" && !analysis.conditions) {
    return (
      <AnalysisLoading
        title="Getting your summary ready"
        slow={analysis.slow}
        crops={(rotations[0]?.slots ?? []).filter((sl) => sl.kind !== "fallow").map((sl) => shortSlotName(sl))}
      />
    );
  }

  if (!field) {
    return (
      <EmptyState title="Field not found" body="This field isn't saved in this browser. Please return to your fields list.">
        <Link href="/" className={buttonClass("primary")}>
          Back to your fields
        </Link>
      </EmptyState>
    );
  }

  if (analysis.phase === "failed") {
    return (
      <EmptyState
        title="Report data is unavailable"
        body="Your saved field and rotation remain on this device. Check your connection, then retry; no crop choice has been changed."
      >
        <button type="button" className={buttonClass("primary")} onClick={analysis.retry}>
          Retry data check (uses a little data)
        </button>
        <Link href={`/fields/${fieldId}`} className={buttonClass("secondary")}>
          Back to field
        </Link>
      </EmptyState>
    );
  }

  if (!field.locationConfirmed || rotations[0]?.source !== "farmer") {
    return (
      <EmptyState
        title="Confirm your field and crop sequence"
        body="A field-informed report needs your confirmed location and recorded current crops. Regional examples do not establish your actual rotation."
      >
        <Link href={`/fields/${field.id}`} className={buttonClass("primary")}>
          Review field details
        </Link>
        <Link href={`/fields/${field.id}/rotation`} className={buttonClass("secondary")}>
          Review current crops
        </Link>
      </EmptyState>
    );
  }

  if (!comparison || !farmerReport) {
    return (
      <EmptyState
        title="Nothing to report yet"
        body="The report compares your rotation with other options, so it needs your rotation first."
      >
        <Link href={`/fields/${field.id}/rotation`} className={buttonClass("primary")}>
          Add your rotation
        </Link>
      </EmptyState>
    );
  }

  return (
    <>
      {/* Interactive Screen View */}
      <article
        aria-label={`${t.report.title}: ${farmerReport.fieldName}`}
        className="print:hidden mx-auto flex w-full max-w-4xl flex-col gap-6"
      >
        {/* Background satellite job status notification */}
        {isSatellitePending ? (
          <div
            role="status"
            aria-live="polite"
            className="flex items-center justify-between gap-3 rounded-md border border-line bg-surface-sunken p-3 text-body-sm text-ink-muted"
          >
            <span>Satellite imagery check still running. This report uses available regional data.</span>
          </div>
        ) : null}

        {/* Zone A: Header */}
        <ReportHeader
          report={farmerReport}
          hideLocation={hideLocation}
          onToggleHideLocation={setHideLocation}
          reportDate={reportDate}
          t={t}
        />

        {/* Zone B: Key Finding */}
        <KeyFinding report={farmerReport} t={t} />

        {/* Zone C: Choice Comparison */}
        <RotationChoiceList report={farmerReport} t={t} />

        {/* Zone D: Check Locally */}
        <ReportCheckLocally report={farmerReport} t={t} />

        {/* Zone E: Evidence Footer (md:hidden print:hidden on mobile cards, md:block print:block on desktop & print) */}
        <EvidenceDisclosure report={farmerReport} t={t} />

        {/* Zone F: Actions */}
        <ReportActions fieldId={field.id} fieldName={farmerReport.fieldName} t={t} />

        <NextSteps fieldId={field.id} current="report" />
      </article>

      {/* Dedicated One-Page A4 Print Layout */}
      <ReportPrintView report={farmerReport} reportDate={reportDate} t={t} />
    </>
  );
}
