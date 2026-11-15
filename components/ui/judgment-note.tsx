import { cn } from "@/lib/cn";
import { copy } from "@/lib/copy/en";
import { Message } from "./message";

/** Says the tool supports the farmer's judgment. Shown on every comparison screen. */
export function JudgmentNote({ className, compact }: { className?: string; compact?: boolean }) {
  if (compact) return <p className={cn("m-0 max-w-measure text-body-sm text-ink-muted", className)}>{copy.judgment.short}</p>;
  return (
    <Message tone="info" className={className} title={copy.judgment.short}>
      {copy.judgment.long}
    </Message>
  );
}
