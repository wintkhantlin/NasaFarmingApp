"use client";

import { useMemo } from "react";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";
import { seedbedMoistureWindow, type SeedbedWindowResult } from "@/lib/engine/water";

export interface MoistureClockProps {
  hasConfirmedSoil: boolean;
  hasConfirmedDrainageDate: boolean;
  awcMmPerM?: number | null;
  thetaSat?: number | null;
  thetaFc?: number | null;
  pondAtDrainageMm?: number | null;
  kPanMmDay?: number;
  className?: string;
}

/**
 * Honest Post-Harvest Seedbed Moisture Clock (Prompt 8, U-03).
 * If soil properties or drainage dates are unconfirmed, displays
 * 'Check topsoil moisture and drainage before sowing' without a fabricated countdown.
 * When confirmed, illustrates the 3 physical drydown phases:
 *   1. 'May still be too wet' (plough-pan perched water draining)
 *   2. 'Field may be ready' (optimal workable seedbed)
 *   3. 'May be drying' (topsoil desiccated)
 */
export function MoistureClockRibbon({
  hasConfirmedSoil,
  hasConfirmedDrainageDate,
  awcMmPerM,
  thetaSat,
  thetaFc,
  pondAtDrainageMm,
  kPanMmDay,
  className,
}: MoistureClockProps) {
  const result: SeedbedWindowResult = useMemo(() => {
    return seedbedMoistureWindow({
      hasConfirmedSoil,
      hasConfirmedDrainageDate,
      awcMmPerM,
      thetaSat,
      thetaFc,
      pondAtDrainageMm,
      kPanMmDay,
    });
  }, [hasConfirmedSoil, hasConfirmedDrainageDate, awcMmPerM, thetaSat, thetaFc, pondAtDrainageMm, kPanMmDay]);

  if (result.status === "field-check-needed") {
    return (
      <div
        role="region"
        aria-label="Post-harvest seedbed moisture check"
        className={cn(
          "flex flex-col gap-2 rounded-lg border border-line bg-surface p-4 text-ink shadow-xs",
          className,
        )}
      >
        <div className="flex items-center gap-2 text-label font-semibold text-ink">
          <Icon name="conditions" size={18} className="text-drought" />
          <span>Moisture Clock (မြေဆီလွှာအစိုဓာတ် ပြက္ခဒိန်)</span>
        </div>
        <div className="rounded-md border border-drought/30 bg-drought-soft p-3 text-body-sm text-ink">
          <p className="m-0 font-medium text-ink">
            Check topsoil moisture and drainage before sowing
          </p>
          <p className="m-0 mt-1 text-source text-ink-muted">
            စိုက်ပျိုးခြင်းမပြုမီ မြေပြင်အစိုဓာတ်နှင့် ရေနုတ်မြောင်းများကို လက်တွေ့စစ်ဆေးပါ။
          </p>
          <p className="m-0 mt-2 text-source text-ink-muted">
            {result.advisory}
          </p>
        </div>
        <p className="m-0 text-source text-ink-muted">
          ℹ️ Initial soil texture or harvest drainage date is not confirmed for this parcel. A calendar countdown is not shown without ground verification.
        </p>
      </div>
    );
  }

  // Confirmed physical drydown estimate
  const { readyDayAfterDrainage, windowEndDayAfterDrainage, optimalDaysDuration, timeline, advisory, caveat } = result;

  return (
    <div
      role="region"
      aria-label="Modeled post-harvest seedbed moisture window"
      className={cn(
        "flex flex-col gap-3 rounded-lg border border-line bg-surface p-4 text-ink shadow-xs",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2.5">
        <div className="flex items-center gap-2">
          <Icon name="conditions" size={18} className="text-field" />
          <span className="text-label font-semibold text-ink">
            Post-Rice Sowing Window Estimate (ခန့်မှန်းစိုက်ပျိုးချိန်)
          </span>
        </div>
        <span className="rounded-pill bg-field-soft px-2.5 py-0.5 text-source font-medium text-field">
          ~Day {readyDayAfterDrainage} to Day {windowEndDayAfterDrainage} ({optimalDaysDuration} days)
        </span>
      </div>

      <p className="m-0 text-body-sm text-ink font-medium">
        {advisory}
      </p>

      {/* 3-Zone Visual Ribbon */}
      <div className="flex flex-col gap-1.5 pt-1">
        <div className="flex items-center justify-between text-source text-ink-muted font-mono">
          <span>Field drained (Day 0)</span>
          <span>Optimal Window</span>
          <span>Desiccating (Day 28)</span>
        </div>

        <div className="flex h-7 w-full overflow-hidden rounded-md border border-line bg-surface-sunken">
          {timeline.slice(0, 28).map((t) => {
            let bgClass = "bg-water/40"; // too_wet
            let title = `Day ${t.day}: Saturated / perched water draining (${t.perchedExcessMm} mm perched)`;
            if (t.phase === "optimal") {
              bgClass = "bg-healthy text-on-field";
              title = `Day ${t.day}: Ready for sowing (Moisture: ${t.seedbedMoistureMm} mm, ${(t.seedbedRelativeSaturation * 100).toFixed(0)}% sat)`;
            } else if (t.phase === "too_dry") {
              bgClass = "bg-heat/30";
              title = `Day ${t.day}: Topsoil drying (${t.seedbedMoistureMm} mm left)`;
            }

            return (
              <div
                key={t.day}
                title={title}
                className={cn(
                  "flex-1 border-r border-surface/30 transition-colors",
                  bgClass,
                )}
              />
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-source text-ink-muted">
          <span className="flex items-center gap-1.5">
            <span className="inline-block size-3 rounded-xs bg-water/40 border border-line" />
            May still be too wet (ရေဝပ်ဆဲ)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block size-3 rounded-xs bg-healthy" />
            Field may be ready (စိုက်ပျိုးရန်သင့်တော်)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block size-3 rounded-xs bg-heat/30 border border-line" />
            May be drying (မြေခြောက်သွေ့ဆဲ)
          </span>
        </div>
      </div>

      <div className="rounded-md bg-surface-sunken p-2.5 text-source text-ink-muted">
        <p className="m-0">
          ⚠️ <strong>Field verification notice:</strong> {caveat}
        </p>
      </div>
    </div>
  );
}
