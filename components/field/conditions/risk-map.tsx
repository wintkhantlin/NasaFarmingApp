"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { MAPBOX_TOKEN } from "@/components/map/mapbox-config";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import type { FieldGeometry, LngLat } from "@/lib/types";
import type { RiskEvidence } from "@/lib/conditions/condition-evidence";
import type { BasemapStyle } from "./risk-layer-selector";
import type { MapInset, RiskMapCanvasProps } from "./risk-map-canvas";

const RiskMapCanvas = dynamic(() => import("./risk-map-canvas"), {
  ssr: false,
  loading: () => <div role="status" aria-label="Loading map" className="size-full animate-pulse bg-surface-sunken" />,
});

export interface RiskMapProps {
  geometry: FieldGeometry;
  centroid: LngLat;
  evidence: RiskEvidence;
  basemap: BasemapStyle;
  view?: "field" | "grid";
  viewNonce?: number;
  inset?: MapInset;
  viz?: RiskMapCanvasProps["viz"];
  className?: string;
}

const NO_INSET: MapInset = { top: 0, bottom: 0, left: 0, right: 0 };

/** Real field outline, fitted to a 0..W x 0..H box. Used only when the live map cannot load. */
function sketch(geometry: FieldGeometry, w: number, h: number): string | null {
  if (geometry.type !== "Polygon") return null;
  const pts = geometry.coordinates[0];
  if (!pts?.length) return null;
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const span = Math.max(maxX - minX, maxY - minY, 1e-9);
  const k = Math.min(w, h) / span;
  const ox = (w - (maxX - minX) * k) / 2;
  const oy = (h - (maxY - minY) * k) / 2;
  return pts.map(([x, y]) => `${(ox + (x - minX) * k).toFixed(1)},${(oy + (maxY - y) * k).toFixed(1)}`).join(" ");
}

function MapFallback({ geometry, evidence, reason, onRetry }: { geometry: FieldGeometry; evidence: RiskEvidence; reason: string; onRetry?: () => void }) {
  const poly = sketch(geometry, 180, 120);
  return (
    <div className="flex size-full flex-col items-center justify-center gap-3 bg-surface-sunken p-6 pb-40 text-center">
      <svg viewBox="0 0 240 160" className="w-full max-w-[260px]" role="img" aria-label="Outline of your field, not to scale">
        <rect x="2" y="2" width="236" height="156" rx="6" fill="none" strokeWidth="2" strokeDasharray="6 5" className="stroke-ink-muted" />
        {poly ? (
          <polygon points={poly} transform="translate(30 20)" strokeWidth="3" strokeLinejoin="round" className="fill-field/25 stroke-field" />
        ) : (
          <circle cx="120" cy="80" r="7" className="fill-field" />
        )}
      </svg>
      <p className="m-0 max-w-xs text-body-sm text-ink-muted">
        {reason} Your field sits inside {evidence.footprint.label.toLowerCase()}. Not to scale.
      </p>
      {onRetry ? (
        <Button variant="secondary" icon="retry" onClick={onRetry}>
          Try the map again
        </Button>
      ) : null}
    </div>
  );
}

/**
 * The full-bleed map: confirmed field outline plus the real footprint of the data source.
 * It never paints a colour surface the data cannot support (see OVERLAY_NOTE in explorer-model).
 */
export function RiskMap({ geometry, centroid, evidence, basemap, view = "field", viewNonce = 0, inset = NO_INSET, viz, className }: RiskMapProps) {
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const useLive = Boolean(MAPBOX_TOKEN) && !failed;

  return (
    <div role="region" aria-label={`${evidence.label} map evidence`} className={cn("relative size-full overflow-hidden bg-surface-sunken", className)}>
      {useLive ? (
        <RiskMapCanvas
          key={attempt}
          token={MAPBOX_TOKEN}
          geometry={geometry}
          centroid={centroid}
          footprint={evidence.footprint.box}
          footprintLabel={evidence.footprint.label}
          basemap={basemap}
          view={view}
          viewNonce={viewNonce}
          inset={inset}
          viz={viz}
          onFailure={() => setFailed(true)}
        />
      ) : (
        <MapFallback
          geometry={geometry}
          evidence={evidence}
          reason={MAPBOX_TOKEN ? "The map pictures could not load." : "The map pictures are not set up on this device."}
          onRetry={
            MAPBOX_TOKEN
              ? () => {
                  setFailed(false);
                  setAttempt((n) => n + 1);
                }
              : undefined
          }
        />
      )}
      {/* Non-visual summary for screen readers: what the map is showing. */}
      <p className="sr-only">
        Map of your confirmed field outline{evidence.footprint.box ? ` inside ${evidence.footprint.label}` : ""}. {evidence.label} analysis. Basemap: {basemap}.
      </p>
    </div>
  );
}
