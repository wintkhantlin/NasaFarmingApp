import { getCropById } from "../data/crops";
import type { FarmConstraints, Rotation, RuleScope } from "../types";

/** Forage and market suitability. Environmental feasibility only; greenness is not forage quality. */

export interface ForageItem {
  cropId: string;
  name: string;
  use: "none" | "residue-fodder" | "green-manure" | "forage";
  note: string;
  scope: RuleScope;
  ref: string;
}

export interface ForageMarketAssessment {
  forage: ForageItem[];
  forageSlots: number;
  marketAccess: FarmConstraints["marketAccess"] | null;
  preferredHit: number;
  excludedHit: number;
  /** Inputs still needed before a forage or market statement can be made. */
  needs: string[];
}

export function forageMarket(rotation: Pick<Rotation, "slots">, constraints: FarmConstraints | undefined): ForageMarketAssessment {
  const forage: ForageItem[] = [];
  let preferredHit = 0;
  let excludedHit = 0;
  for (const s of rotation.slots) {
    const crop = s.cropId ? getCropById(s.cropId) : undefined;
    if (!crop) continue;
    if (crop.profile?.forage) forage.push({ cropId: crop.id, name: crop.names.common, ...crop.profile.forage });
    if (constraints?.preferredCropIds?.includes(crop.id)) preferredHit++;
    if (constraints?.excludedCropIds?.includes(crop.id)) excludedHit++;
  }
  const needs = ["Livestock feed needs and how much forage is wanted", "Forage quality for your variety and harvest stage"];
  if (!constraints?.marketAccess) needs.push("Market access: where you can sell each crop");
  needs.push("Buyer demand and prices for each crop");
  return {
    forage,
    forageSlots: forage.filter((f) => f.use === "residue-fodder" || f.use === "forage").length,
    marketAccess: constraints?.marketAccess ?? null,
    preferredHit,
    excludedHit,
    needs,
  };
}
