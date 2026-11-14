import { cn } from "@/lib/cn";
import type { Hazard } from "./icons";
import { Panel } from "./panel";
import { RiskChip } from "./risk-chip";
import { SourceLine, type SourceLineProps } from "./source-line";

export interface ReadingProps {
  /** Plain name, not the dataset: "Soil acidity". */
  label: string;
  value: number;
  /** Unit, attached to the value: "pH", "%", "mm". */
  unit?: string;
  /** Comfortable range [min, max] for the crop and stage. */
  band?: [number, number];
  /** Axis of the bar. Defaults to [0, 100]. */
  scale?: [number, number];
  /** Words for the verdict. Computed from `band` when omitted. */
  verdictText?: string;
  /** Colour used when the value is out of range. */
  offTone?: Exclude<Hazard, "healthy">;
  source?: SourceLineProps;
  className?: string;
}

const MARK_TONE: Record<Hazard, string> = {
  healthy: "text-healthy",
  water: "text-water",
  heat: "text-heat",
  drought: "text-drought",
  frost: "text-frost",
};

/** One measured value with its unit, the comfortable band, and a verdict in words. */
export function Reading({
  label,
  value,
  unit,
  band,
  scale = [0, 100],
  verdictText,
  offTone = "drought",
  source,
  className,
}: ReadingProps) {
  const [min, max] = scale;
  const pct = (v: number) => Math.max(0, Math.min(100, ((v - min) / (max - min)) * 100));
  const inRange = band ? value >= band[0] && value <= band[1] : null;
  const tone: Hazard = inRange === false ? offTone : "healthy";
  const words =
    verdictText ??
    (inRange === null ? undefined : inRange ? "In range" : value < band![0] ? "Below range" : "Above range");

  return (
    <Panel as="div" className={cn("flex flex-col gap-2 p-4", className)}>
      <p className="m-0 text-label text-ink-muted">{label}</p>
      <p className="tabular m-0 font-mono text-reading text-ink">
        {value}
        {unit ? <span className="ml-1 text-data text-ink-muted">{unit}</span> : null}
      </p>
      {band ? (
        <div
          role="img"
          aria-label={`Comfortable range ${band[0]} to ${band[1]}${unit ? ` ${unit}` : ""}. Reading ${value}.`}
          className="relative my-1.5 h-3.5 w-full overflow-hidden rounded-pill bg-surface-sunken"
        >
          <span
            className="absolute inset-y-0 border-x-2 border-healthy bg-field-soft"
            style={{ left: `${pct(band[0])}%`, width: `${pct(band[1]) - pct(band[0])}%` }}
          />
          <span
            className={cn("absolute inset-y-0 w-1.5 -translate-x-1/2 rounded-sm bg-current", MARK_TONE[tone])}
            style={{ left: `${pct(value)}%` }}
          />
        </div>
      ) : null}
      {words ? (
        <div>
          <RiskChip hazard={tone}>{words}</RiskChip>
        </div>
      ) : null}
      {source ? <SourceLine {...source} className="mt-auto pt-1" /> : null}
    </Panel>
  );
}
