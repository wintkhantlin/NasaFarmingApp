"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { Icon, type IconName } from "@/components/ui/icon";
import { buttonClass } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { cn } from "@/lib/cn";
import type { ComparisonResult } from "@/lib/engine/compare";
import type { ComparisonDisplay } from "@/lib/plan/engine-display";
import type { useAppCopy } from "@/lib/store/locale-store";
import type { Field } from "@/lib/types";

/**
 * One card for every dead end on the compare page. Each blocker says what is true, why, and gives exactly one
 * primary button. "Try again" appears only on a refreshing blocker: retrying cannot fix a missing local crop list
 * or limits that are too strict.
 */
export type BlockerKind = "no-local-catalog" | "limits-too-strict" | "refreshing" | "setup-incomplete" | "needs-priorities";
export type BlockerTone = "info" | "needs" | "caution";

export interface BlockerAction {
  label: string;
  /** A link target. Either href or onClick is set. */
  href?: string;
  onClick?: () => void;
  /** A busy button (still loading): shown but not pressable. */
  disabled?: boolean;
}

export interface ResultBlockerModel {
  kind: BlockerKind;
  title: string;
  body: string;
  primary: BlockerAction;
  secondary?: BlockerAction;
  tone: BlockerTone;
  /** limits-too-strict: why each plan was left out. */
  reasons?: string[];
}

export interface BlockerContext {
  copy: ReturnType<typeof useAppCopy>;
  /** False when the browser says it is offline. Defaults to online. */
  online?: boolean;
  /** Reloads the analysis. Needed for the refreshing kind. */
  retry: () => void;
}

/** Decide which single blocker (if any) the compare page shows. Null means there is something real to show. */
export function resolveBlocker(
  display: ComparisonDisplay,
  comparison: ComparisonResult | null,
  field: Field | undefined,
  ctx: BlockerContext,
): ResultBlockerModel | null {
  if (!field) return null;
  const t = ctx.copy.compare.blocker;
  const base = `/fields/${field.id}`;
  const retryAction = (label: string): BlockerAction => ({ label, onClick: ctx.retry });

  const refreshing = (state: ComparisonDisplay["state"] | "weather"): ResultBlockerModel => {
    if (state === "stale") return { kind: "refreshing", tone: "info", title: t.staleTitle, body: t.staleBody, primary: retryAction(t.staleAction) };
    if (state === "evaluating") {
      return { kind: "refreshing", tone: "info", title: t.loadingTitle, body: t.loadingBody, primary: { label: t.loadingAction, disabled: true } };
    }
    if (ctx.online === false) return { kind: "refreshing", tone: "needs", title: t.offlineTitle, body: t.offlineBody, primary: retryAction(t.retryAction) };
    return { kind: "refreshing", tone: "needs", title: display.headline || t.errorTitle, body: display.detail || t.errorBody, primary: retryAction(t.retryAction) };
  };

  switch (display.state) {
    case "field-incomplete": {
      const needsLocation = !field.locationConfirmed;
      return {
        kind: "setup-incomplete", tone: "needs", title: display.headline, body: display.detail,
        primary: needsLocation
          ? { label: t.setupLocationAction, href: `${base}/location` }
          : { label: t.setupCropsAction, href: `${base}/rotation` },
      };
    }
    case "stale":
    case "evaluating":
    case "error":
      return refreshing(display.state);
    case "data-unavailable": {
      if (comparison?.region === "unsupported") {
        return {
          kind: "no-local-catalog", tone: "info", title: t.noCatalogUnsupportedTitle, body: t.noCatalogUnsupportedBody,
          primary: { label: t.noCatalogPrimary, href: `${base}/location` },
          secondary: { label: t.noCatalogSecondary, href: `${base}/conditions` },
        };
      }
      const weatherReady = Boolean(comparison) && (comparison?.baseline.completeYears ?? 0) > 0 && comparison?.rain.primary !== "none";
      if (weatherReady && display.reasons.length > 0) {
        return {
          kind: "limits-too-strict", tone: "caution", title: t.limitsTitle, body: t.limitsBody, reasons: display.reasons,
          primary: { label: t.limitsPrimary, href: `${base}/profile` },
        };
      }
      return refreshing("data-unavailable");
    }
    case "unresolved":
    case "partial-evidence": {
      const hasAlternatives = display.options.some((o) => o.kind === "alternative");
      if (comparison && !hasAlternatives && (comparison.region === "myanmar" || comparison.region === "yangon")) {
        const years = comparison.baseline.completeYears;
        if (years <= 0) return refreshing("data-unavailable");
        return {
          kind: "no-local-catalog", tone: "info", title: t.noCatalogTitle, body: t.noCatalogBody(t.regionName[comparison.region], years),
          primary: { label: t.noCatalogPrimary, href: `${base}/location` },
          secondary: { label: t.noCatalogSecondary, href: `${base}/conditions` },
        };
      }
      if (display.state === "unresolved" || comparison?.mcda.status === "no-priorities") {
        return {
          kind: "needs-priorities", tone: "needs", title: t.prioritiesTitle, body: t.prioritiesBody,
          primary: { label: t.prioritiesAction, href: `${base}/questions/priority` },
        };
      }
      return null;
    }
    default:
      return null;
  }
}

