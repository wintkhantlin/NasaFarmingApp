import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface EmptyStateProps {
  title: string;
  body: string;
  children?: ReactNode;
  className?: string;
}

/** First-run and nothing-here states: say what will appear and how to add the first one. */
export function EmptyState({ title, body, children, className }: EmptyStateProps) {
  return (
    <section
      className={cn(
        "flex flex-col items-start gap-3 rounded-lg border border-dashed border-line-strong bg-surface-raised p-6 sm:p-8",
        className,
      )}
    >
      <h2 className="text-balance text-title text-ink">{title}</h2>
      <p className="m-0 max-w-measure text-body text-ink-muted">{body}</p>
      {children ? (
        <div className="flex w-full flex-col flex-wrap gap-2 pt-2 sm:w-auto sm:flex-row [&>a]:w-full sm:[&>a]:w-auto [&>button]:w-full sm:[&>button]:w-auto">
          {children}
        </div>
      ) : null}
    </section>
  );
}
