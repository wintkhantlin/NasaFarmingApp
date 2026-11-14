import type { ReactNode } from "react";
import Chip from "@mui/material/Chip";
import { cn } from "@/lib/cn";
import { HazardGlyph, type Hazard } from "./icons";

const TONES: Record<Hazard, string> = {
  water: "bg-water-soft text-water border-water/20",
  heat: "bg-heat-soft text-heat border-heat/20",
  drought: "bg-drought-soft text-drought border-drought/20",
  frost: "bg-frost-soft text-frost border-frost/20",
  healthy: "bg-field-soft text-healthy border-healthy/20",
};

/**
 * A hazard or status as an icon plus words in its data colour, so meaning
 * never depends on colour alone (The Never-Color-Alone Rule).
 */
export function RiskChip({
  hazard,
  children,
  className,
}: {
  hazard: Hazard;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Chip
      icon={<HazardGlyph hazard={hazard} className="shrink-0 text-current" />}
      label={<span className="font-medium text-label text-current">{children}</span>}
      className={cn(
        "inline-flex h-auto items-center gap-1.5 border px-2.5 py-1 text-label rounded-pill font-medium",
        TONES[hazard],
        className,
      )}
      sx={{
        "& .MuiChip-icon": {
          color: "inherit",
          marginLeft: 0,
          marginRight: "4px",
        },
        "& .MuiChip-label": {
          padding: 0,
          color: "inherit",
        },
      }}
    />
  );
}
