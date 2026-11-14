import { getCropById } from "../data/crops";
import type { CropEconomics, Rotation } from "../types";

/**
 * Economic comparison from local ranges the farmer (or a cited local source) entered. Weather
 * scenarios never change yield or profit here: that needs an independently calibrated response model.
 */

export interface SlotMargin {
  slotId: string;
  cropId: string | null;
  name: string;
  /** MMK per hectare, as a range. Null when any of yield, price or cost is missing. */
  marginMmkHa: [number, number] | null;
  missing: string[];
  source: string | null;
}

export interface EconomicsAssessment {
  slots: SlotMargin[];
  /** Whole-cycle margin per hectare, only when every crop slot is known. */
  cycleMarginMmkHa: [number, number] | null;
  areaHa: number | null;
  cycleMarginMmk: [number, number] | null;
  unknownSlots: number;
  /** Annualized margin per ha over the whole repeating cycle: margin * 365.2425 / occupiedCycleDays. */
  annualizedMarginMmkHa?: [number, number] | null;
  occupiedCycleDays?: number;
}

/**
 * Annualize a whole-cycle margin: margin * 365.2425 / cycle days. The cycle runs from the first planting to the
 * next planting of the first crop, so fallow and idle days between crops are INCLUDED; dividing by the days a
 * crop was in the field would credit the farmer with income for idle land. The name `occupiedCycleDays` is
 * historical: the field is "occupied" by the rotation for the whole cycle.
 * Using exact days prevents whole-year integer rounding discontinuities (e.g. 547 days vs 548 days).
 */
export function annualizeMargin(
  marginMmkHa: [number, number] | null,
  occupiedCycleDays: number,
): [number, number] | null {
  if (!marginMmkHa || occupiedCycleDays <= 0) return null;
  const factor = 365.2425 / occupiedCycleDays;
  return [marginMmkHa[0] * factor, marginMmkHa[1] * factor];
}

/**
 * Break-even price calculation: variable costs / saleable yield.
 * Defined only for positive yield.
 */
export function breakEvenPrice(costMmkPerHa: number, yieldKgHa: number): number | null {
  if (yieldKgHa <= 0) return null;
  return costMmkPerHa / yieldKgHa;
}

export function economicsFor(
  rotation: Pick<Rotation, "slots" | "cycleYears"> & { cycleDays?: number },
  economics: CropEconomics[] | undefined,
  areaHa: number | null,
): EconomicsAssessment {
  const slots: SlotMargin[] = rotation.slots
    .filter((s) => s.kind !== "fallow")
    .map((s) => {
      const crop = s.cropId ? getCropById(s.cropId) : undefined;
      const e = economics?.find((x) => x.cropId === s.cropId);
      const missing: string[] = [];
      if (!e?.yieldKgHa) missing.push("yield range");
      if (!e?.priceMmkPerKg) missing.push("price range");
      if (!e?.costMmkPerHa) missing.push("cost range");
      const margin: [number, number] | null =
        e?.yieldKgHa && e.priceMmkPerKg && e.costMmkPerHa
          ? [e.yieldKgHa[0] * e.priceMmkPerKg[0] - e.costMmkPerHa[1], e.yieldKgHa[1] * e.priceMmkPerKg[1] - e.costMmkPerHa[0]]
          : null;
      return { slotId: s.id, cropId: s.cropId ?? null, name: crop?.names.common ?? "Crop", marginMmkHa: margin, missing, source: e?.source ?? null };
    });
  const known = slots.filter((s) => s.marginMmkHa);
  const cycle: [number, number] | null =
    slots.length > 0 && known.length === slots.length
      ? [known.reduce((a, s) => a + (s.marginMmkHa as [number, number])[0], 0), known.reduce((a, s) => a + (s.marginMmkHa as [number, number])[1], 0)]
      : null;

  const occupiedCycleDays = rotation.cycleDays ?? rotation.cycleYears * 365;
  const annualized = annualizeMargin(cycle, occupiedCycleDays);

  return {
    slots,
    cycleMarginMmkHa: cycle,
    areaHa,
    cycleMarginMmk: cycle && areaHa ? [cycle[0] * areaHa, cycle[1] * areaHa] : null,
    unknownSlots: slots.length - known.length,
    annualizedMarginMmkHa: annualized,
    occupiedCycleDays,
  };
}
