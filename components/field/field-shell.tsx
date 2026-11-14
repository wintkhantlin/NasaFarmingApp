"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { PageBar } from "@/components/ui/page-bar";
import { Icon, type IconName } from "@/components/ui/icon";
import { cn } from "@/lib/cn";
import { useFieldsStore } from "@/lib/store/fields-store";

const TABS: Array<{ label: string; path: string; icon: IconName }> = [
  { label: "Overview", path: "", icon: "fields" },
  { label: "Crops", path: "/rotation", icon: "rotation" },
  { label: "Conditions", path: "/conditions", icon: "conditions" },
  { label: "Compare", path: "/compare", icon: "compare" },
];

function activeTab(pathname: string, base: string): string {
  const rest = pathname.slice(base.length);
  if (rest.startsWith("/rotation")) return "/rotation";
  if (rest.startsWith("/conditions")) return "/conditions";
  if (rest.startsWith("/compare") || rest.startsWith("/report") || rest.startsWith("/questions")) return "/compare";
  return "";
}

/** Familiar field tabs keep navigation in one place on every field screen. */
export function FieldShell({ children }: { children: ReactNode }) {
  const { fieldId } = useParams<{ fieldId: string }>();
  const pathname = usePathname();
  const status = useFieldsStore((s) => s.status);
  const field = useFieldsStore((s) => s.fields.find((f) => f.id === fieldId));
  const base = `/fields/${fieldId}`;
  const isResult = /\/report$|\/questions\//.test(pathname);

  if (status === "ready" && !field) return <>{children}</>;

  return (
    <div className="flex flex-col gap-5 print:block">
      <PageBar backHref={isResult ? `${base}/compare` : "/"} backLabel={isResult ? "Compare" : "Fields"} />
      {field ? (
        <nav aria-label={`Pages for ${field.name}`} className="-mx-4 border-b border-line px-4 sm:-mx-6 sm:px-6 print:hidden">
          <ul className="m-0 grid grid-cols-4 list-none gap-0 p-0 sm:flex sm:gap-1">
            {TABS.map((tab) => {
              const selected = activeTab(pathname, base) === tab.path;
              return (
                <li key={tab.path}>
                  <Link
                    href={`${base}${tab.path}`}
                    aria-current={selected ? "page" : undefined}
                    className={cn(
                      "flex min-h-14 min-w-0 flex-col items-center justify-center gap-0.5 border-b-2 px-1 text-source no-underline transition-colors sm:min-h-tap sm:flex-row sm:gap-2 sm:px-3 sm:text-label",
                      selected ? "border-field font-semibold text-field" : "border-transparent text-ink-muted hover:text-ink",
                    )}
                  >
                    <Icon name={tab.icon} size={18} />
                    {tab.label}
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
