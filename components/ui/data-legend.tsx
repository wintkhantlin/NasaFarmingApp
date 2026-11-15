import { copy } from "@/lib/copy/en";
import { cn } from "@/lib/cn";

/** One plain key for how every number in the app was made. Shown once at the top of the data pages. */
export function DataLegend({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col gap-0.5 rounded-md border border-line bg-surface-sunken px-4 py-3", className)}>
      <p className="m-0 text-label text-ink">{copy.data.legendLine}</p>
      <p className="m-0 max-w-measure text-body-sm text-ink-muted">{copy.data.legendHelp}</p>
    </div>
  );
}
