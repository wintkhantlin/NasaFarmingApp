"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { Icon } from "@/components/ui/icon";
import { Disclosure } from "@/components/ui/disclosure";
import { buttonClass, Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import type { RiskEvidence } from "@/lib/conditions/condition-evidence";
import { AVAILABILITY, HALF_CAVEAT, OVERLAY_NOTE, type TimelineModel } from "@/lib/conditions/explorer-model";
import { RiskTimeline } from "./risk-time-control";

export type SheetState = "peek" | "half" | "full";

export interface SheetHeights {
  peek: number;
  half: number;
  full: number;
}

export interface RiskFindingsSheetProps {
  evidence: RiskEvidence;
  fieldId: string;
  timelines?: TimelineModel[];
  onTimelineSelect?: (model: TimelineModel, key: string) => void;
  sheetState: SheetState;
  onSheetStateChange: (state: SheetState) => void;
  heights?: SheetHeights;
  /** Reports how tall the always-visible header is, so the collapsed height always fits it (large text sizes). */
  onHeaderHeight?: (px: number) => void;
  /** At lg and up the sheet becomes a fixed side panel with no detents. */
  desktop?: boolean;
  children?: ReactNode;
  className?: string;
}

const DEFAULT_HEIGHTS: SheetHeights = {
  peek: 160,
  half: 360,
  full: 600,
};

const ORDER: SheetState[] = ["peek", "half", "full"];

function FactRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[6rem_1fr] gap-x-3 py-1.5 text-body-sm sm:grid-cols-[7rem_1fr]">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="m-0 min-w-0 text-ink">{children}</dd>
    </div>
  );
}

