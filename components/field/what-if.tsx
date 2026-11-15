"use client";

import Slider from "@mui/material/Slider";
import { useId } from "react";
import { Disclosure } from "@/components/ui/disclosure";
import { RiskChip } from "@/components/ui/risk-chip";
import { StatusTag } from "@/components/ui/status";
import { cn } from "@/lib/cn";
import { copy } from "@/lib/copy/en";
import {
  DELAY_RANGE,
  isNeutral,
  matchingPreset,
  NO_SCENARIO,
  PRESETS,
  RAIN_RANGE,
  TEMP_RANGE,
  type Scenario,
} from "@/lib/engine/scenario";
import type { StripYear } from "@/lib/engine/strip";
import type { WhatIfOption, WhatIfResult } from "@/lib/engine/what-if";
import type { Irrigation } from "@/lib/types";

const t = copy.whatIf;
const WEATHER_OFF = { rainPct: 0, tempC: 0, delayDays: 0 } as const;

/** The test in the farmer's words: "20% less rain, rain 10 days later". */
export function describeScenario(s: Scenario, recorded: Irrigation): string {
  const parts: string[] = [];
  if (s.rainPct !== 0) parts.push(t.describe.rain(s.rainPct));
  if (s.delayDays !== 0) parts.push(t.describe.delay(s.delayDays));
  if (s.tempC !== 0) parts.push(t.describe.temp(s.tempC));
  if (s.irrigation !== null && s.irrigation !== recorded) parts.push(t.describe.water(copy.irrigation[s.irrigation]));
  return parts.join(", ");
}

/**
 * Sits above the answer while a test is on. The whole page recalculates under a test, so the label
 * has to be on the result itself, where it cannot be missed, and cannot be dismissed.
 */
export function WhatIfBanner({ scenario, recorded, onReset }: { scenario: Scenario; recorded: Irrigation; onReset: () => void }) {
  if (isNeutral(scenario)) return null;
  return (
    <div role="status" className="flex flex-col gap-2 rounded-md border border-line-strong bg-surface-sunken p-4">
      <StatusTag tag="hypothetical" className="self-start" />
      <p className="m-0 text-headline text-ink">{t.activeTitle}</p>
      <p className="m-0 text-body text-ink">{describeScenario(scenario, recorded) || t.neutral}. {t.intro}</p>
      <div className="flex flex-wrap gap-x-4">
        <a href="#what-if" className="inline-flex min-h-tap items-center text-label text-field underline hover:text-ink">
          {t.activeAdjust}
        </a>
        <button type="button" onClick={onReset} className="min-h-tap cursor-pointer border-0 bg-transparent p-0 text-label text-field underline hover:text-ink">
          {t.reset}
        </button>
      </div>
    </div>
  );
}

const pill = "min-h-tap cursor-pointer rounded-pill px-3 py-1.5 text-label font-medium transition-colors";
const pillOn = "bg-field text-on-field";
const pillOff = "border border-line bg-surface text-ink-muted hover:border-line-strong hover:text-ink";

function TestSlider({
  label,
  value,
  valueText,
  min,
  max,
  step,
  ends,
  onChange,
}: {
  label: string;
  value: number;
  valueText: string;
  min: number;
  max: number;
  step: number;
  ends: readonly [string, string];
  onChange: (v: number) => void;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-0.5">
      <p id={id} className="flex justify-between gap-3 text-label text-ink">
        {label}
        <span className={cn("tabular", value === 0 ? "text-ink-muted" : "font-medium")}>{valueText}</span>
      </p>
      <Slider
        aria-labelledby={id}
        getAriaValueText={() => valueText}
        min={min}
        max={max}
        step={step}
        value={value}
        marks={min < 0 ? [{ value: 0 }] : [{ value: min }]}
        onChange={(_, v) => onChange(v as number)}
      />
      <div className="flex justify-between text-source text-ink-muted" aria-hidden>
        <span>{ends[0]}</span>
        <span>{ends[1]}</span>
      </div>
    </div>
  );
}

