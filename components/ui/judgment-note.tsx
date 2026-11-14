import { cn } from "@/lib/cn";
import { copy } from "@/lib/copy/en";
import { InfoGlyph } from "./icons";
import { Panel } from "./panel";

/** Says the tool supports the farmer's judgment. Shown on every comparison screen. */
export function JudgmentNote({ className, compact }: { className?: string; compact?: boolean }) {
  if (compact) return <p className={cn("m-0 max-w-measure text-body-sm text-ink-muted", className)}>{copy.judgment.short}</p>;
  return (
    <Panel as="aside" tone="plain" className={cn("flex gap-3 p-4", className)}>
      <InfoGlyph className="mt-0.5 shrink-0 text-ink-muted" />
      <div className="flex min-w-0 flex-col gap-1">
        <p className="m-0 text-label text-ink">{copy.judgment.short}</p>
        <p className="m-0 max-w-measure text-body-sm text-ink-muted">{copy.judgment.long}</p>
      </div>
    </Panel>
  );
}
