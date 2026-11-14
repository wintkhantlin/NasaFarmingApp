import type { ReactNode } from "react";

/** First-run and nothing-here states: say what will appear and how to add the first one. */
export function EmptyState({ title, body, children }: { title: string; body: string; children?: ReactNode }) {
  return (
    <section className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-line-strong bg-surface-raised p-6">
      <h2 className="text-balance text-title text-ink">{title}</h2>
      <p className="max-w-measure text-body text-ink-muted">{body}</p>
      {children ? <div className="flex flex-wrap gap-2 pt-1">{children}</div> : null}
    </section>
  );
}