function Cells({ strip, label, tone }: { strip: StripYear[]; label: string; tone: "before" | "after" }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-24 shrink-0 text-source text-ink-muted">{label}</span>
      <ol role="img" aria-label={label} className="m-0 flex min-w-0 flex-1 list-none flex-wrap gap-1 p-0">
        {strip.map((y) => (
          <li
            key={y.year}
            title={`${y.year}: ${y.stressed === null ? "not known" : y.stressed ? "at risk" : "no stress found"}`}
            className={cn(
              "grid h-5 min-w-5 flex-1 basis-5 place-items-center rounded-sm text-[10px] leading-none",
              y.stressed === true && (tone === "after" ? "bg-stress text-white" : "bg-stress-bg text-stress"),
              y.stressed === false && "bg-surface-sunken text-ink-muted",
              y.stressed === null && "border border-dashed border-unknown-border bg-unknown-bg text-unknown-text",
            )}
          >
            <span aria-hidden>{y.stressed === true ? "×" : y.stressed === null ? "?" : ""}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Movement({ o }: { o: WhatIfOption }) {
  if (o.before === null) return <RiskChip hazard="neutral">{t.newUnderTest}</RiskChip>;
  if (o.delta === null) return <RiskChip hazard="neutral">{t.notComparable}</RiskChip>;
  if (o.delta > 0) return <RiskChip hazard="drought">{t.more(o.delta)}</RiskChip>;
  if (o.delta < 0) return <RiskChip hazard="healthy">{t.fewer(-o.delta)}</RiskChip>;
  return <RiskChip hazard="neutral">{t.same}</RiskChip>;
}

function OptionRow({ o, best }: { o: WhatIfOption; best: boolean }) {
  const { before, after } = o;
  const placeMoved = before?.place != null && after.place != null && before.place !== after.place;
  return (
    <li className="flex flex-col gap-2 rounded-md border border-line bg-surface p-3">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="min-w-0 flex-1 text-label text-ink">{o.label}</span>
        {o.isYours ? <StatusTag tag="yours" /> : null}
        {best ? <StatusTag tag="best-match" /> : null}
      </div>
      {before ? <Cells strip={before.strip} label={t.asRecorded} tone="before" /> : null}
      <Cells strip={after.strip} label={t.withTest} tone="after" />
      <p className="sr-only">
        {before ? t.stripSr(t.asRecorded, before.stressed, before.known) + ". " : ""}
        {t.stripSr(t.withTest, after.stressed, after.known)}
      </p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <Movement o={o} />
        <span className="tabular text-body-sm text-ink-muted">
          {before ? `${before.stressed} → ` : ""}
          {t.atRisk(after.stressed, after.known)}
        </span>
      </div>
      {o.fitChanged && before ? (
        <p className="m-0 text-body-sm text-ink">{t.fitChange(copy.compare.fitLabel[before.fit], copy.compare.fitLabel[after.fit])}</p>
      ) : null}
      {placeMoved && before?.place != null && after.place != null ? <p className="m-0 text-body-sm text-ink">{t.placeChange(before.place, after.place)}</p> : null}
    </li>
  );
}

function Result({ result, pending }: { result: WhatIfResult; pending: boolean }) {
  const { best } = result;
  const headline = best.lost
    ? t.headlineLost
    : best.changed && best.afterLabel
      ? best.beforeLabel
        ? t.headlineChanged(best.beforeLabel, best.afterLabel)
        : t.bestAppears(best.afterLabel)
      : best.afterLabel
        ? t.headlineStays(best.afterLabel)
        : t.headlineNoRank;

  const lines: string[] = [];
  if (best.lost) lines.push(t.headlineLostBody);
  else if (!best.afterLabel) lines.push(t.headlineNoRankBody);
  if (result.hardestHit?.before) {
    const h = result.hardestHit;
    lines.push(t.hardestHit(h.label, h.before!.stressed, h.after.stressed, h.after.known));
  }
  if (result.holdsUp && result.holdsUp.id !== result.hardestHit?.id) lines.push(t.holdsUp(result.holdsUp.label, result.holdsUp.after.stressed, result.holdsUp.after.known));
  if (result.counts.worse === 0 && result.counts.better === 0 && result.options.every((o) => o.before)) {
    lines.push(t.noChange);
  } else if (result.counts.worse === 0 && result.counts.better > 0) {
    lines.push(t.allBetter);
  }
  if (result.dropped.length > 0) lines.push(t.droppedNote(result.dropped.join(", ")));

  const order = [...result.options].sort((a, b) => (a.after.place ?? Number.MAX_SAFE_INTEGER) - (b.after.place ?? Number.MAX_SAFE_INTEGER));

  return (
    <section aria-label={t.resultTitle} aria-busy={pending} className={cn("flex flex-col gap-3 transition-opacity", pending && "opacity-60")}>
      <div aria-live="polite" className="flex flex-col gap-1">
        <h3 className="m-0 text-headline text-ink">{headline}</h3>
        {lines.map((l) => (
          <p key={l} className="m-0 max-w-measure text-body-sm text-ink-muted">
            {l}
          </p>
        ))}
        {pending ? <p className="m-0 text-source text-ink-muted">{t.updating}</p> : null}
      </div>
      <ol className="m-0 flex list-none flex-col gap-2 p-0">
        {order.map((o) => (
          <OptionRow key={o.id} o={o} best={o.id === best.afterId} />
        ))}
      </ol>
    </section>
  );
}

export interface WhatIfProps {
  scenario: Scenario;
  onChange: (s: Scenario) => void;
  /** null until a test is on. */
  result: WhatIfResult | null;
  /** The sliders have moved on and the options are still catching up. */
  pending: boolean;
  /** The water supply the farmer recorded. */
  recorded: Irrigation;
}

/** "What if the weather were different?" The controls and, under them, what the test does to each option. */
export function WhatIf({ scenario, onChange, result, pending, recorded }: WhatIfProps) {
  const preset = matchingPreset(scenario);
  const active = !isNeutral(scenario);
  const supply = scenario.irrigation ?? recorded;

  return (
    <div id="what-if" className="scroll-mt-20">
      <Disclosure
        title={copy.compare.whatIfTitle}
        hint={active ? <span className="text-ink">· {describeScenario(scenario, recorded) || t.neutral}</span> : null}
      >
        <p className="m-0 max-w-measure text-body-sm text-ink-muted">{t.intro}</p>

        <div className="flex flex-col gap-2">
          <span className="text-label text-ink" id="whatif-quick">
            {t.quick}
          </span>
          <div role="group" aria-labelledby="whatif-quick" className="flex flex-wrap gap-2">
            {PRESETS.map((p) => {
              const on = preset?.id === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={on}
                  title={t.presets[p.id as keyof typeof t.presets].hint}
                  onClick={() => onChange({ ...scenario, ...(on ? WEATHER_OFF : p.change) })}
                  className={cn(pill, on ? pillOn : pillOff)}
                >
                  {t.presets[p.id as keyof typeof t.presets].label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <span className="text-label text-ink-muted">{t.custom}</span>
          <TestSlider
            label={t.rain}
            value={scenario.rainPct}
            valueText={t.rainValue(scenario.rainPct)}
            {...RAIN_RANGE}
            ends={t.rainEnds}
            onChange={(v) => onChange({ ...scenario, rainPct: v })}
          />
          <TestSlider
            label={t.delay}
            value={scenario.delayDays}
            valueText={t.delayValue(scenario.delayDays)}
            {...DELAY_RANGE}
            ends={t.delayEnds}
            onChange={(v) => onChange({ ...scenario, delayDays: v })}
          />
          <TestSlider
            label={t.temp}
            value={scenario.tempC}
            valueText={t.tempValue(scenario.tempC)}
            {...TEMP_RANGE}
            ends={t.tempEnds}
            onChange={(v) => onChange({ ...scenario, tempC: v })}
          />
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-label text-ink" id="whatif-water">
            {t.water}
          </span>
          <div role="group" aria-labelledby="whatif-water" className="flex flex-wrap gap-2">
            {(["none", "supplemental", "full"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                aria-pressed={supply === mode}
                onClick={() => onChange({ ...scenario, irrigation: mode === recorded ? null : mode })}
                className={cn(pill, supply === mode ? pillOn : pillOff)}
              >
                {copy.irrigation[mode]}
              </button>
            ))}
          </div>
          <p className={cn("m-0 text-body-sm", scenario.irrigation !== null ? "font-medium text-ink" : "text-ink-muted")}>
            {scenario.irrigation !== null ? t.waterTest(copy.irrigation[scenario.irrigation]) : t.waterRecorded(copy.irrigation[recorded])}
          </p>
        </div>

        {active ? (
          <button
            type="button"
            onClick={() => onChange(NO_SCENARIO)}
            className="min-h-tap cursor-pointer self-start border-0 bg-transparent p-0 text-label text-field underline hover:text-ink"
          >
            {t.reset}
          </button>
        ) : null}

        {result ? (
          <>
            <StatusTag tag="hypothetical" className="self-start" />
            <Result result={result} pending={pending} />
          </>
        ) : (
          <p className="m-0 text-body-sm text-ink-muted">{t.neutral}</p>
        )}

        <ul className="m-0 flex list-disc flex-col gap-0.5 pl-5 text-source text-ink-muted">
          {t.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </Disclosure>
    </div>
  );
}
