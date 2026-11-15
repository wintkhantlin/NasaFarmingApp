import { Icon, type IconName } from "@/components/ui/icon";
import { cn } from "@/lib/cn";

/**
 * A reading as a banded word (Low, OK, High) with an icon, plus the exact number small.
 * The word and the icon carry the meaning, never the colour alone.
 */
export type Band = "low" | "ok" | "high";

const BAND_WORD: Record<Band, string> = { low: "Low", ok: "OK", high: "High" };
const BAND_ICON: Record<Band, IconName> = { low: "warning", ok: "success", high: "warning" };
const BAND_CLASS: Record<Band, string> = {
  low: "bg-drought-soft text-drought",
  ok: "bg-field-soft text-field",
  high: "bg-drought-soft text-drought",
};

/** Usual yearly rain in mm. Under 700 is dry for most crops here; over 1800 is a wet place. */
export const bandRain = (mm: number): Band => (mm < 700 ? "low" : mm > 1800 ? "high" : "ok");

/** The hottest usual month, in degrees C. */
export const bandHeat = (c: number): Band => (c < 30 ? "low" : c >= 38 ? "high" : "ok");

/** Soil acidity. A crop's own range wins when it is known. */
export function bandPh(ph: number, range?: [number, number] | null): Band {
  const [lo, hi] = range ?? [5.5, 7.5];
  return ph < lo ? "low" : ph > hi ? "high" : "ok";
}

/** Organic carbon in g/kg. */
export const bandCarbon = (g: number): Band => (g < 10 ? "low" : g > 30 ? "high" : "ok");

export function BandChip({ band, label, className }: { band: Band; label?: string; className?: string }) {
  return (
    <span className={cn("inline-flex min-h-8 items-center gap-1.5 rounded-pill px-3 py-1 text-body-sm font-semibold", BAND_CLASS[band], className)}>
      <Icon name={BAND_ICON[band]} size={16} strokeWidth={2.4} />
      {label ?? BAND_WORD[band]}
    </span>
  );
}

/** A small neutral status chip: icon plus words. Use for rain, frost, heat, pest, soil and water facts. */
export function StatusChip({ icon, children, tone = "neutral", className }: { icon: IconName; children: React.ReactNode; tone?: "neutral" | "good" | "watch"; className?: string }) {
  const t = tone === "good" ? "bg-field-soft text-field" : tone === "watch" ? "bg-drought-soft text-drought" : "bg-surface-sunken text-ink";
  return (
    <span className={cn("inline-flex min-h-8 items-center gap-1.5 rounded-pill px-3 py-1 text-body-sm font-medium", t, className)}>
      <Icon name={icon} size={16} strokeWidth={2.2} />
      {children}
    </span>
  );
}
