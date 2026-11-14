import type { ReactElement, ReactNode } from "react";
import Chip from "@mui/material/Chip";
import { CheckGlyph, HazardGlyph, InfoGlyph, type Hazard } from "./icons";

export type ChipTone = Hazard | "neutral" | "field";

// MUI sets its own colours and height with unlayered CSS, which beats Tailwind's
// layered utilities. So the chip's colours go through `sx`, from the same tokens
// (@theme static in globals.css emits every token as a CSS variable).
const TONES: Record<ChipTone, { bg: string; fg: string }> = {
  water: { bg: "var(--color-water-soft)", fg: "var(--color-water)" },
  heat: { bg: "var(--color-heat-soft)", fg: "var(--color-heat)" },
  drought: { bg: "var(--color-drought-soft)", fg: "var(--color-drought)" },
  frost: { bg: "var(--color-frost-soft)", fg: "var(--color-frost)" },
  healthy: { bg: "var(--color-field-soft)", fg: "var(--color-healthy)" },
  neutral: { bg: "var(--color-surface-sunken)", fg: "var(--color-ink-muted)" },
  field: { bg: "var(--color-field-soft)", fg: "var(--color-field)" },
};

/**
 * A hazard or status as an icon plus words in its data colour, so meaning
 * never depends on colour alone (The Never-Color-Alone Rule).
 */
export function RiskChip({
  hazard = "neutral",
  icon,
  children,
  className,
}: {
  hazard?: ChipTone;
  icon?: ReactElement;
  children: ReactNode;
  className?: string;
}) {
  const tone = TONES[hazard] ?? TONES.neutral;
  const chipIcon =
    icon ??
    (hazard === "neutral" ? (
      <InfoGlyph className="shrink-0" />
    ) : hazard === "field" ? (
      <CheckGlyph width={14} height={14} className="shrink-0" />
    ) : (
      <HazardGlyph hazard={hazard} className="shrink-0" />
    ));

  return (
    <Chip
      icon={chipIcon}
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
        transition: "transform 100ms ease, opacity 100ms ease",
        "&:active": { transform: "scale(0.98)" },
        "& .MuiChip-icon": { color: "inherit", m: 0 },
        "& .MuiChip-label": { p: 0, whiteSpace: "normal", color: "inherit" },
      }}
    />
  );
}
