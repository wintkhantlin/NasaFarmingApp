"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Stepper, type StepId } from "@/components/ui/stepper";
import { deriveStepStates, useFieldRotations, useFieldsStore } from "@/lib/store/fields-store";

function stepFromPath(pathname: string, fieldId: string): StepId {
  const rest = pathname.replace(`/fields/${fieldId}`, "").replace(/^\//, "");
  if (rest.startsWith("rotation")) return "rotation";
  if (rest.startsWith("profile")) return "profile";
  if (rest.startsWith("conditions")) return "conditions";
  if (rest.startsWith("compare") || rest.startsWith("report")) return "compare";
  return "location";
}

/**
 * The workspace around one field: a breadcrumb, then the five steps (a strip
 * above the screen on phones, a rail beside it from lg), then the screen.
 * Each screen supplies only its own title and content.
 */
export function FieldShell({ children }: { children: ReactNode }) {
  const { fieldId } = useParams<{ fieldId: string }>();
  const pathname = usePathname();
  const status = useFieldsStore((s) => s.status);
  const field = useFieldsStore((s) => s.fields.find((f) => f.id === fieldId));
  const rotations = useFieldRotations(fieldId);

  // Unknown field: the screen itself explains, without a workspace around it.
  if (status === "ready" && !field) return <>{children}</>;

  const loading = status === "idle" || status === "loading";

  return (
    <div className="flex flex-col gap-5 print:block">
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 text-body-sm text-ink-muted print:hidden">
        <Link href="/" className="inline-flex min-h-tap items-center text-ink-muted hover:text-ink hover:underline">
          Your fields
        </Link>
        <span aria-hidden="true">/</span>
        {field ? (
          <span className="truncate text-ink" aria-current="page">
            {field.name}
          </span>
        ) : (
          <Skeleton className="h-4 w-28" />
        )}
      </nav>

      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start lg:gap-10 print:block">
        <div className="lg:sticky lg:top-24 print:hidden">
          {loading || !field ? (
            <Skeleton className="h-16 lg:h-64" />
          ) : (
            <Stepper
              fieldId={field.id}
              current={stepFromPath(pathname, field.id)}
              states={deriveStepStates(field, rotations)}
            />
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-6">{children}</div>
      </div>
    </div>
  );
}
