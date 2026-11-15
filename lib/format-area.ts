import { formatArea, HA_TO_ACRES, type AreaUnit } from "@/lib/units";

/**
 * One area in the farmer's own unit, for example "2.4 ha" or "5.9 acres" (Burmese: ဟက်တာ / ဧက).
 * Shows one unit only. Returns an empty string when the area is not known.
 */
export function formatAreaForLocale(
  ha: number | null | undefined,
  unit: AreaUnit = "ha",
  locale: "en" | "my" = "en",
): string {
  if (ha === null || ha === undefined || !Number.isFinite(ha)) return "";
  if (locale !== "my") return formatArea(ha, unit);
  const value = unit === "acre" ? ha * HA_TO_ACRES : ha;
  const text = value < 10 ? value.toFixed(1) : String(Math.round(value));
  return `${text} ${unit === "acre" ? "ဧက" : "ဟက်တာ"}`;
}
