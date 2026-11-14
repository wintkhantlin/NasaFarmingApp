import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { HazardGlyph, type Hazard } from "./icons";

const TONES: Record<Hazard, string> = {
  water: "bg-water-soft text-water",
  heat: "bg-heat-soft text-heat",
  drought: "bg-drought-soft text-drought",
  frost: "bg-frost-soft text-frost",
  healthy: "bg-field-soft text-healthy",
};

/**
 * A hazard or status as an icon plus words in its data colour, so meaning
 * never depends on colour alone. Words say the hazard and the time window.
 */
export function RiskChip({ hazard, children, className }: { hazard: Hazard; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex w-fit items-center gap-1 rounded-pill py-1 pr-3 pl-2.5 text-label", TONES[hazard], className)}>
      <HazardGlyph hazard={hazard} />
      <span>{children}</span>
    </span>
  );
}
