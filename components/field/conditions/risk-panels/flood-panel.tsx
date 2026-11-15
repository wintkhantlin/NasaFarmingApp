"use client";

import { Icon } from "@/components/ui/icon";
import { RiskChip } from "@/components/ui/risk-chip";
import { formatShortDate } from "@/lib/conditions/explorer-model";
import type { RiskEvidence } from "@/lib/conditions/condition-evidence";

export interface FloodPanelProps {
  evidence: RiskEvidence;
  className?: string;
}

export function FloodPanel({ evidence, className = "" }: FloodPanelProps) {
  const quality = evidence.quality;
  const isAvailable = evidence.status === "ready" || evidence.status === "partial";
  const validFraction = quality?.validFraction ?? 0;
  const observationDate = evidence.time.selectedDate;

  const raw = evidence.raw as
    | {
        waterPixels?: number;
        totalPixels?: number;
        waterFraction?: number;
      }
    | undefined;

  const waterPixels = raw?.waterPixels ?? 0;
  const totalPixels = raw?.totalPixels ?? 0;
  const hasWater = isAvailable && waterPixels > 0;

  return (
    <div
      role="region"
      aria-label="Flood and surface water analysis"
      className={`flex flex-col gap-4 border-t border-line pt-4 ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h5 className="m-0 text-label text-ink">
          Satellite water check
        </h5>
        {isAvailable ? (
          hasWater ? (
            <RiskChip hazard="water">Observed surface water</RiskChip>
          ) : (
            <RiskChip hazard="neutral">No surface water detected</RiskChip>
          )
        ) : (
          <RiskChip hazard="neutral">No valid scene</RiskChip>
        )}
      </div>

      {/* Observation Status Callout */}
      {isAvailable && observationDate ? (
        <div className="flex flex-col gap-2 border-l-2 border-line pl-3">
          <div className="flex items-center justify-between text-body-sm">
            <span className="font-medium text-ink">Observation date:</span>
            <span className="font-semibold text-ink">{formatShortDate(observationDate)}</span>
          </div>
          {quality && (
            <div className="flex items-center justify-between text-source text-ink-muted">
              <span>Scene cloud-free clarity:</span>
              <span>{Math.round(validFraction * 100)}% valid pixels</span>
            </div>
          )}
          <div className="flex items-center justify-between text-source text-ink-muted">
            <span>Surface water detected:</span>
            <span className={hasWater ? "font-semibold text-water" : "text-ink"}>
              {hasWater
                ? `${Math.round((waterPixels / (totalPixels || 1)) * 100)}% of field (${waterPixels}/${totalPixels} pixels)`
                : `0% (0 of ${totalPixels} pixels)`}
            </span>
          </div>
        </div>
      ) : (
        <div className="border-l-2 border-line pl-3 text-source text-ink-muted">
          No cloud-free optical observation was captured for this field on the selected date. Cloud cover
          during peak monsoon periods frequently masks satellite views.
        </div>
      )}

      {/* Agricultural Context: Paddy vs Damaging Flood */}
      <div className="border-l-2 border-line pl-3">
        <div className="flex items-start gap-2">
          <Icon name="salinity" size={18} className="shrink-0 text-ink-muted mt-0.5" />
          <div className="text-source">
            <p className="m-0 font-medium text-ink">Paddy water is not always flooding</p>
            <p className="m-0 mt-0.5 text-ink-muted">
              Deliberately impounded standing water in bunded rice paddies cannot be distinguished
              from destructive flood waters by satellite water indices. Local verification is required.
            </p>
          </div>
        </div>
      </div>

      {/* Truthfulness Safety Gate */}
      <div className="text-source text-ink-muted space-y-1">
        <p className="m-0">
          • <strong>No flood depth:</strong> Satellite water classification measures surface presence only, not water depth in meters.
        </p>
        <p className="m-0">
          • <strong>No recurrence model:</strong> NASA imagery indicates historical presence, not 1-in-100 year return period probability.
        </p>
      </div>
    </div>
  );
}
