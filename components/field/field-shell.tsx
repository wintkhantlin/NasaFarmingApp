"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { PageBar } from "@/components/ui/page-bar";
import { Icon, type IconName } from "@/components/ui/icon";
import { cn } from "@/lib/cn";
import {
  deriveStepStates,
  useFieldRotations,
  useFieldsStore,
  type StepId,
} from "@/lib/store/fields-store";

const TABS: Array<{ label: string; path: string; icon: IconName; step?: StepId }> = [
  { label: "Overview", path: "", icon: "fields" },
  { label: "Crops", path: "/rotation", icon: "rotation", step: "rotation" },
  { label: "Compare", path: "/compare", icon: "compare", step: "compare" },
  { label: "Farm", path: "/profile", icon: "profile", step: "profile" },
];

function activeTab(pathname: string, base: string): string {
  const rest = pathname.slice(base.length);
  if (rest.startsWith("/profile")) return "/profile";
  if (rest.startsWith("/rotation")) return "/rotation";
  // Conditions, trends and pests are opened from the Overview, so they stay under it.
  if (rest.startsWith("/compare") || rest.startsWith("/report") || rest.startsWith("/share") || rest.startsWith("/questions")) return "/compare";
  return "";
}

/** Four field tabs keep navigation in one place; Conditions and Trends open from the Overview. */
export function FieldShell({ children }: { children: ReactNode }) {
  const { fieldId } = useParams<{ fieldId: string }>();
  const pathname = usePathname();
  const status = useFieldsStore((s) => s.status);
  const field = useFieldsStore((s) => s.fields.find((f) => f.id === fieldId));
  const rotations = useFieldRotations(fieldId);
  const base = `/fields/${fieldId}`;
  const isResult = /\/(report|share)$|\/questions\//.test(pathname);
  const isOverview = pathname === base;
  const steps = deriveStepStates(field, rotations);
  const workflowStatus =
    steps.location !== "done"
      ? "Confirm this field to continue"
      : steps.rotation !== "done"
        ? "Add crops to see options"
        : steps.profile !== "done"
          ? "You can compare now · farm details are optional"
          : "Crops and farm details saved";

  if (status === "ready" && !field) return <>{children}</>;

  return (
    <div className="flex flex-col gap-5 print:block">
      <PageBar backHref={isResult ? `${base}/compare` : "/"} backLabel={isResult ? "Compare" : "All fields"} />
      {field && !isOverview ? (
        <div className="-mt-3 flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-1 print:hidden">
          <Link href={base} className="min-w-0 truncate text-label font-semibold text-ink no-underline hover:text-field hover:underline">
            {field.name}
          </Link>
          <span className="text-source text-ink-muted">{workflowStatus}</span>
        </div>
      ) : null}
      {field ? (
        <nav
          aria-label={`Pages for ${field.name}`}
          className="sticky top-14 z-20 -mx-4 border-y border-line bg-surface px-4 sm:top-16 sm:-mx-6 sm:px-6 print:hidden"
        >
          <ul className="m-0 grid grid-cols-4 list-none gap-0 p-0 sm:flex sm:gap-1">
            {TABS.map((tab) => {
              const selected = activeTab(pathname, base) === tab.path;
              const stepState = tab.step ? steps[tab.step] : undefined;
              const done = stepState === "done";
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
                    {stepState ? <span className="sr-only">{done ? "complete" : stepState === "needs-input" ? "needs your input" : "not started"}</span> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      ) : null}
      <div className="flex min-w-0 flex-col gap-6">{children}</div>
    </div>
  );
}