export function RiskFindingsSheet({
  evidence,
  fieldId,
  timelines = [],
  onTimelineSelect = () => {},
  sheetState,
  onSheetStateChange,
  heights = DEFAULT_HEIGHTS,
  onHeaderHeight,
  desktop = false,
  children,
  className,
}: RiskFindingsSheetProps) {
  const [dragH, setDragH] = useState<number | null>(null);
  const drag = useRef<{ y: number; h: number; id: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const headRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = headRef.current;
    if (!el || !onHeaderHeight) return;
    const read = () => onHeaderHeight(Math.ceil(el.getBoundingClientRect().height));
    read();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [onHeaderHeight]);

  const missing = evidence.status === "unavailable" || evidence.status === "unsupported";
  const loading = evidence.status === "loading";
  const expanded = desktop || sheetState !== "peek";
  const full = desktop || sheetState === "full";

  const height = desktop ? undefined : (dragH ?? heights[sheetState]);

  const go = (dir: 1 | -1) => {
    const i = ORDER.indexOf(sheetState) + dir;
    if (i >= 0 && i < ORDER.length) onSheetStateChange(ORDER[i]);
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (desktop || (e.pointerType === "mouse" && e.button !== 0)) return;
    drag.current = { y: e.clientY, h: heights[sheetState], id: e.pointerId, moved: false };
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dy = d.y - e.clientY;
    if (!d.moved && Math.abs(dy) < 6) return;
    if (!d.moved) {
      d.moved = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    setDragH(Math.max(heights.peek - 16, Math.min(heights.full, d.h + dy)));
  };
  const finish = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    drag.current = null;
    if (!d || !d.moved) return;
    suppressClick.current = true;
    window.setTimeout(() => {
      suppressClick.current = false;
    }, 0);
    const h = Math.max(heights.peek, Math.min(heights.full, d.h + (d.y - e.clientY)));
    // Snap to the nearest detent; a flick of more than 60 px counts as a step in that direction.
    const flick = d.y - e.clientY;
    const nearest = ORDER.reduce((a, b) => (Math.abs(heights[b] - h) < Math.abs(heights[a] - h) ? b : a));
    let next = nearest;
    if (Math.abs(flick) > 60 && nearest === sheetState) {
      const i = ORDER.indexOf(sheetState) + (flick > 0 ? 1 : -1);
      next = ORDER[Math.max(0, Math.min(ORDER.length - 1, i))];
    }
    setDragH(null);
    onSheetStateChange(next);
  };

  const onHeaderKey = (e: KeyboardEvent) => {
    if (desktop) return;
    if (e.key === "ArrowUp") {
      e.preventDefault();
      go(1);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      go(-1);
    }
  };

  const toggleLabel = sheetState === "peek" ? "Show findings" : sheetState === "full" ? "Back to the map" : "Expand findings";

  const status = AVAILABILITY[evidence.status];
  const note = status.tone !== "ok" ? status.label : null;

  return (
    <section
      aria-label={`${evidence.label} findings and evidence`}
      data-sheet-state={desktop ? "panel" : sheetState}
      style={height !== undefined ? { height } : undefined}
      className={cn(
        "z-20 flex flex-col bg-surface shadow-float",
        dragH === null && "transition-[height] duration-250 ease-out motion-reduce:transition-none",
        desktop ? "h-full border-r border-line" : "rounded-t-lg border-t border-line",
        className,
      )}
    >
      {/* Title and headline: the part you can grab. */}
      <div
        ref={headRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finish}
        onPointerCancel={finish}
        onClickCapture={(e) => {
          if (suppressClick.current) e.stopPropagation();
        }}
        className={cn("shrink-0 px-4", !desktop && "touch-none")}
      >
        {!desktop ? (
          <div aria-hidden className="flex h-5 cursor-grab items-center justify-center active:cursor-grabbing">
            <span className="h-1 w-9 rounded-pill bg-line-strong/60" />
          </div>
        ) : (
          <div className="h-3" />
        )}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h2 className="m-0 text-headline text-ink">{evidence.label}</h2>
            <p className={cn("m-0 mt-0.5 text-body-sm text-ink", !expanded && "line-clamp-2")}>{evidence.summaryTitle}</p>
            {note ? (
              <p className={cn("m-0 mt-1 inline-flex items-center gap-1 text-source", status.tone === "missing" ? "text-unknown-text" : "text-ink-muted")}>
                <Icon name={status.tone === "busy" ? "retry" : "info"} size={13} className={status.tone === "busy" ? "animate-spin motion-reduce:animate-none" : undefined} />
                {note}
              </p>
            ) : null}
          </div>
          {!desktop ? (
            <button
              type="button"
              aria-label={`${evidence.label}: ${toggleLabel}`}
              aria-expanded={sheetState !== "peek"}
              onClick={() => {
                if (sheetState === "half") onSheetStateChange("full");
                else if (sheetState === "full") onSheetStateChange("peek");
                else onSheetStateChange("half");
              }}
              onKeyDown={onHeaderKey}
              className="-mr-2 -mt-0.5 flex size-tap shrink-0 items-center justify-center rounded-md text-ink transition-colors hover:bg-surface-sunken"
            >
              <Icon name={sheetState === "full" ? "down" : "up"} size={22} />
            </button>
          ) : null}
        </div>
      </div>

      <div
        className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6", !expanded && "invisible overflow-hidden")}
        aria-hidden={!expanded}
        tabIndex={expanded ? 0 : -1}
        role="region"
        aria-label="Findings detail"
      >
        <div className="flex flex-col gap-4 pt-2">
          {/* The answer, the history behind it, and one thing to check. */}
          {loading ? (
            <div role="status" className="flex flex-col gap-2" aria-label="Checking data">
              <div className="h-4 w-4/5 animate-pulse motion-reduce:animate-none rounded bg-surface-sunken" />
              <div className="h-4 w-3/5 animate-pulse motion-reduce:animate-none rounded bg-surface-sunken" />
              <p className="m-0 text-body-sm text-ink-muted">Checking satellite data for this field. This can take a minute or more.</p>
            </div>
          ) : missing ? (
            <p className="m-0 flex items-start gap-2 rounded-md bg-unknown-bg px-3 py-2.5 text-body-sm text-unknown-text">
              <Icon name="info" size={18} className="mt-0.5 shrink-0" />
              <span>
                <strong className="font-semibold">No evidence yet.</strong> This is not a sign that the field is safe. {evidence.findingText}
              </span>
            </p>
          ) : (
            <p className="m-0 max-w-measure text-body text-ink">{evidence.findingText}</p>
          )}

          {timelines.length > 0 && !loading ? <RiskTimeline models={timelines} onSelect={onTimelineSelect} /> : null}

          <div className="flex items-start gap-2.5">
            <Icon name="check" size={18} className="mt-0.5 shrink-0 text-field" />
            <p className="m-0 max-w-measure text-body-sm text-ink">
              <span className="font-medium">Check on your field: </span>
              {evidence.localCheckText}
            </p>
          </div>

          {!desktop && sheetState === "half" ? (
            <Button variant="quiet" block iconEnd="up" onClick={() => onSheetStateChange("full")}>
              More detail
            </Button>
          ) : null}

          {/* Detail: where it comes from, what it cannot say, and the way on to Compare */}
          {desktop ? (
            <Disclosure title="More detail" className="border-0 bg-surface-sunken">
            <div className="flex flex-col gap-5">
              {HALF_CAVEAT[evidence.kind] && !missing ? (
                <p className="m-0 flex max-w-measure items-start gap-2 text-body-sm text-ink-muted">
                  <Icon name="info" size={16} className="mt-0.5 shrink-0" />
                  {HALF_CAVEAT[evidence.kind]}
                </p>
              ) : null}

              {children}

              <div className="flex items-start gap-2.5">
                <Icon name="info" size={18} className="mt-0.5 shrink-0 text-ink-muted" />
                <div>
                  <h3 className="m-0 text-label text-ink">What we cannot tell yet</h3>
                  <p className="m-0 mt-0.5 max-w-measure text-body-sm text-ink-muted">{evidence.cannotTellText}</p>
                </div>
              </div>

              <Disclosure title="Source, scale and limits" className="bg-surface">
                <dl className="m-0 divide-y divide-line">
                  <FactRow label="Source">{evidence.sourceLabel}</FactRow>
                  <FactRow label="Dataset">{evidence.sourceId}</FactRow>
                  <FactRow label="Covers">{evidence.footprint.label}</FactRow>
                  <FactRow label="Period">
                    {evidence.time.start} to {evidence.time.end}
                  </FactRow>
                  {evidence.quality && evidence.quality.validCount !== undefined && evidence.quality.totalCount !== undefined ? (
                    <FactRow label={evidence.kind === "flood" ? "Clear-view pixels" : "Valid readings"}>
                      {evidence.quality.validCount} of {evidence.quality.totalCount}
                    </FactRow>
                  ) : null}
                </dl>
                <p className="m-0 text-body-sm text-ink-muted">{OVERLAY_NOTE[evidence.kind]}</p>
                <ul className="m-0 list-disc space-y-1.5 pl-5 text-body-sm text-ink-muted">
                  {evidence.caveats.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </Disclosure>

              <Link href={`/fields/${fieldId}/compare`} className={buttonClass("primary", "w-full", "lg")}>
                Compare crop rotations
                <Icon name="next" />
              </Link>
              <p className="m-0 text-source text-ink-muted">Compare also shows these four field risks next to each option. It does not change any ranking.</p>
            </div>
            </Disclosure>
          ) : full ? (
            <div className="flex flex-col gap-5 border-t border-line pt-4">
              {HALF_CAVEAT[evidence.kind] && !missing ? (
                <p className="m-0 flex max-w-measure items-start gap-2 text-body-sm text-ink-muted">
                  <Icon name="info" size={16} className="mt-0.5 shrink-0" />
                  {HALF_CAVEAT[evidence.kind]}
                </p>
              ) : null}

              {children}

              <div className="flex items-start gap-2.5">
                <Icon name="info" size={18} className="mt-0.5 shrink-0 text-ink-muted" />
                <div>
                  <h3 className="m-0 text-label text-ink">What we cannot tell yet</h3>
                  <p className="m-0 mt-0.5 max-w-measure text-body-sm text-ink-muted">{evidence.cannotTellText}</p>
                </div>
              </div>

              <Disclosure title="Source, scale and limits" className="bg-surface">
                <dl className="m-0 divide-y divide-line">
                  <FactRow label="Source">{evidence.sourceLabel}</FactRow>
                  <FactRow label="Dataset">{evidence.sourceId}</FactRow>
                  <FactRow label="Covers">{evidence.footprint.label}</FactRow>
                  <FactRow label="Period">
                    {evidence.time.start} to {evidence.time.end}
                  </FactRow>
                  {evidence.quality && evidence.quality.validCount !== undefined && evidence.quality.totalCount !== undefined ? (
                    <FactRow label={evidence.kind === "flood" ? "Clear-view pixels" : "Valid readings"}>
                      {evidence.quality.validCount} of {evidence.quality.totalCount}
                    </FactRow>
                  ) : null}
                </dl>
                <p className="m-0 text-body-sm text-ink-muted">{OVERLAY_NOTE[evidence.kind]}</p>
                <ul className="m-0 list-disc space-y-1.5 pl-5 text-body-sm text-ink-muted">
                  {evidence.caveats.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </Disclosure>

              <Link href={`/fields/${fieldId}/compare`} className={buttonClass("primary", "w-full", "lg")}>
                Compare crop rotations
                <Icon name="next" />
              </Link>
              <p className="m-0 text-source text-ink-muted">Compare also shows these four field risks next to each option. It does not change any ranking.</p>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
