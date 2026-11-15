"use client";

import { Icon } from "@/components/ui/icon";
import { RiskChip } from "@/components/ui/risk-chip";
import type { RiskEvidence } from "@/lib/conditions/condition-evidence";

export interface ErosionPanelProps {
  evidence: RiskEvidence;
  className?: string;
}

export function ErosionPanel({ evidence, className = "" }: ErosionPanelProps) {
  const raw = evidence.raw as
    | {
        slopeMedian?: number | null;
        slopeLabel?: string;
        soilTexture?: string | null;
        coverGaps?: number;
      }
    | undefined;

  const slopeMedian = raw?.slopeMedian ?? null;
  const slopeLabel = raw?.slopeLabel ?? "Unknown";
  const soilTexture = raw?.soilTexture;
  const coverGaps = raw?.coverGaps ?? 0;
  const hasSlope = slopeMedian !== null;

  return (
    <div
      role="region"
      aria-label="Erosion and terrain analysis"
      className={`flex flex-col gap-4 border-t border-line pt-4 ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h5 className="m-0 text-label text-ink">
          Terrain and soil
        </h5>
        {hasSlope ? (
          <RiskChip hazard="neutral">Topographic screening</RiskChip>
        ) : (
          <RiskChip hazard="neutral">Slope missing</RiskChip>
        )}
      </div>

      {/* Slope & Texture Evidence Cards */}
      {hasSlope ? (
        <div className="grid grid-cols-2 gap-2.5">
          <div className="border-l-2 border-line pl-3">
            <p className="m-0 text-source text-ink-muted">Median Slope (SRTM 30 m)</p>
            <p className="m-0 text-body font-semibold text-ink">
              {slopeMedian.toFixed(1)}°
            </p>
            <p className="m-0 text-source text-ink-muted">{slopeLabel}</p>
          </div>
          <div className="border-l-2 border-line pl-3">
            <p className="m-0 text-source text-ink-muted">Soil Texture (SoilGrids)</p>
            <p className="m-0 text-body font-semibold text-ink">
              {soilTexture ?? "Regional estimate"}
            </p>
            <p className="m-0 text-source text-ink-muted">Upper 30 cm layer</p>
          </div>
        </div>
      ) : (
        <div className="border-l-2 border-line pl-3 text-source text-ink-muted">
          Slope data is not available, so field erosion exposure cannot be assessed. Digital elevation model
          coverage is missing or unverified for this coordinate.
        </div>
      )}

      {/* Planned Bare Soil Cover Gaps */}
      {coverGaps > 0 && (
        <div className="border-l-2 border-line pl-3">
          <p className="m-0 text-source font-medium text-ink">Planned bare-soil periods</p>
          <p className="m-0 mt-0.5 text-source text-ink-muted">
            The saved rotation includes {coverGaps} period{coverGaps === 1 ? "" : "s"} of low soil cover.
            Uncovered soil is vulnerable to sheet wash during high-intensity tropical rain events.
          </p>
        </div>
      )}

      {/* Distinction of Erosion Types */}
      <div className="flex items-start gap-2 border-l-2 border-line pl-3">
        <Icon name="clay" size={18} className="shrink-0 text-ink-muted mt-0.5" />
        <div className="text-source">
          <p className="m-0 font-medium text-ink">Kinds of erosion this does not cover</p>
          <p className="m-0 mt-0.5 text-ink-muted">
            Topographic slope screening applies to surface runoff and rill formation. It does not measure
            riverbank collapse, lowland sediment deposition, or landslide hazards.
          </p>
        </div>
      </div>

      {/* Truthfulness Safety Gate */}
      <div className="text-source text-ink-muted space-y-1">
        <p className="m-0">
          • <strong>Screening only:</strong> Topography indicates potential runoff speed, never actual soil loss in tonnes/ha.
        </p>
        <p className="m-0">
          • <strong>No safe rating:</strong> Without farmer-verified bunds, cover residues, and tillage, no field can be rated erosion-safe.
        </p>
      </div>
    </div>
  );
}
