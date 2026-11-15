"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type KeyboardEvent, type ReactNode } from "react";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";
import type { Field } from "@/lib/types";
import type { RemoteData } from "@/lib/store/data-cache";
import type { TrendSeries } from "@/lib/server/trends";
import type { RiskKind, RiskEvidence, RiskEvidenceMap } from "@/lib/conditions/condition-evidence";
import { buildMapViz, buildTimelines, fieldIdentity, type TimelineModel } from "@/lib/conditions/explorer-model";
import { RiskSelector, type BasemapStyle } from "./risk-layer-selector";
import { RiskMap } from "./risk-map";
import { RiskMapControls, RiskMapReadout } from "./risk-map-controls";
import { RiskFindingsSheet, type SheetHeights, type SheetState } from "./risk-findings-sheet";

export interface RiskExplorerProps {
  field: Field;
  evidenceMap: RiskEvidenceMap;
  initialRisk?: RiskKind;
  selectedYear?: number;
  onYearChange?: (year: number) => void;
  selectedDate?: string;
  onDateChange?: (date: string) => void;
  /** Used only to draw the historical strip; the evidence itself is already built. */
  trends?: { trends: TrendSeries[]; through: number } | null;
  remote?: RemoteData | null;
  onBack: () => void;
  renderRiskPanel?: (risk: RiskKind, evidence: RiskEvidence) => ReactNode;
  className?: string;
}

const MIN_HEADER_PX = 56;
const MIN_SELECTOR_PX = 52;
const MIN_PEEK_PX = 148;
const DESKTOP_QUERY = "(min-width: 1024px)";

function useDesktop(): boolean {
  return useSyncExternalStore(
    (cb) => {
      if (typeof window === "undefined" || !window.matchMedia) return () => {};
      const mq = window.matchMedia(DESKTOP_QUERY);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia(DESKTOP_QUERY).matches : false),
    () => false,
  );
}

function useBoxHeight(ref: React.RefObject<HTMLElement | null>, fallback?: number): number {
  const [h, setH] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => setH(el.clientHeight || fallback || window.innerHeight);
    read();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, fallback]);
  return h;
}

/**
 * Map-first workspace for the four field risks. It fills the screen, so the app's own header and tab bars are
 * out of the way and there is exactly one navigation: the back button. Mobile: map, floating risk tabs and
 * a bottom sheet with three heights. Desktop: map on the right, findings in a fixed left panel.
 */
