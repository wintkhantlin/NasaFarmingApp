import { copy } from "@/lib/copy/en";
import { cn } from "@/lib/cn";

/** Says the tool supports the farmer's judgment. Shown on every comparison screen. */
export function JudgmentNote({ className }: { className?: string }) {
  return (
    <aside className={cn("rounded-md border border-line bg-surface-raised p-4", className)}>
      <p className="text-label text-ink">{copy.judgment.short}</p>
      <p className="max-w-measure text-body-sm text-ink-muted">{copy.judgment.long}</p>
    </aside>
  );
}
