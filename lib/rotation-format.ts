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

/** Number of calendar days from ISO date `from` to `to`. Positive when to > from. */
export function daysBetween(from: string, to: string): number {
  const d1 = Date.parse(from);
  const d2 = Date.parse(to);
  if (Number.isNaN(d1) || Number.isNaN(d2)) return 0;
  return Math.round((d2 - d1) / 86_400_000);
}

/** Adds `days` days to an ISO YYYY-MM-DD date and returns a new YYYY-MM-DD string. */
export function addDaysToIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

/** Left and width (0 to 1) of [from, to] inside calendar year `year`, or null when it does not touch it. */
export function segmentYear(year: number, from: string, to: string): { left: number; width: number } | null {
  const y0 = Date.UTC(year, 0, 1) / 86_400_000;
  const y1 = Date.UTC(year + 1, 0, 1) / 86_400_000;
  const dFrom = Date.parse(from) / 86_400_000;
  const dTo = Date.parse(to) / 86_400_000;
  if (Number.isNaN(dFrom) || Number.isNaN(dTo)) return null;
  const a = Math.max(dFrom, y0);
  const b = Math.min(dTo + 1, y1);
  if (b <= a) return null;
  return { left: (a - y0) / (y1 - y0), width: (b - a) / (y1 - y0) };
}
