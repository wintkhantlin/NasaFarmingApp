import { getCropById } from "@/lib/data/crops";
import type { Rotation, RotationSlot } from "@/lib/types";

/** The plain name of what grows in a slot: "Maize (Corn)", "Fallow", "Cover crop". */
export function slotName(slot: RotationSlot): string {
  if (slot.kind === "fallow") return "Fallow";
  const crop = slot.cropId ? getCropById(slot.cropId) : undefined;
  if (crop) return crop.names.common;
  return slot.kind === "cover" ? "Cover crop" : (slot.cropId ?? "Crop");
}

/** A short name for tight spaces: "Maize" from "Maize (Corn)". */
export function shortSlotName(slot: RotationSlot): string {
  return slotName(slot).replace(/\s*\(.*\)\s*$/, "");
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-05-15" to "15 May". No timezone maths, so it never shifts a day. */
export function formatDay(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  if (!m || !d) return iso;
  return `${d} ${MONTHS[m - 1]}`;
}

/** "15 May to 10 Oct". */
export function formatSpan(plantDate: string, harvestDate: string): string {
  return `${formatDay(plantDate)} to ${formatDay(harvestDate)}`;
}

/** "Maize, then Soybean, then Fallow". */
export function sequenceText(rotation: Pick<Rotation, "slots">, joiner = ", then "): string {
  return rotation.slots.map(shortSlotName).join(joiner);
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** Position of a date inside its calendar year, 0 to 1. */
export function yearFraction(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return 0;
  const start = Date.UTC(y, 0, 1);
  const end = Date.UTC(y + 1, 0, 1);
  return (Date.UTC(y, m - 1, d) - start) / (end - start);
}