const TONE_ICON: Record<BlockerTone, IconName> = { info: "info", needs: "help", caution: "alert" };
const TONE_PANEL: Record<BlockerTone, string> = {
  info: "border-line bg-surface-sunken",
  needs: "border-dashed border-unknown-border bg-unknown-bg",
  caution: "border-drought/30 bg-drought-soft",
};

export function ResultBlocker({
  blocker,
  heading = "h2",
  reasonsTitle,
  className,
}: {
  blocker: ResultBlockerModel;
  /** h1 when the card is the whole page, h2 when it sits under a page header. */
  heading?: "h1" | "h2";
  reasonsTitle?: string;
  className?: string;
}) {
  const Heading = heading;
  const { primary, secondary } = blocker;
  return (
    <Panel
      as="section"
      role="status"
      data-blocker={blocker.kind}
      aria-busy={primary.disabled || undefined}
      className={cn("flex flex-col items-start gap-3 p-4 sm:p-5", TONE_PANEL[blocker.tone], className)}
    >
      <div className="flex items-start gap-3">
        <Icon name={TONE_ICON[blocker.tone]} size={22} className="mt-0.5 shrink-0 text-ink-muted" aria-hidden />
        <div className="flex min-w-0 flex-col gap-1.5">
          <Heading className="m-0 text-headline text-ink">{blocker.title}</Heading>
          <p className="m-0 max-w-measure text-body text-ink-muted">{blocker.body}</p>
        </div>
      </div>
      {blocker.reasons && blocker.reasons.length > 0 ? (
        <details open className="w-full">
          <summary className="min-h-tap cursor-pointer text-label text-ink">{reasonsTitle}</summary>
          <ul className="m-0 mt-1 flex list-disc flex-col gap-1.5 pl-5 text-body-sm text-ink-muted">
            {blocker.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </details>
      ) : null}
      {primary.href ? (
        <Link href={primary.href} className={buttonClass("primary", "w-full sm:w-auto")}>
          {primary.label}
        </Link>
      ) : (
        <button type="button" onClick={primary.onClick} disabled={primary.disabled} className={buttonClass("primary", "w-full sm:w-auto")}>
          {primary.label}
        </button>
      )}
      {secondary ? (
        secondary.href ? (
          <Link href={secondary.href} className="inline-flex min-h-tap items-center text-label text-field underline hover:text-ink">
            {secondary.label}
          </Link>
        ) : (
          <button type="button" onClick={secondary.onClick} className="inline-flex min-h-tap items-center text-label text-field underline hover:text-ink">
            {secondary.label}
          </button>
        )
      ) : null}
    </Panel>
  );
}

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/** True unless the browser reports it is offline. Server render and first paint say online. */
export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}

/** A thin notice at the top of the page while offline. */
export function OfflineBanner({ text }: { text: string }) {
  return (
    <p role="status" className="m-0 flex items-center gap-2 rounded-md border border-line bg-surface-sunken px-3 py-2 text-body-sm text-ink">
      <Icon name="info" size={16} className="shrink-0 text-ink-muted" aria-hidden />
      {text}
    </p>
  );
}
