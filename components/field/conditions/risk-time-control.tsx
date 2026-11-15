"use client";

import { useId, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";
import type { TimelineModel } from "@/lib/conditions/explorer-model";

export interface RiskTimelineProps {
  models: TimelineModel[];
  onSelect: (model: TimelineModel, key: string) => void;
  className?: string;
}

const H = 56;
const GAP = 2;

/**
 * Historical strip tied to the map and the findings: the highlighted bar is the period the map
 * label, the numbers and the explanation all describe. The range input underneath is what makes
 * it usable by touch, mouse and keyboard; the bars are only the picture.
 */
export function RiskTimeline({ models, onSelect, className }: RiskTimelineProps) {
  const [active, setActive] = useState(0);
  const model = models[Math.min(active, models.length - 1)];
  const sliderId = useId();
  if (!model) return null;

  const { points, selectedKey, baseline } = model;
  const known = points.filter((p) => p.value !== null) as Array<{ key: string; label: string; value: number }>;
  const max = Math.max(1, ...known.map((p) => p.value), baseline?.value ?? 0);
  const selectedIndex = Math.max(
    0,
    points.findIndex((p) => p.key === selectedKey),
  );
  const selected = points[selectedIndex];
  const n = points.length;
  const W = Math.max(240, n * 6);
  const bar = (W - GAP * (n - 1)) / n;

  const step = (dir: -1 | 1) => {
    // Jump to the next period that actually has a reading.
    let i = selectedIndex + dir;
    while (i >= 0 && i < n && points[i].value === null) i += dir;
    if (i >= 0 && i < n) onSelect(model, points[i].key);
  };
  const canPrev = points.slice(0, selectedIndex).some((p) => p.value !== null);
  const canNext = points.slice(selectedIndex + 1).some((p) => p.value !== null);
  const valueText = (p?: { label: string; value: number | null }) =>
    !p ? "" : p.value === null ? `${p.label}: no valid reading` : `${p.label}: ${p.value} ${model.unit}`;

  return (
    <section aria-label="Historical period" className={cn("flex flex-col gap-2", className)}>
      {models.length > 1 ? (
        <div role="group" aria-label="Measure" className="inline-flex self-start rounded-md bg-surface-sunken p-0.5">
          {models.map((m, i) => (
            <button
              key={m.id}
              type="button"
              aria-pressed={i === active}
              onClick={() => setActive(i)}
              className={cn(
                "min-h-tap rounded px-3 text-label transition-colors sm:min-h-10",
                i === active ? "bg-surface text-ink shadow-xs" : "text-ink-muted hover:text-ink",
              )}
            >
              {m.id === "hot-days" ? "Hot days" : "Cool nights"}
            </button>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          <p className="m-0 text-source text-ink-muted">{model.title}</p>
          <p className="m-0 text-headline text-ink" aria-live="polite">
            {selected && selected.value !== null ? (
              <>
                <span className="font-semibold">{selected.label}</span>
                <span className="text-ink-muted"> · </span>
                <span>
                  {selected.value} {model.unit}
                </span>
              </>
            ) : selected ? (
              <span className="text-ink-muted">{selected.label}: no valid reading</span>
            ) : null}
          </p>
        </div>
        {baseline ? (
          <p className="m-0 text-source text-ink-muted">
            {baseline.label} {baseline.years}: <span className="font-medium text-ink">{baseline.value} {model.unit}</span>
          </p>
        ) : null}
      </div>

      {known.length === 0 ? (
        <p className="m-0 flex items-start gap-2 rounded-md bg-unknown-bg px-3 py-2 text-body-sm text-unknown-text">
          <Icon name="info" size={16} className="mt-0.5 shrink-0" />
          {model.emptyText}
        </p>
      ) : (
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label={model.axis === "year" ? "Previous year with data" : "Previous clear-sky scene"}
            disabled={!canPrev}
            onClick={() => step(-1)}
            className="flex size-tap shrink-0 items-center justify-center rounded-md text-ink transition-colors hover:bg-surface-sunken disabled:opacity-35"
          >
            <Icon name="back" size={20} />
          </button>
          <div className="relative min-w-0 flex-1 rounded-md has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-field" style={{ height: H + 16 }}>
            <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden className="absolute inset-x-0 top-2 w-full" style={{ height: H }}>
              {points.map((p, i) => {
                const x = i * (bar + GAP);
                if (p.value === null) {
                  // Coverage gap: a hairline, never a zero-height "zero" bar.
                  return <rect key={p.key} x={x} y={H - 3} width={bar} height={3} className="fill-line-strong" />;
                }
                const h = Math.max(3, (p.value / max) * (H - 4));
                return (
                  <rect
                    key={p.key}
                    x={x}
                    y={H - h}
                    width={bar}
                    height={h}
                    rx={Math.min(1.5, bar / 2)}
                    className={i === selectedIndex ? "fill-field" : "fill-line-strong/80"}
                  />
                );
              })}
              {baseline ? (
                <line x1={0} x2={W} y1={H - (baseline.value / max) * (H - 4)} y2={H - (baseline.value / max) * (H - 4)} strokeDasharray="4 3" strokeWidth={1.25} vectorEffect="non-scaling-stroke" className="stroke-ink-muted" />
              ) : null}
            </svg>
            <label htmlFor={sliderId} className="sr-only">
              {model.axis === "year" ? "Choose a year" : "Choose a satellite scene date"}
            </label>
            <input
              id={sliderId}
              type="range"
              min={0}
              max={n - 1}
              step={1}
              value={selectedIndex}
              aria-valuetext={valueText(selected)}
              onChange={(e) => {
                const p = points[Number(e.target.value)];
                if (p) onSelect(model, p.key);
              }}
              className="risk-range absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
          </div>
          <button
            type="button"
            aria-label={model.axis === "year" ? "Next year with data" : "Next clear-sky scene"}
            disabled={!canNext}
            onClick={() => step(1)}
            className="flex size-tap shrink-0 items-center justify-center rounded-md text-ink transition-colors hover:bg-surface-sunken disabled:opacity-35"
          >
            <Icon name="next" size={20} />
          </button>
        </div>
      )}

      <div className="flex justify-between px-[calc(2.75rem+0.25rem)] text-source text-ink-muted" aria-hidden>
        <span>{points[0]?.label}</span>
        <span>{points[n - 1]?.label}</span>
      </div>
      {model.axis === "date" ? (
        <p className="m-0 text-source text-ink-muted">Only clear-sky scenes are shown, spaced evenly rather than by date. Cloudy dates have no reading.</p>
      ) : known.length < n ? (
        <p className="m-0 text-source text-ink-muted">Thin marks are years with too few valid days to count. They are not zero.</p>
      ) : null}
    </section>
  );
}

export function RiskTimeControl({
  time,
  timeMode,
  onTimeModeChange,
  selectedYear,
  onYearChange,
  selectedDate,
  onDateChange,
  className,
}: {
  time: {
    start: string;
    end: string;
    selectedYear?: number;
    selectedDate?: string;
    availableYears?: number[];
  };
  timeMode: "usual" | "specific";
  onTimeModeChange: (mode: "usual" | "specific") => void;
  selectedYear?: number;
  onYearChange: (year: number) => void;
  selectedDate?: string;
  onDateChange: (date: string) => void;
  className?: string;
}) {
  const years = time.availableYears ?? [];
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-2 rounded-md border border-line bg-surface-sunken p-2.5", className)}>
      <div className="flex items-center gap-2">
        <span className="text-source font-medium text-ink">Observation Period:</span>
        {years.length > 0 ? (
          <select
            value={selectedYear ?? years[years.length - 1]}
            onChange={(e) => onYearChange(Number(e.target.value))}
            className="rounded border border-line bg-surface px-2 py-1 text-source font-medium text-ink"
            aria-label="Select observation year"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-source text-ink-muted">{time.start}–{time.end}</span>
        )}
      </div>
      {selectedDate && (
        <div className="text-source text-ink-muted">
          Pass date: <span className="font-medium text-ink">{selectedDate}</span>
        </div>
      )}
    </div>
  );
}
