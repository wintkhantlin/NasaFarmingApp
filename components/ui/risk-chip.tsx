import type { ReactNode } from "react";
import Chip from "@mui/material/Chip";
import { HazardGlyph, type Hazard } from "./icons";

// MUI sets its own colours and height with unlayered CSS, which beats Tailwind's
// layered utilities. So the chip's colours go through `sx`, from the same tokens
// (@theme static in globals.css emits every token as a CSS variable).
const TONES: Record<Hazard, { bg: string; fg: string }> = {
  water: { bg: "var(--color-water-soft)", fg: "var(--color-water)" },
  heat: { bg: "var(--color-heat-soft)", fg: "var(--color-heat)" },
  drought: { bg: "var(--color-drought-soft)", fg: "var(--color-drought)" },
  frost: { bg: "var(--color-frost-soft)", fg: "var(--color-frost)" },
  healthy: { bg: "var(--color-field-soft)", fg: "var(--color-healthy)" },
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
  const tone = TONES[hazard];
  return (
    <Chip
      icon={<HazardGlyph hazard={hazard} className="shrink-0" />}
      label={children}
      className={className}
      sx={{
        height: "auto",
        minHeight: 28,
        maxWidth: "100%",
        borderRadius: "var(--radius-pill)",
        border: `1px solid color-mix(in srgb, ${tone.fg} 25%, transparent)`,
        backgroundColor: tone.bg,
        color: tone.fg,
        fontSize: "var(--text-label)",
        fontWeight: 500,
        lineHeight: 1.25,
        py: "4px",
        px: "10px",
        gap: "6px",
        "& .MuiChip-icon": { color: "inherit", m: 0 },
        "& .MuiChip-label": { p: 0, whiteSpace: "normal", color: "inherit" },
      }}
    />
  );
}
