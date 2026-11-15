"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useCompareViewedStore } from "@/lib/store/compare-viewed";
import { PageBar } from "@/components/ui/page-bar";
import { Icon, type IconName } from "@/components/ui/icon";
import { cn } from "@/lib/cn";
import {
  deriveStepStates,
  useFieldRotations,
  useFieldsStore,
  type StepId,
} from "@/lib/store/fields-store";
import { REGIONS } from "@/lib/data/regions";

const TABS: Array<{ label: string; path: string; icon: IconName; step?: StepId }> = [
  { label: "Overview", path: "", icon: "fields" },
  { label: "Farm", path: "/profile", icon: "profile", step: "profile" },
  { label: "Crops", path: "/rotation", icon: "rotation", step: "rotation" },
  { label: "Conditions", path: "/conditions", icon: "conditions" },
  { label: "Compare", path: "/compare", icon: "compare", step: "compare" },
];

function activeTab(pathname: string, base: string): string {
  const rest = pathname.slice(base.length);
  if (rest.startsWith("/profile")) return "/profile";
  if (rest.startsWith("/rotation")) return "/rotation";
  if (rest.startsWith("/conditions") || rest.startsWith("/trends")) return "/conditions";
  if (rest.startsWith("/compare") || rest.startsWith("/report") || rest.startsWith("/questions")) return "/compare";
  return "";
}

function detailNavigation(pathname: string, base: string): { href: string; label: string } | null {
  if (/\/report$/.test(pathname)) return { href: `${base}/compare`, label: "Compare" };
  if (/\/trends$/.test(pathname)) return { href: `${base}/conditions`, label: "Weather and soil" };
  if (/\/questions\//.test(pathname) || /\/pests$/.test(pathname)) return { href: base, label: "Field overview" };
  return null;
}

function tabStateText({
  done,
  compare,
  hasRegionalCatalog,
  state,
}: {
  done: boolean;
  compare: boolean;
  hasRegionalCatalog: boolean;
  state: ReturnType<typeof deriveStepStates>[StepId];
}): string {
  if (done) return "complete";
  if (compare && !hasRegionalCatalog) return "regional comparisons not available";
  if (compare && state === "needs-input") return "not opened yet";
  return state === "needs-input" ? "needs your input" : "not started";
}

function FieldTabs({
  fieldName,
  base,
  pathname,
  steps,
  hasRegionalCatalog,
}: {
  fieldName: string;
  base: string;
  pathname: string;
  steps: ReturnType<typeof deriveStepStates>;
  hasRegionalCatalog: boolean;
}) {
  const selectedPath = activeTab(pathname, base);
  return (
    <nav
      aria-label={`Pages for ${fieldName}`}
      className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-20 -mx-4 border-y border-line bg-surface px-4 sm:top-[calc(4rem+env(safe-area-inset-top))] sm:-mx-6 sm:px-6 print:hidden"
    >
      <ul className="m-0 grid grid-cols-5 list-none gap-0 p-0 sm:flex sm:gap-1">
        {TABS.map((tab) => {
          const selected = selectedPath === tab.path;
          const stepState = tab.step ? steps[tab.step] : undefined;
          const compare = tab.step === "compare";
          const done = compare ? stepState === "done" && hasRegionalCatalog : stepState === "done";
          return (
            <li key={tab.path}>
              <Link
                href={`${base}${tab.path}`}
                aria-current={selected ? "page" : undefined}
                className={cn(
                  "relative flex min-h-14 min-w-0 flex-col items-center justify-center gap-0.5 border-b-2 px-1 text-source no-underline transition-colors sm:min-h-tap sm:flex-row sm:gap-2 sm:px-3 sm:text-label",
                  selected ? "border-field font-semibold text-field" : "border-transparent text-ink-muted hover:text-ink",
                )}
              >
                <Icon name={tab.icon} size={18} className="shrink-0" />
                <span className="inline-flex items-center gap-1">
                  {tab.label}
                  {done ? <Icon name="done" size={13} strokeWidth={2.6} aria-hidden className="text-field" /> : null}
                </span>
                {stepState ? (
                  <span className="sr-only">{tabStateText({ done, compare, hasRegionalCatalog, state: stepState })}</span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Five peer tabs provide the field's only persistent field-level navigation. */
export function FieldShell({ children }: { children: ReactNode }) {
  const { fieldId } = useParams<{ fieldId: string }>();
  const pathname = usePathname();
  const status = useFieldsStore((s) => s.status);
  const field = useFieldsStore((s) => s.fields.find((f) => f.id === fieldId));
  const rotations = useFieldRotations(fieldId);
  const base = `/fields/${fieldId}`;
  const compareViewed = useCompareViewedStore((s) => Boolean(s.viewed[fieldId]));
  const hydrateCompareViewed = useCompareViewedStore((s) => s.hydrate);
  useEffect(() => {
    hydrateCompareViewed();
  }, [hydrateCompareViewed]);
  const steps = deriveStepStates(field, rotations, { compareViewed });
  const hasRegionalCatalog = Boolean(
    field?.region &&
      field.region !== "unsupported" &&
      (REGIONS[field.region]?.candidateCropIds.length ?? 0) > 0,
  );
  if (status === "ready" && !field) return <>{children}</>;

  const detail = detailNavigation(pathname, base);

  return (
    <div className="flex flex-col gap-5 print:block">
      {detail ? <PageBar backHref={detail.href} backLabel={detail.label} /> : null}
      {field && !detail ? (
        <FieldTabs fieldName={field.name} base={base} pathname={pathname} steps={steps} hasRegionalCatalog={hasRegionalCatalog} />
      ) : null}
      <div className="flex min-w-0 flex-col gap-6">{children}</div>
    </div>
  );
}
