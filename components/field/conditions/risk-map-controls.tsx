"use client";

import { useEffect, useRef, useState } from "react";
import { Icon, type IconName } from "@/components/ui/icon";
import { cn } from "@/lib/cn";
import type { RiskEvidence } from "@/lib/conditions/condition-evidence";
import type { MapViz } from "@/lib/conditions/explorer-model";
import type { BasemapStyle } from "./risk-layer-selector";

const CONTROL =
  "flex size-11 items-center justify-center rounded-md border border-line bg-surface text-ink shadow-float transition-colors hover:bg-surface-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-field aria-pressed:border-field aria-pressed:text-field";

const BASEMAPS: Array<{ id: BasemapStyle; label: string; icon: IconName }> = [
  { id: "satellite", label: "Satellite", icon: "satellite" },
  { id: "streets", label: "Streets", icon: "location" },
  { id: "terrain", label: "Terrain", icon: "clay" },
];

export interface RiskMapControlsProps {
  evidence: RiskEvidence;
  basemap: BasemapStyle;
  onBasemapChange: (b: BasemapStyle) => void;
  view: "field" | "grid";
  onViewChange: (v: "field" | "grid") => void;
  className?: string;
}

/** Right-hand stack of three 44 px controls: your field, the data cell, and the basemap picker. */
export function RiskMapControls({ evidence, basemap, onBasemapChange, view, onViewChange, className }: RiskMapControlsProps) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const hasGrid = Boolean(evidence.footprint.box);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  return (
    <div ref={wrap} className={cn("flex flex-col items-end gap-2", className)}>
      {hasGrid ? (
        <button
          type="button"
          aria-label="Show the whole data cell"
          title="Show the whole data cell"
          aria-pressed={view === "grid"}
          onClick={() => onViewChange(view === "grid" ? "field" : "grid")}
          className={CONTROL}
        >
          <Icon name="box" size={20} />
        </button>
      ) : null}
      <div className="relative">
        <button
          ref={trigger}
          type="button"
          aria-label="Map style"
          title="Map style"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className={CONTROL}
        >
          <Icon name="stack" size={20} />
        </button>
        {open ? (
          <div role="group" aria-label="Map style" className="absolute right-12 top-0 z-10 w-40 rounded-md border border-line bg-surface p-1 shadow-float">
            {BASEMAPS.map((b) => (
              <button
                key={b.id}
                type="button"
                aria-pressed={basemap === b.id}
                onClick={() => {
                  onBasemapChange(b.id);
                  setOpen(false);
                  trigger.current?.focus();
                }}
                className={cn(
                  "flex min-h-11 w-full items-center gap-2 rounded px-2.5 text-label",
                  basemap === b.id ? "bg-field-soft text-accent-text" : "text-ink hover:bg-surface-sunken",
                )}
              >
                <Icon name={b.icon} size={18} />
                <span className="flex-1 text-left">{b.label}</span>
                {basemap === b.id ? <Icon name="check" size={16} /> : null}
              </button>
            ))}
            <p className="m-0 px-2.5 pb-1.5 pt-1 text-source text-ink-muted">Changes the picture only, not the evidence.</p>
          </div>
        ) : null}
      </div>

      <button type="button" aria-label="Zoom to your field" title="Zoom to your field" onClick={() => onViewChange("field")} className={CONTROL}>
        <Icon name="locate" size={20} />
      </button>
    </div>
  );
}

/**
 * The single readout on the map: the number the tint stands for, in words, and how wide an area it covers.
 * It replaces a legend: the colour is explained by the sentence, never by a key to decode.
 */
export function RiskMapReadout({ viz, className }: { viz: MapViz; className?: string }) {
  const r = viz.readout;
  return (
    <div role="status" aria-live="polite" className={cn("flex max-w-[min(20rem,calc(100vw-72px))] items-stretch gap-3 rounded-md border border-line bg-surface px-3 py-2 shadow-float", className)}>
      <span aria-hidden className={cn("w-1 shrink-0 rounded-full", r.missing && "border border-dashed border-unknown-border bg-transparent")} style={r.missing ? undefined : { backgroundColor: r.color }} />
      <div className="min-w-0">
        <p className="m-0 text-headline text-ink">
          <span className="font-semibold tabular-nums">{r.value}</span>
        </p>
        <p className="m-0 text-source text-ink">{r.note}</p>
        <p className="m-0 text-source text-ink-muted">{r.scope}</p>
      </div>
    </div>
  );
}
