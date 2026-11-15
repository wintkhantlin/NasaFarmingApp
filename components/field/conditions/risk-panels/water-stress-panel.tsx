"use client";

import { Icon } from "@/components/ui/icon";
import { RiskChip } from "@/components/ui/risk-chip";
import type { RiskEvidence } from "@/lib/conditions/condition-evidence";
import type { Crop } from "@/lib/types";

export interface WaterStressPanelProps {
  evidence: RiskEvidence;
  crop?: Crop | null;
  className?: string;
}

export function WaterStressPanel({
  evidence,
  crop,
  className = "",
}: WaterStressPanelProps) {
  const raw = evidence.raw as
    | {
        annualRain?: number;
        dryMonthsCount?: number;
        latestSmap?: { date: string; rootzone: number | null };
        imerg?: {
          status: string;
          covered: number;
          expected: number;
        };
      }
    | undefined;

  const dryCount = raw?.dryMonthsCount ?? 0;
  const hasSmap = !!raw?.latestSmap;
  const imerg = raw?.imerg;

  return (
    <div
      role="region"
      aria-label="Water stress evidence analysis"
      className={`flex flex-col gap-4 border-t border-line pt-4 ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h5 className="m-0 text-label text-ink">
          Rain against crop water demand
        </h5>
        {dryCount > 0 ? (
          <RiskChip hazard="drought">
            {dryCount} dry {dryCount === 1 ? "month" : "months"}
          </RiskChip>
        ) : (
          <RiskChip hazard="neutral">Balanced</RiskChip>
        )}
      </div>

      {/* Explanation of ETc vs Irrigation */}
      <p className="m-0 text-body-sm text-ink-muted">
        Reference crop demand (ET₀) reflects atmospheric drying in this region. Crop demand
        (ETc) is well-watered potential demand, not actual measured water uptake. A rainfall
        gap indicates when crops need stored soil moisture or irrigation, not total water needed.
      </p>

      {/* SMAP Status Card */}
      <div className="flex items-start gap-2.5 border-l-2 border-line pl-3">
        <Icon
          name="water"
          size={18}
          className={hasSmap ? "text-field shrink-0" : "text-ink-muted shrink-0"}
        />
        <div className="text-source">
          <p className="m-0 font-medium text-ink">
            {hasSmap
              ? "Regional soil moisture (SMAP, 9 km)"
              : "Regional soil moisture: not available"}
          </p>
          <p className="m-0 mt-0.5 text-ink-muted">
            {hasSmap
              ? "Regional root-zone wetness observation retrieved. Represents surrounding 9 km area."
              : "SMAP satellite observations are not connected or outside safe window. Missing data is not treated as adequate moisture."}
          </p>
        </div>
      </div>

      {/* GPM IMERG Precipitation Status */}
      {imerg && imerg.status === "ok" && (
        <div className="flex items-start gap-2.5 border-l-2 border-line pl-3">
          <Icon name="water" size={18} className="text-field shrink-0 mt-0.5" />
          <div className="text-source">
            <p className="m-0 font-medium text-ink">
              GPM IMERG Satellite Precipitation (0.1° / ~10 km)
            </p>
            <p className="m-0 mt-0.5 text-ink-muted">
              {imerg.covered} daily satellite precipitation records available for this field&apos;s grid cell.
            </p>
          </div>
        </div>
      )}

      {/* Root-Zone Storage Truthfulness Gate */}
      <div className="border-l-2 border-line pl-3">
        <p className="m-0 text-source font-medium text-ink">Soil water at planting</p>
        <p className="m-0 mt-0.5 text-source text-ink-muted">
          Cannot estimate field soil water at planting yet without verified pre-sowing soil
          sampling. Do not assume the soil is full or empty.
        </p>
      </div>

      {crop && crop.water?.seasonMm && (
        <p className="m-0 text-source text-ink-muted">
          Crop sensitivity: <strong>{crop.names.common}</strong> typical water requirement is{" "}
          {crop.water.seasonMm.min}–{crop.water.seasonMm.max} mm per season.
        </p>
      )}
    </div>
  );
}
