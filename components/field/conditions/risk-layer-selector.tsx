"use client";

import { useRef, type KeyboardEvent } from "react";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";
import type { RiskEvidenceMap, RiskKind } from "@/lib/conditions/condition-evidence";
import { RISK_META, RISK_ORDER } from "@/lib/conditions/explorer-model";

export type BasemapStyle = "satellite" | "terrain" | "streets";

export interface RiskSelectorProps {
  active: RiskKind;
  evidenceMap: RiskEvidenceMap;
  onChange: (risk: RiskKind) => void;
  className?: string;
}

/**
 * The four scientific analyses as one compact, horizontally scrollable tab strip floating on the map.
 * Basemap choice is a separate control (see RiskMapControls): changing the picture never changes the evidence.
 */
export function RiskSelector({ active, evidenceMap, onChange, className }: RiskSelectorProps) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const onKey = (e: KeyboardEvent, index: number) => {
    const last = RISK_ORDER.length - 1;
    const target = e.key === "Home" ? 0 : e.key === "End" ? last : e.key === "ArrowRight" ? (index + 1) % (last + 1) : e.key === "ArrowLeft" ? (index + last) % (last + 1) : -1;
    if (target < 0) return;
    e.preventDefault();
    const next = target;
    refs.current[next]?.focus();
    onChange(RISK_ORDER[next]);
  };

  return (
    <div
      role="tablist"
      aria-label="Field risk domains"
      className={cn("flex snap-x gap-1.5 overflow-x-auto px-3 py-1 [scrollbar-width:none] sm:gap-2 sm:px-4", className)}
    >
      {RISK_ORDER.map((id, i) => {
        const meta = RISK_META[id];
        const selected = id === active;
        const missing = evidenceMap[id].status === "unavailable" || evidenceMap[id].status === "unsupported";
        return (
          <button
            key={id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`tab-${id}`}
            aria-selected={selected}
            aria-label={meta.label}
            aria-controls="risk-panel"
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(id)}
            onKeyDown={(e) => onKey(e, i)}
            className={cn(
              "inline-flex min-h-11 min-w-fit flex-1 shrink-0 items-center justify-center gap-1.5 rounded-pill border px-2.5 text-label shadow-float transition-colors duration-150 sm:flex-none sm:px-3.5",
              selected
                ? "border-field bg-field text-on-field"
                : "border-line bg-surface text-ink hover:bg-surface-sunken",
            )}
          >
            <Icon name={meta.icon} size={18} className="max-[419px]:hidden" />
            <span className="whitespace-nowrap max-sm:hidden">{meta.label}</span>
            <span aria-hidden className="whitespace-nowrap sm:hidden">{meta.short}</span>
            {missing ? (
              <>
                <span aria-hidden className={cn("size-2 rounded-full border border-dashed", selected ? "border-on-field" : "border-unknown-border")} />
                <span className="sr-only">(no data for this field)</span>
              </>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function RiskLayerSelector({
  risk,
  evidence,
  basemap,
  onBasemapChange,
  className,
}: {
  risk: RiskKind;
  evidence: { label: string; sourceLabel: string };
  basemap: BasemapStyle;
  onBasemapChange: (style: BasemapStyle) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-2", className)}>
      <div className="flex items-center gap-1.5 text-source text-ink-muted">
        <span className="font-medium text-ink">{evidence.label} layer</span>
        <span>·</span>
        <span>{evidence.sourceLabel}</span>
      </div>
      <div className="inline-flex rounded-md bg-surface-sunken p-0.5">
        {(["satellite", "terrain", "streets"] as const).map((style) => (
          <button
            key={style}
            type="button"
            aria-pressed={basemap === style}
            onClick={() => onBasemapChange(style)}
            className={cn(
              "rounded px-2.5 py-1 text-source font-medium capitalize transition-colors",
              basemap === style ? "bg-surface text-ink shadow-xs" : "text-ink-muted hover:text-ink"
            )}
          >
            {style}
          </button>
        ))}
      </div>
    </div>
  );
}
