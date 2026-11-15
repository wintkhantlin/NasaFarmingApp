"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { RiskChip } from "@/components/ui/risk-chip";
import type { RiskEvidence } from "@/lib/conditions/condition-evidence";
import type { TrendSeries } from "@/lib/server/trends";
import type { Crop } from "@/lib/types";

export interface HeatColdPanelProps {
  evidence: RiskEvidence;
  crop?: Crop | null;
  className?: string;
}

export function HeatColdPanel({
  evidence,
  crop,
  className = "",
}: HeatColdPanelProps) {
  const [subView, setSubView] = useState<"heat" | "cold">("heat");

  const raw = evidence.raw as
    | {
        tmax?: number[];
        tmin?: number[];
        hotSeries?: TrendSeries;
        coldSeries?: TrendSeries;
      }
    | undefined;

  const tmax = raw?.tmax;
  const tmin = raw?.tmin;
  const coldSeries = raw?.coldSeries;
  const selectedYear = evidence.time.selectedYear ?? 2025;
  const coldPt = coldSeries?.years.find((y) => y.year === selectedYear);
  const coldDaysValue = coldPt && coldPt.value !== null ? coldPt.value : null;

  const metric = evidence.metric;
  const hotDaysValue = metric?.value;

  return (
    <div
      role="region"
      aria-label="Heat and cold evidence analysis"
      className={`flex flex-col gap-4 border-t border-line pt-4 ${className}`}
    >
      {/* Sub-view toggle (Heat vs Cold within 1 single risk) */}
      <div className="flex items-center justify-between gap-2">
        <div className="inline-flex rounded-md bg-surface-sunken p-0.5">
          <button
            type="button"
            aria-pressed={subView === "heat"}
            onClick={() => setSubView("heat")}
            className={`flex min-h-[36px] items-center gap-1.5 rounded px-3 text-body-sm font-medium transition-colors ${
              subView === "heat"
                ? "bg-surface text-ink shadow-xs"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            <Icon name="conditions" size={14} />
            High heat (≥35 °C)
          </button>
          <button
            type="button"
            aria-pressed={subView === "cold"}
            onClick={() => setSubView("cold")}
            className={`flex min-h-[36px] items-center gap-1.5 rounded px-3 text-body-sm font-medium transition-colors ${
              subView === "cold"
                ? "bg-surface text-ink shadow-xs"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            <Icon name="conditions" size={14} />
            Cold & frost nights
          </button>
        </div>

        {subView === "heat" ? (
          <RiskChip hazard="heat">
            {hotDaysValue !== undefined ? `${hotDaysValue} days ≥35 °C` : "Regional heat"}
          </RiskChip>
        ) : (
          <RiskChip hazard="frost">
            {coldDaysValue !== null ? `${coldDaysValue} cool nights` : "Night cold context"}
          </RiskChip>
        )}
      </div>

      {/* Sub-view Content: Heat */}
      {subView === "heat" && (
        <div className="flex flex-col gap-2.5">
          <div className="border-l-2 border-line pl-3">
            <p className="m-0 text-source text-ink-muted">Hot days before the monsoon (Mar–May)</p>
            <p className="m-0 mt-0.5 text-body font-semibold text-ink">
              {hotDaysValue !== undefined
                ? `${selectedYear} had ${hotDaysValue} days at or above 35 °C`
                : "Dynamic temperature records unavailable for this year"}
            </p>
            <p className="m-0 mt-1 text-source text-ink-muted">
              NASA POWER gridded 2-meter air temperature. Single-day count above 35 °C; does not
              imply continuous multi-day heatwaves.
            </p>
          </div>

          <div className="flex items-start gap-2 border-l-2 border-line pl-3">
            <Icon name="info" size={18} className="shrink-0 text-ink-muted mt-0.5" />
            <div className="text-source">
              <p className="m-0 font-medium text-ink">Air heat is not crop heat</p>
              <p className="m-0 mt-0.5 text-ink-muted">
                Dry soils and water-stressed plants can experience canopy temperatures 2–5 °C higher
                than air temperature, while irrigated crops transpire to cool the canopy.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Sub-view Content: Cold */}
      {subView === "cold" && (
        <div className="flex flex-col gap-2.5">
          <div className="border-l-2 border-line pl-3">
            <p className="m-0 text-source text-ink-muted">Cool winter nights (Nov–Feb, lows of 12 °C or less)</p>
            <p className="m-0 mt-0.5 text-body font-semibold text-ink">
              {coldDaysValue !== null
                ? `${selectedYear} had ${coldDaysValue} nights at or below 12 °C`
                : tmin && tmin.length === 12
                  ? `Lowest monthly night average near ${Math.round(Math.min(...tmin))} °C`
                  : "Monthly night temperature averages unavailable"}
            </p>
            <p className="m-0 mt-1 text-source text-ink-muted">
              NASA POWER gridded 2-meter air temperature. In lowland tropical Myanmar, winter night alerts indicate crop chilling and spikelet sterility risk rather than ground frost (freezing frost requires elevations &gt;800 m).
            </p>
          </div>
        </div>
      )}

      {/* Crop-Stage Sensitivity Gate */}
      <div className="border-l-2 border-line pl-3 text-source">
        <p className="m-0 font-medium text-ink">Crop stage and heat</p>
        {crop ? (
          <p className="m-0 mt-0.5 text-ink-muted">
            {crop.names.common} optimal temperature is {crop.temp.optMinC}–{crop.temp.optMaxC} °C.{" "}
            {crop.temp.heatFloweringC
              ? `Flowering is sensitive to temperatures exceeding ${crop.temp.heatFloweringC} °C.`
              : "Check whether flowering overlaps peak April–May heat."}
          </p>
        ) : (
          <p className="m-0 mt-0.5 text-ink-muted">
            Crop-stage exposure not evaluated. Link a confirmed crop rotation calendar to inspect
            whether sensitive flowering or grain-fill stages overlap extreme heat.
          </p>
        )}
      </div>

      {/* Truthfulness Safety Gate */}
      <div className="text-source text-ink-muted space-y-1">
        <p className="m-0">
          • <strong>Heat exceedance ≠ heatwave:</strong> Single hot days do not equate to prolonged heatwaves without consecutive-day confirmation.
        </p>
        <p className="m-0">
          • <strong>Screening, not crop failure:</strong> Temperature models cannot predict yield loss without variety, irrigation, and field management.
        </p>
      </div>
    </div>
  );
}
