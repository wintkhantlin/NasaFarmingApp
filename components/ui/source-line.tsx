import Tooltip from "@mui/material/Tooltip";
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
  /** Optional explanation or citation details */
  detail?: string;
  className?: string;
}

/** Cites the data behind a figure quietly. One goes under every reading, chart and recommendation. */
export function SourceLine({ dataset, resolution, dates, stale, detail, className }: SourceLineProps) {
  const parts = [dataset, resolution, dates].filter(Boolean) as string[];

  const content = (
    <div className={cn("tabular flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-source text-ink-muted", className)}>
      {parts.map((p, idx) => (
        <span key={p} className="flex items-center gap-1.5">
          {idx > 0 ? <span className="opacity-40">·</span> : null}
          <span>{p}</span>
        </span>
      ))}
      {stale ? <span className="font-sans font-medium text-drought">Older than usual</span> : null}
    </div>
  );

  if (detail) {
    return (
      <Tooltip title={detail} arrow enterTouchDelay={50}>
        <div className="cursor-help w-fit">{content}</div>
      </Tooltip>
    );
  }

  return content;
}
