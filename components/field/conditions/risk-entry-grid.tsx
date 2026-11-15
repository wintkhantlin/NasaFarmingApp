"use client";

import Image from "next/image";
import { useMemo } from "react";
import { MAPBOX_TOKEN } from "@/components/map/mapbox-config";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";
import { staticMapUrl } from "@/lib/geo/static-map";
import type { FieldGeometry } from "@/lib/types";
import type { RiskKind, RiskEvidenceMap } from "@/lib/conditions/condition-evidence";
import { AVAILABILITY, RISK_META, RISK_ORDER } from "@/lib/conditions/explorer-model";

export interface RiskEntryGridProps {
  evidenceMap: RiskEvidenceMap;
  onSelectRisk: (risk: RiskKind) => void;
  /** Shown as the map preview when a map key is configured. */
  geometry?: FieldGeometry;
  className?: string;
}

/**
 * The one way into the map workspace from the overview: a picture of the field, a clear title, and the four
 * analyses as direct entries. It is one object, not a grid of cards.
 */
export function RiskEntryGrid({ evidenceMap, onSelectRisk, geometry, className = "" }: RiskEntryGridProps) {
  const preview = useMemo(() => (MAPBOX_TOKEN && geometry ? staticMapUrl(geometry, MAPBOX_TOKEN, 640, 260) : null), [geometry]);

  return (
    <section aria-labelledby="explore-risks-heading" className={cn("overflow-hidden rounded-lg border border-line bg-surface", className)}>
      <button
        type="button"
        id="explore-entry"
        onClick={() => onSelectRisk("water_stress")}
        aria-label="Open map: field vulnerabilities"
        className="group relative block h-36 w-full overflow-hidden bg-surface-sunken text-left sm:h-44"
      >
        {preview ? (
          <Image src={preview} alt="" fill unoptimized sizes="(min-width: 1024px) 1024px, 100vw" className="object-cover transition-transform duration-300 group-hover:scale-[1.02] motion-reduce:transition-none" />
        ) : (
          <span aria-hidden className="absolute inset-0 flex items-center justify-center text-ink-muted">
            <Icon name="location" size={36} />
          </span>
        )}
        <span className="absolute bottom-3 left-3 inline-flex min-h-9 items-center gap-1.5 rounded-pill border border-line bg-surface px-3.5 text-label text-ink shadow-float">
          <Icon name="location" size={16} className="text-field" />
          Open map
        </span>
      </button>

      <div className="flex flex-col gap-1 px-4 pb-3 pt-4">
        <h3 id="explore-risks-heading" className="m-0 text-headline text-ink">
          Explore field vulnerabilities
        </h3>
        <p className="m-0 max-w-measure text-body-sm text-ink-muted">Past evidence for water stress, flood, erosion, heat and cold, drawn on your field. Not a forecast.</p>
      </div>

      <ul className="m-0 grid list-none grid-cols-2 border-t border-line p-0 sm:grid-cols-4">
        {RISK_ORDER.map((id, i) => {
          const meta = RISK_META[id];
          const a = AVAILABILITY[evidenceMap[id].status];
          return (
            <li key={id} className={cn("border-line", i % 2 === 1 && "border-l", i >= 2 && "border-t sm:border-t-0", i >= 1 && "sm:border-l")}>
              <button
                type="button"
                id={`explore-risk-${id}`}
                onClick={() => onSelectRisk(id)}
                className="flex min-h-16 w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-surface-sunken focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-field"
              >
                <Icon name={meta.icon} size={20} className="shrink-0 text-field" />
                <span className="min-w-0">
                  <span className="block text-label text-ink">{meta.label}</span>
                  <span className={cn("block text-source", a.tone === "missing" ? "text-unknown-text" : "text-ink-muted")}>{a.label}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