export function RiskExplorer({
  field,
  evidenceMap,
  initialRisk = "water_stress",
  onYearChange,
  onDateChange,
  trends,
  remote,
  onBack,
  renderRiskPanel,
  className = "",
}: RiskExplorerProps) {
  const [activeRisk, setActiveRisk] = useState<RiskKind>(initialRisk);
  const [basemap, setBasemap] = useState<BasemapStyle>("satellite");
  const [view, setView] = useState<"field" | "grid">("field");
  const [viewNonce, setViewNonce] = useState(0);
  const [sheetState, setSheetState] = useState<SheetState>("half");

  const root = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);
  const desktop = useDesktop();
  const headerRef = useRef<HTMLElement>(null);
  const selectorRef = useRef<HTMLDivElement>(null);
  const headerPx = Math.max(MIN_HEADER_PX, useBoxHeight(headerRef, MIN_HEADER_PX));
  const selectorPx = Math.max(MIN_SELECTOR_PX, useBoxHeight(selectorRef, MIN_SELECTOR_PX) + 8);
  const [headFit, setHeadFit] = useState(0);
  // Sheet header + grabber + a little air, so large text never pushes the summary off screen.
  const PEEK_PX = Math.max(MIN_PEEK_PX, headFit + 12);
  const H = useBoxHeight(root) || 800;

  const heights: SheetHeights = useMemo(() => {
    const full = Math.max(PEEK_PX + 80, H - headerPx - selectorPx - 12);
    return { peek: PEEK_PX, half: Math.max(PEEK_PX + 120, Math.round(H * 0.4)), full };
  }, [H, headerPx, selectorPx, PEEK_PX]);

  const evidence = evidenceMap[activeRisk];
  const identity = fieldIdentity(field);

  const timelines = useMemo(() => buildTimelines(activeRisk, { evidence, trends, remote }), [activeRisk, evidence, trends, remote]);

  const viz = useMemo(() => buildMapViz(evidence, timelines), [evidence, timelines]);

  const onTimelineSelect = useCallback(
    (model: TimelineModel, key: string) => {
      if (model.axis === "year") onYearChange?.(Number(key));
      else onDateChange?.(key);
    },
    [onYearChange, onDateChange],
  );

  const changeRisk = (risk: RiskKind) => {
    setActiveRisk(risk);
    setView("field");
    setViewNonce((n) => n + 1);
  };

  // Lock page scroll underneath and start with focus on the way out.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    backRef.current?.focus();
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") onBack();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onBack]);

  // Keep Tab inside the explorer while it covers the page.
  const trapTab = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Tab" || !root.current) return;
    const items = Array.from(
      root.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), summary, [tabindex="0"]'),
    ).filter((el) => el.offsetParent !== null && el.getAttribute("tabindex") !== "-1");
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const settled = desktop ? 0 : heights[sheetState === "full" ? "half" : sheetState];
  // Keep the outline clear of the legend and map controls that ride above the sheet.
  const mapInset = { top: headerPx + selectorPx, bottom: settled + (desktop ? 0 : 112), left: 0, right: 56 };
  const coverMap = !desktop && sheetState === "full";

  return (
    <div
      ref={root}
      role="dialog"
      aria-modal="true"
      aria-label="Field Risk Explorer"
      onKeyDown={trapTab}
      className={cn("fixed inset-0 z-[60] overflow-hidden bg-surface-sunken", className)}
    >
      {/* Map: full bleed on phones, right of the findings panel on desktop */}
      <div className="absolute inset-0 lg:left-[26rem]">
        <RiskMap geometry={field.geometry} centroid={field.centroid} evidence={evidence} basemap={basemap} view={view} viewNonce={viewNonce} inset={mapInset} viz={viz} />
      </div>

      {/* The single navigation: back, and which field this is */}
      <header ref={headerRef} className="absolute inset-x-0 top-0 z-30 flex items-center gap-1 border-b border-line bg-surface pl-1 pr-4 pt-[env(safe-area-inset-top)] shadow-xs" style={{ minHeight: MIN_HEADER_PX }}>
        <button
          ref={backRef}
          type="button"
          onClick={onBack}
          aria-label="Back to Conditions"
          className="flex min-h-tap min-w-tap items-center justify-center gap-1 rounded-md px-2 text-label text-ink transition-colors hover:bg-surface-sunken"
        >
          <Icon name="back" size={22} />
          <span className="hidden sm:inline">Conditions</span>
        </button>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="m-0 truncate text-headline text-ink">{identity.name}</p>
          {identity.context ? <p className="m-0 truncate text-source text-ink-muted">{identity.context}</p> : null}
        </div>
      </header>

      {/* Risk tabs float on the map */}
      <div className="absolute inset-x-0 z-20 lg:left-[26rem]" style={{ top: `calc(${headerPx}px + env(safe-area-inset-top))` }}>
        <div ref={selectorRef} className="pt-2">
          <RiskSelector active={activeRisk} evidenceMap={evidenceMap} onChange={changeRisk} />
        </div>
      </div>

      {/* Legend and map controls ride above the sheet, and step aside when the sheet covers the map */}
      <div
        className={cn(
          "pointer-events-none absolute inset-x-3 z-20 flex items-end justify-between gap-3 transition-[bottom,opacity] duration-250 motion-reduce:transition-none lg:left-[calc(26rem+0.75rem)] lg:!bottom-12",
          coverMap && "opacity-0",
        )}
        style={{ bottom: settled + 12 }}
        aria-hidden={coverMap}
        inert={coverMap}
      >
        <RiskMapReadout viz={viz} className="pointer-events-auto" />
        <RiskMapControls
          evidence={evidence}
          basemap={basemap}
          onBasemapChange={setBasemap}
          view={view}
          onViewChange={(v) => {
            setView(v);
            setViewNonce((n) => n + 1);
          }}
          className="pointer-events-auto"
        />
      </div>

      {/* Findings: bottom sheet on phones, fixed panel on desktop */}
      <div className={cn("absolute z-20 inset-x-0 bottom-0 lg:inset-x-auto lg:left-0 lg:top-0 lg:w-[26rem]")} style={desktop ? { top: headerPx } : undefined}
        role="tabpanel"
        id="risk-panel"
        aria-labelledby={`tab-${activeRisk}`}>
        <RiskFindingsSheet
          evidence={evidence}
          fieldId={field.id}
          timelines={timelines}
          onTimelineSelect={onTimelineSelect}
          sheetState={sheetState}
          onSheetStateChange={setSheetState}
          heights={heights}
          onHeaderHeight={setHeadFit}
          desktop={desktop}
        >
          {renderRiskPanel ? renderRiskPanel(activeRisk, evidence) : null}
        </RiskFindingsSheet>
      </div>
    </div>
  );
}
