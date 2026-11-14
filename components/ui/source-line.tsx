import { cn } from "@/lib/cn";

export interface SourceLineProps {
  /** Dataset name, e.g. "NASA POWER". */
  dataset: string;
  /** Spatial resolution, e.g. "0.5°". */
  resolution?: string;
  /** Period or pass date, e.g. "1981 to 2024". */
  dates?: string;
  /** Data is older than its usual refresh. */
  stale?: boolean;
  className?: string;
}

/** Cites the data behind a figure. One goes under every reading, chart and recommendation. */
export function SourceLine({ dataset, resolution, dates, stale, className }: SourceLineProps) {
  const parts = [dataset, resolution, dates].filter(Boolean) as string[];
  return (
    <p className={cn("tabular flex flex-wrap gap-x-3 gap-y-1 font-mono text-source text-ink-muted", className)}>
      {parts.map((p) => (
        <span key={p}>{p}</span>
      ))}
      {stale ? <span className="font-medium text-drought">Older than usual</span> : null}
    </p>
  );
}
