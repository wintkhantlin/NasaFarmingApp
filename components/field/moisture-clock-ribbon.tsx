"use client";

import { useMemo } from "react";
import { Icon } from "@/components/ui/icon";
import { Message } from "@/components/ui/message";
import { cn } from "@/lib/cn";
import { seedbedMoistureWindow, type SeedbedWindowResult } from "@/lib/engine/water";
import { useLocaleStore } from "@/lib/store/locale-store";

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

  const locale = useLocaleStore((s) => s.locale);
  const isMy = locale === "my";

  if (result.status === "field-check-needed") {
    return (
      <div
        role="region"
        aria-label={isMy ? "စိုက်ပျိုးမီ မြေပြင်အစိုဓာတ် စစ်ဆေးမှု" : "Post-harvest seedbed moisture check"}
        className={cn(
          "flex flex-col gap-2 rounded-lg border border-line bg-surface p-4 text-ink",
          className,
        )}
      >
        <div className="flex items-center gap-2 text-body-sm font-semibold text-ink">
          <Icon name="warning" size={18} className="text-drought" />
          <span className="text-balance">{isMy ? "မြေဆီလွှာအစိုဓာတ် ပြက္ခဒိန်" : "Moisture Clock"}</span>
        </div>
        <Message
          tone="caution"
          title={isMy ? "စိုက်ပျိုးခြင်းမပြုမီ မြေပြင်အစိုဓာတ်နှင့် ရေနုတ်မြောင်းများကို လက်တွေ့စစ်ဆေးပါ" : "Check topsoil moisture and drainage before sowing"}
        >
          <p className="m-0 mt-1 text-pretty">{result.advisory}</p>
        </Message>
        <Message
          tone="needs"
          compact
          title={isMy ? "မြေသားဖွဲ့စည်းပုံနှင့် ရေထုတ်သည့်ရက် ထည့်သွင်းပါ" : "Add soil texture and drainage date"}
        >
          <span className="text-pretty">
            {isMy
              ? "နှစ်ခုစလုံး သတ်မှတ်ပြီးပါက စိုက်ပျိုးရန် အသင့်ဖြစ်နိုင်သည့်ရက်များကို ဤနေရာတွင် ဖော်ပြပါမည်။"
              : "Once both are set, this shows the days when the field may be ready to sow."}
          </span>
        </Message>
      </div>
    );
  }

  // Confirmed physical drydown estimate
  const { readyDayAfterDrainage, windowEndDayAfterDrainage, optimalDaysDuration, timeline, advisory, caveat } = result;

  const ribbonDays = useMemo(() => {
    return (timeline ?? []).slice(0, 28).map((t) => {
      let bgClass = "bg-water/40"; // too_wet
      let title = `Day ${t.day}: Saturated / perched water draining (${t.perchedExcessMm} mm perched)`;
      if (t.phase === "optimal") {
        bgClass = "bg-healthy text-on-field";
        title = `Day ${t.day}: Ready for sowing (Moisture: ${t.seedbedMoistureMm} mm, ${(t.seedbedRelativeSaturation * 100).toFixed(0)}% sat)`;
      } else if (t.phase === "too_dry") {
        bgClass = "bg-heat/30";
        title = `Day ${t.day}: Topsoil drying (${t.seedbedMoistureMm} mm left)`;
      }
      return { day: t.day, bgClass, title };
    });
  }, [timeline]);

  return (
    <div
      role="region"
      aria-label={isMy ? "စိုက်ပျိုးနိုင်သည့် အစိုဓာတ်ပြတင်း ကာလ" : "Modeled post-harvest seedbed moisture window"}
      className={cn(
        "flex flex-col gap-3 rounded-lg border border-line bg-surface p-4 text-ink",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2.5">
        <div className="flex items-center gap-2">
          <Icon name="rain" size={18} className="text-field" />
          <span className="text-body-sm font-semibold text-ink text-balance">
            {isMy ? "ခန့်မှန်းစိုက်ပျိုးချိန်" : "Post-Rice Sowing Window Estimate"}
          </span>
        </div>
        <span className="inline-flex min-h-8 items-center gap-1.5 rounded-pill bg-field-soft px-3 py-1 text-body-sm font-semibold text-field tabular-nums">
          <Icon name="time" size={16} />
          ~Day {readyDayAfterDrainage} to Day {windowEndDayAfterDrainage} ({optimalDaysDuration} days)
        </span>
      </div>

      <p className="m-0 text-body font-semibold text-ink text-pretty">
        {isMy
          ? `ရေထုတ်ပြီး ${readyDayAfterDrainage} မှ ${windowEndDayAfterDrainage} ရက်ခန့်အကြာတွင် စိုက်ပျိုးပါ။`
          : `Sow about ${readyDayAfterDrainage} to ${windowEndDayAfterDrainage} days after the water drains.`}
      </p>

      <p className="m-0 text-body-sm text-ink font-medium text-pretty">
        {advisory}
      </p>

      {/* 3-Zone Visual Ribbon */}
      <div className="flex flex-col gap-1.5 pt-1">
        <div className="flex flex-wrap items-center justify-between gap-x-3 text-label text-ink-muted font-mono tabular-nums">
          <span>{isMy ? "ရေထုတ်သည့်နေ့ (ရက် ၀)" : "Field drained (Day 0)"}</span>
          <span>{isMy ? "အသင့်တော်ဆုံးအချိန်" : "Optimal Window"}</span>
          <span>{isMy ? "အစိုဓာတ် လျော့နည်းချိန် (ရက် ၂၈)" : "Desiccating (Day 28)"}</span>
        </div>

        <div className="flex h-7 w-full overflow-hidden rounded-md border border-line bg-surface-sunken">
          {ribbonDays.map((t) => (
            <div
              key={t.day}
              title={t.title}
              className={cn(
                "flex-1 border-r border-surface/30 transition-colors",
                t.bgClass,
              )}
            />
          ))}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-1 text-body-sm text-ink-muted">
          <span className="flex items-center gap-1.5">
            <span className="inline-block size-3 rounded-xs bg-water/40 border border-line" />
            {isMy ? "ရေဝပ်ဆဲ ဖြစ်နိုင်သည်" : "May still be too wet"}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block size-3 rounded-xs bg-healthy" />
            {isMy ? "စိုက်ပျိုးရန် သင့်တော်နိုင်သည်" : "Field may be ready"}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block size-3 rounded-xs bg-heat/30 border border-line" />
            {isMy ? "မြေခြောက်သွေ့နေနိုင်သည်" : "May be drying"}
          </span>
        </div>
      </div>

      <Message tone="caution" compact title={isMy ? "လက်တွေ့စစ်ဆေးရန် သတိပေးချက်" : "Field verification notice"}>
        <span className="text-pretty">{caveat}</span>
      </Message>
    </div>
  );
}
