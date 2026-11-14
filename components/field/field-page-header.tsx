import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function FieldPageHeader({
  title,
  summary,
  action,
  className,
}: {
  title: ReactNode;
  summary?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-wrap items-end justify-between gap-x-8 gap-y-4 border-b border-line pb-5", className)}>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <h1 className="min-w-0 [overflow-wrap:break-word] text-balance text-title text-ink sm:text-display">{title}</h1>
        {summary ? <p className="m-0 max-w-measure text-body text-ink-muted">{summary}</p> : null}
      </div>
      {action ? <div className="shrink-0 max-sm:w-full">{action}</div> : null}
    </header>
  );
}
