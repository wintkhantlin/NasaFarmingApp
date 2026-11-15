"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { Rating, gapLevel } from "@/components/field/results/plan-scale";
import { cn } from "@/lib/cn";
import type { ReportChoice } from "@/lib/plan/farmer-report";
import type { AppCopy } from "@/lib/store/locale-store";

interface RotationChoiceRowProps {
  choice: ReportChoice;
  index: number;
  showBar: boolean;
  maxShortfall: number;
  t: AppCopy;
}

export function RotationChoiceRow({
  choice,
  index,
  showBar,
  maxShortfall,
  t,
}: RotationChoiceRowProps) {
  const [expanded, setExpanded] = useState(false);
  const rCopy = t.report;

  const pct = (n: number) => `${Math.round(n * 100)}%`;

  // Option tag
  const typeTag = choice.isFarmerCurrent
    ? rCopy.currentRotationTag
    : choice.cycleYears > 1
      ? rCopy.multiYearTag(choice.cycleYears)
      : rCopy.alternativeTag;

  // Shortfall text & value
  const isComparable = choice.shortfall.comparable && choice.shortfall.value !== null;
  const shortfallValue = choice.shortfall.value;

  const barWidthPct =
    showBar && isComparable && shortfallValue !== null
      ? Math.min(100, Math.max(8, Math.round((shortfallValue / maxShortfall) * 100)))
      : 0;

  return (
    <li
      className={cn(
        "flex flex-col gap-3 rounded-md border border-line bg-surface p-4 sm:p-5 transition-colors",
        choice.isFarmerCurrent && "border-line-strong bg-surface-raised"
      )}
    >
      {/* Top Header: Badge and Option Type */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="tabular grid size-6 place-items-center rounded-pill border border-line-strong font-mono text-body-sm text-ink"
          >
            {index + 1}
          </span>
          <span
            className={cn(
              "rounded-pill px-2.5 py-0.5 text-body-sm font-semibold",
              choice.isFarmerCurrent
                ? "bg-field-soft text-field"
                : "bg-surface-sunken text-ink-muted border border-line"
            )}
          >
            {typeTag}
          </span>
        </div>

        <span className="text-body-sm font-medium text-ink-muted">
          {choice.fieldScreeningLabel}
        </span>
      </div>

      {/* Sequence Title */}
      <div>
        <h3 className="m-0 text-title font-semibold text-ink leading-snug break-words">
          {choice.cropSequence.join(" → ")}
        </h3>
      </div>

      {/* The answer in words: how much of a water gap this sequence faces, on a Good / Fair / Risky scale. The exact figure follows. */}
      {isComparable && shortfallValue !== null ? (
        <div className="flex items-start gap-4">
          <span className="flex items-center gap-1.5 pt-0.5 text-body-sm text-ink-muted">
            <Icon name="water" size={16} aria-hidden />
            Water
          </span>
          <Rating level={gapLevel(shortfallValue)} detail={`Modelled water shortfall ${shortfallValue} ${choice.shortfall.unit}.`} />
        </div>
      ) : null}

      {/* The figure behind it */}
      <div className="flex flex-col gap-1.5 pt-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-body-sm">
          <span className="text-ink-muted">{choice.shortfall.label}:</span>
          <span className="tabular font-medium text-ink">
            {choice.shortfall.state === "not_applicable"
              ? choice.shortfall.explanation
              : choice.shortfall.value !== null
                ? `${choice.shortfall.value} ${choice.shortfall.unit}`
                : "Not known"}
          </span>
        </div>

        {/* Optional Bar Chart */}
        {showBar && isComparable && shortfallValue !== null ? (
          <div className="flex flex-col gap-1" aria-hidden="true">
            <div className="h-2 w-full overflow-hidden rounded-pill bg-surface-sunken border border-line">
              <div
                className="h-full rounded-pill bg-field transition-all duration-300"
                style={{ width: `${barWidthPct}%` }}
              />
            </div>
            <div className="flex justify-between text-body-sm text-ink-tertiary">
              <span>0 mm</span>
              <span>{maxShortfall} mm</span>
            </div>
          </div>
        ) : null}

        {/* Note if cycle lengths differ */}
        {choice.cycleYears > 1 ? (
          <p className="m-0 text-body-sm text-ink-muted italic">
            {choice.shortfall.explanation}
          </p>
        ) : null}
      </div>

      {/* Plain Language Reason */}
      <p className="m-0 text-body-sm text-ink-muted leading-relaxed">
        {choice.reason}
      </p>

      {/* Expand/Collapse Accessible Toggle */}
      <div className="border-t border-line/60 pt-2">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
          aria-controls={`choice-details-${choice.id}`}
          className="inline-flex min-h-tap cursor-pointer items-center gap-1.5 text-body-sm font-medium text-field hover:underline focus:outline-none"
        >
          <span>{expanded ? rCopy.hideDetails : rCopy.viewDetails}</span>
          <Icon
            name={expanded ? "up" : "down"}
            size={16}
            aria-hidden="true"
            className="transition-transform"
          />
        </button>

        {/* Expandable Technical & Agronomic Details */}
        {expanded ? (
          <div
            id={`choice-details-${choice.id}`}
            className="mt-3 flex flex-col gap-3 rounded-md bg-surface-sunken p-3.5 text-body-sm"
          >
            <dl className="m-0 grid gap-x-4 gap-y-2 sm:grid-cols-[12rem_minmax(0,1fr)]">
              <dt className="text-ink-muted">Crops in sequence</dt>
              <dd className="m-0 font-medium text-ink">{choice.cropSequence.join(" → ")}</dd>

              <dt className="text-ink-muted">Crop in field</dt>
              <dd className="tabular m-0 text-ink">{pct(choice.daysWithCropShare)} of cycle</dd>

              <dt className="text-ink-muted">Legume share</dt>
              <dd className="tabular m-0 text-ink">
                {choice.legumeShare !== null ? pct(choice.legumeShare) : "None or unknown"}
              </dd>

              {choice.dryYearPasses ? (
                <>
                  <dt className="text-ink-muted">Past dry seasons passed</dt>
                  <dd className="tabular m-0 text-ink">
                    {choice.dryYearPasses.passes} of {choice.dryYearPasses.evaluated} evaluated dry seasons
                  </dd>
                </>
              ) : null}

              <dt className="text-ink-muted">Erosion exposure</dt>
              <dd className="m-0 text-ink">
                {choice.erosionExposure === "needs-slope-data"
                  ? rCopy.terrainWarning
                  : choice.erosionExposure ?? "Not evaluated"}
              </dd>

              <dt className="text-ink-muted">Screening check</dt>
              <dd className="m-0 text-ink">{choice.fieldScreeningLabel}</dd>
            </dl>

            {choice.unresolvedChecks.length > 0 ? (
              <div className="flex flex-col gap-1 border-t border-line/60 pt-2">
                <span className="text-body-sm font-semibold text-ink">Things to check locally:</span>
                <ul className="m-0 flex list-disc flex-col gap-0.5 pl-5 text-body-sm text-ink-muted">
                  {choice.unresolvedChecks.map((u, i) => (
                    <li key={i}>{u}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </li>
  );
}
